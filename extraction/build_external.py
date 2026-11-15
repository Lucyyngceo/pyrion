"""Build the condition records of an EXTERNAL source (a NASA paper or presentation that is not a PSI investigation).

    python -I extraction/build_external.py ntrs-20250010653

Reads extraction/documents/review/external-<id>.extractor.json (extractor agent) and external-<id>.verificador.json
(verificador agent, separate run) and writes data/external/<id>/conditions.csv with the columns of data/conditions/.
The rules of extraction/documents.py apply: REJECT drops a record, MODIFY applies the verificador's corrected fields,
`ambiguous` confidence becomes `insufficient_evidence`, numbers are converted by code with exact factors, never by a
language model. Test ids are descriptive (the source's own test names), never rows of a PSI table.
External records are never copied to data/conditions/.
"""
from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from common import FIELDS, REPO, join_notes  # noqa: E402
import documents  # noqa: E402

REVIEW = HERE / "documents" / "review"
SCHEMA_NUMERIC = set(documents.SCHEMA_UNIT)


def _external_value(r: dict):
    """Outcomes keep the number and unit exactly as written (no schema unit exists for them); text-only values stay text."""
    var = r["variable"]
    nums = [str(n).strip() for n in r.get("numbers") or []]
    if var.startswith("outcome:"):
        if not nums:
            return str(r.get("value", "")).strip(), "", ""
        unit = (r.get("unit_original") or "").strip()
        if r.get("kind") == "range" and len(nums) == 2:
            lo, hi = sorted(nums, key=float)
            return f"{lo}..{hi}", unit, "range stated in the source; written as it appears, unit as written, no conversion"
        return nums[0], unit, "unit as written in the source, no conversion"
    if var in SCHEMA_NUMERIC and not nums:
        text = str(r.get("value", "")).strip() or str(r.get("value_original", "")).strip()
        return text, documents.SCHEMA_UNIT[var], "no number stated in the source: the words are kept, no value is assumed"
    return documents._value(r)


def build(src_id: str):
    e = json.loads((REVIEW / f"external-{src_id}.extractor.json").read_text(encoding="utf-8"))
    v = json.loads((REVIEW / f"external-{src_id}.verificador.json").read_text(encoding="utf-8"))
    verdicts = {x["id"]: x for x in v["verdicts"]}
    stats = Counter()
    recs, seen = [], set()
    for r in e["records"]:
        vd = verdicts.get(r["id"])
        stats["proposed"] += 1
        if vd is None:
            stats["no_verdict"] += 1
            continue
        verdict = vd["verdict"].upper()
        stats[verdict.lower()] += 1
        if verdict == "REJECT":
            continue
        r = dict(r)
        if verdict == "MODIFY":
            for k, val in (vd.get("corrected") or {}).items():
                if k in documents.CORRECTABLE:
                    r[k] = val
        for k in ("quote", "value_original"):
            r[k] = documents._demojibake(str(r.get(k, "")))
        try:
            value, unit, conv_note = _external_value(r)
        except ValueError as err:
            stats["not_convertible"] += 1
            print(f"  {r['id']}: {err}")
            continue
        conf = r.get("confidence", "")
        status = "insufficient_evidence" if conf in ("ambiguous", "unclear") else "extracted"
        flags = ", ".join(r.get("flags") or [])
        note = join_notes(
            f"confidence {conf}" + (f" ({r['derivation']})" if r.get("derivation") else ""),
            f"flags: {flags}" if flags else "",
            conv_note,
            "external source, not a PSI investigation",
            f"{r['id']} extracted by the extractor agent; {verdict} by the verificador agent (separate run)")
        ids = [t.strip() for t in str(r["test_id"]).split(";") if t.strip()]
        values = value if isinstance(value, list) else [value]
        for tid in ids:
            for one in values:
                key = (tid, r["variable"], one, r["source_location"], r.get("quote", ""))
                if key in seen:
                    continue
                seen.add(key)
                recs.append({"accession": e["accession"], "test_id": tid, "variable": r["variable"], "value": one, "unit": unit,
                             "value_original": str(r.get("value_original", "")), "unit_original": r.get("unit_original", "") or "",
                             "method": "document", "source_file": r["source_file"], "source_location": r["source_location"],
                             "quote": r["quote"], "status": status, "note": note})
        stats["ingested"] += 1
    out = REPO / "data" / "external" / src_id / "conditions.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS, lineterminator="\n")
        w.writeheader()
        w.writerows(recs)
    by_var = Counter(r["variable"] for r in recs)
    tests = sorted({r["test_id"] for r in recs})
    print(dict(stats))
    print(f"{len(recs)} records in {len(tests)} tests -> {out.relative_to(REPO)}")
    print(dict(by_var))
    return recs, stats, tests


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    build(sys.argv[1])
