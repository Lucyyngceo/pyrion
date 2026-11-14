"""Turn reviewed document extractions into condition records (method=document).

Inputs, per investigation, in extraction/documents/review/:
  <ACC>.extractor.json    proposed records, each with a verbatim quote (extractor agent)
  <ACC>.verificador.json  KEEP / MODIFY / REJECT per record (verificador agent, separate run)

Rules applied here, by code:
- REJECT -> dropped. MODIFY -> the verificador's corrected fields replace the extractor's.
  An investigation without a verificador file gives no record at all.
- confidence direct / derived -> status extracted; ambiguous -> status insufficient_evidence.
- Numbers are converted here, never by a language model: the record keeps the numbers and
  unit as written, and the unit table below gives the exact factor.
- test_id must be '*', a test id of the PSI table (spaces ignored), a prefix ending in '*'
  (e.g. a test day '21328*'), or a list of those separated by ';' or ','. A record whose
  test_id names no PSI table test (planned test numbers, paper numbering, ground tests
  outside PSI) is not ingested and is counted in SUMMARY.md.
"""
from __future__ import annotations

import json
import re
from collections import Counter
from decimal import Decimal
from pathlib import Path

from common import (ATM_TO_KPA, BAR_TO_KPA, CELSIUS_TO_KELVIN, CM_TO_MM, MICRON_TO_MM, MMHG_TO_KPA,
                    PERCENT_TO_FRACTION, PSI_TO_KPA, convert, join_notes, value_range)

REVIEW = Path(__file__).resolve().parent / "documents" / "review"

# unit as written (lower case) -> (factor, offset, how) into the schema unit of the variable
UNITS = {
    "pressure": {"kpa": (None, None, ""), "atm": (ATM_TO_KPA, None, "atm x 101.325"),
                 "bar": (BAR_TO_KPA, None, "bar x 100"), "psi": (PSI_TO_KPA, None, "psi x 6.894757"),
                 "psia": (PSI_TO_KPA, None, "psia x 6.894757"), "mmhg": (MMHG_TO_KPA, None, "mmHg x 101.325/760"),
                 "torr": (MMHG_TO_KPA, None, "torr x 101.325/760")},
    "o2_mole_fraction": {"%": (PERCENT_TO_FRACTION, None, "percent x 0.01"),
                         "percent": (PERCENT_TO_FRACTION, None, "percent x 0.01"),
                         "% by volume": (PERCENT_TO_FRACTION, None, "percent x 0.01"),
                         "vol%": (PERCENT_TO_FRACTION, None, "percent x 0.01"),
                         "% o2": (PERCENT_TO_FRACTION, None, "percent x 0.01"),
                         "mole fraction": (None, None, ""), "": (None, None, "")},
    "flow_velocity": {"cm/s": (None, None, ""), "mm/s": (Decimal("0.1"), None, "mm/s x 0.1"),
                      "m/s": (Decimal("100"), None, "m/s x 100")},
    "sample_thickness": {"mm": (None, None, ""), "cm": (CM_TO_MM, None, "cm x 10"),
                         "micron": (MICRON_TO_MM, None, "micron x 0.001"), "um": (MICRON_TO_MM, None, "micron x 0.001")},
    "ambient_temperature": {"k": (None, None, ""), "c": (None, CELSIUS_TO_KELVIN, "C + 273.15"),
                            "°c": (None, CELSIUS_TO_KELVIN, "C + 273.15"), "deg c": (None, CELSIUS_TO_KELVIN, "C + 273.15")},
}
UNITS["burner_o2_mole_fraction"] = UNITS["o2_mole_fraction"]
SCHEMA_UNIT = {"pressure": "kPa", "o2_mole_fraction": "1", "burner_o2_mole_fraction": "1", "flow_velocity": "cm/s",
               "sample_thickness": "mm", "ambient_temperature": "K", "droplet_diameter_initial": "mm"}
TERMS = {"gravity_regime", "fuel_phase", "diluent", "flame_type", "flow_configuration", "platform", "fuel",
         "material", "geometry"}
CORRECTABLE = {"quote", "value", "value_original", "unit_original", "numbers", "kind", "source_location", "test_id",
               "confidence", "derivation"}


def _norm_id(s: str) -> str:
    return re.sub(r"\s+", "", s)


def resolve_test_ids(spec: str, table_ids: list[str]) -> list[str] | None:
    """Expand a test_id spec into PSI table test ids; None when any part names no table test."""
    spec = spec.strip()
    if spec == "*":
        return ["*"]
    by_norm = {}
    for t in table_ids:
        by_norm.setdefault(_norm_id(t), t)
    excluded = set()
    m = re.match(r"^(.*?)\s+except\s+(.+)$", spec)
    if m:
        spec = m.group(1).strip()
        excl = resolve_test_ids(m.group(2), table_ids)
        if excl is None:
            return None
        excluded = set(excl)
        if spec == "*":
            return [t for t in table_ids if t not in excluded] or None
    out = []
    for part in re.split(r"[;,]", spec):
        p = part.strip()
        if not p:
            continue
        r = re.match(r"^([A-Za-z]*)(\d+)\.\.([A-Za-z]*)(\d+)$", p)
        if r and r.group(1) == r.group(3):
            for k in range(int(r.group(2)), int(r.group(4)) + 1):
                t = by_norm.get(f"{r.group(1)}{k}")
                if t:
                    out.append(t)
            continue
        if p.endswith("*"):
            pre = _norm_id(p[:-1])
            hits = [t for n, t in by_norm.items() if n.startswith(pre)] if pre else []
            if not hits:
                return None
            out += hits
        elif _norm_id(p) in by_norm:
            out.append(by_norm[_norm_id(p)])
        else:
            return None
    seen, uniq = set(), []
    for t in [x for x in out if x not in excluded]:
        if t not in seen:
            seen.add(t)
            uniq.append(t)
    return uniq or None


def _demojibake(text: str) -> str:
    """Undo UTF-8 text that was decoded as cp1252 (e.g. a minus sign written as three characters)."""
    if any(c in text for c in "âˆ’€Â"):
        try:
            return text.encode("cp1252").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return text
    return text


def _value(rec: dict) -> tuple[str, str, str]:
    """(value, unit, conversion note) for one reviewed record."""
    var = rec["variable"]
    if var in TERMS or var.startswith("outcome:") is False and var not in SCHEMA_UNIT:
        return str(rec.get("value", "")).strip(), "", ""
    nums = [str(n).strip() for n in rec.get("numbers") or []]
    if not nums and str(rec.get("value", "")).strip():
        nums = [str(rec["value"]).strip()]
    uo = (rec.get("unit_original") or "").strip()
    table = UNITS.get(var, {})
    key = uo.lower()
    if key not in table:
        raise ValueError(f"unit {uo!r} not convertible for {var}")
    factor, offset, how = table[key]
    conv = [convert(n, factor, offset, how) for n in nums]
    vals = [v for v, _ in conv]
    note = conv[0][1] if conv else ""
    kind = rec.get("kind", "point")
    if kind == "range" and len(vals) == 2:
        return value_range(vals[0], vals[1]), SCHEMA_UNIT[var], join_notes("range stated in the source", note)
    if len(vals) == 1:
        return vals[0], SCHEMA_UNIT[var], note
    raise ValueError(f"cannot form a value from numbers={nums} kind={kind}")


def load(table_ids_by_acc: dict[str, list[str]]):
    """Return (records_by_accession, stats_by_accession)."""
    out, stats = {}, {}
    for ext in sorted(REVIEW.glob("PSI-*.extractor.json")):
        acc = ext.name.split(".")[0]
        ver = REVIEW / f"{acc}.verificador.json"
        st = Counter()
        stats[acc] = st
        e = json.loads(ext.read_text(encoding="utf-8"))
        st["proposed"] = len(e.get("records", []))
        if not ver.exists():
            st["awaiting_verification"] = st["proposed"]
            continue
        v = json.loads(ver.read_text(encoding="utf-8"))
        verdicts = {x["id"]: x for x in v.get("verdicts", [])}
        recs, seen_keys = [], set()
        for r in e.get("records", []):
            vd = verdicts.get(r["id"])
            if vd is None:
                st["no_verdict"] += 1
                continue
            verdict = vd["verdict"].upper()
            st[verdict.lower()] += 1
            if verdict == "REJECT":
                continue
            r = dict(r)
            if verdict == "MODIFY":
                for k, val in (vd.get("corrected") or {}).items():
                    if k in CORRECTABLE:
                        r[k] = val
            for k in ("quote", "value_original"):
                r[k] = _demojibake(str(r.get(k, "")))
            if r["variable"] == "diluent" and re.search(r"stream:\s*burner", r.get("derivation", ""), re.I):
                st["burner_stream_diluent"] += 1  # schema `diluent` is the ambient inert gas
                continue
            ids = resolve_test_ids(str(r.get("test_id", "")), table_ids_by_acc.get(acc, []))
            if ids is None:
                st["outside_psi_tables"] += 1
                continue
            try:
                value, unit, conv_note = _value(r)
            except ValueError as err:
                st["not_convertible"] += 1
                print(f"  {acc} {r['id']}: {err}")
                continue
            conf = r.get("confidence", "")
            status = "insufficient_evidence" if conf == "ambiguous" else "extracted"
            flags = ", ".join(r.get("flags") or [])
            note = join_notes(
                f"confidence {conf}" + (f" ({r['derivation']})" if r.get("derivation") else ""),
                f"flags: {flags}" if flags else "",
                conv_note,
                f"{r['id']} extracted by the extractor agent; {verdict} by the verificador agent (separate run)",
                "license not stated" if acc == "PSI-10" else "",
            )
            for tid in ids:
                key = (tid, r["variable"], value, r["source_file"], r["source_location"])
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                recs.append({
                    "accession": acc, "test_id": tid, "variable": r["variable"], "value": value, "unit": unit,
                    "value_original": str(r.get("value_original", "")), "unit_original": r.get("unit_original", "") or "",
                    "method": "document", "source_file": r["source_file"], "source_location": r["source_location"],
                    "quote": r["quote"], "status": status, "note": note,
                })
            st["ingested"] += 1
        out[acc] = recs
    return out, stats
