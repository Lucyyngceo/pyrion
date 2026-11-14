"""Build data/derived/bass2_flow_steps.csv: the BASS-II low-flow "Air display" series, parsed deterministically.

    python -I extraction/build_derived.py

This is a DERIVED table, separate from the condition records (data/conditions/ is not touched). It reads
the PSI experimental table of BASS-II and the existing condition records (for O2), and checks the two
documents that define the display units (the BASS-II ReadMe and the fan calibration workbook) before it writes.

Parser rules (never guess):
- the cell must be nothing but numbers separated by spaces, optionally followed by ONE separate word `ext` or
  `extinguished`; anything else (words, "<1", "max", parentheses, ">" , fused tokens such as "0ext") is ambiguous
  and gets no derived number;
- a series with a reading above 55 is ambiguous: the BASS-II Summary Report gives ~55 cm/s as the duct maximum,
  so a larger number is probably a fan-display value in the wrong column;
- `flow_min_with_flame` is filled only when the cell ends with the separate extinction word: it is the lowest listed
  reading, read as "flame burning at every listed reading, out after the last" (an interpretation of the
  notation, stated in the README).
"""
from __future__ import annotations

import csv
import io
import re
import sys
import zipfile
from decimal import Decimal
from fractions import Fraction
from pathlib import Path
from xml.etree import ElementTree as ET

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from common import REPO, RAW, fmt  # noqa: E402

TABLE = "psi-data/PSI-25/Experimental table/PSI-25_Experimental table_BASS-II.csv"
README = "psi-data/PSI-25/Science Documents/PSI-25_Science Documents_BASS-II_ReadMe.docx"
CALIB = "psi-data/PSI-25/Reference Data/PSI-25_Reference Data_Fan calibration data.xlsx"
REPORT = "psi-data/PSI-25/Reports/PSI-25_Reports_BASS-II Summary Report.pdf"
OUT = REPO / "data" / "derived" / "bass2_flow_steps.csv"

AIR_QUOTE = ("Air display:  flow speed measured in the duct in cm/s on the video display.  "
             "Response time is very slow (~ 1 min), so reading is only steady for long times at the same flow setting.")
FAN_QUOTE = "Fan display:  instantaneous fan voltagex10 on the video display."
MAX_QUOTE = "With no restrictors, the maximum flow velocity was ~55 cm/s"
MAX_CMS = Decimal(55)

FIELDS = ["accession", "test_id", "material", "geometry_class", "size_original", "sample_radius_mm", "radius_basis",
          "o2_initial", "o2_final", "flow_steps", "flow_unit", "flow_unit_source", "flow_min_with_flame",
          "ended_in_extinction", "cell_mentions_extinction", "parse_status", "parse_reason", "air_display_original",
          "source_file", "source_row",
          # interpreted columns (rod rows only): extractor agent + separate verificador agent, never the parser above
          "limit_type", "last_stable_flow_cm_s", "extinction_flow_cm_s", "interpretation_basis",
          "interpretation_status", "interpretation_audit", "interpretation_confidence"]
REVIEW = HERE / "documents" / "review"
NASA_CSV = REPO / "data" / "derived" / "bass2_rod_nasa_numbers.csv"
NOTE_MD = REPO / "data" / "derived" / "bass2_rod_boundary.md"

NUM = re.compile(r"^(\d+\.?\d*|\.\d+)$")
ROD_SIZE = re.compile(r"(\d+/\d+|\d*\.\d+|\d+)\s*\"")


def docx_text(rel):
    with zipfile.ZipFile(RAW / rel) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    return [" ".join("".join(t.text or "" for t in p.iter(ns + "t")).split()) for p in root.iter(ns + "p")]


def verify_sources():
    """Fail loudly if a quoted source moved: every citation in the README is checked here."""
    paras = docx_text(README)
    norm = lambda s: " ".join(s.split())  # noqa: E731
    air = next((i for i, p in enumerate(paras, 1) if p.startswith("Air display:")), None)
    fan = next((i for i, p in enumerate(paras, 1) if p.startswith("Fan display:")), None)
    if air is None or norm(AIR_QUOTE) not in norm(paras[air - 1]):
        raise SystemExit("ReadMe: Air display sentence not found")
    if fan is None or norm(FAN_QUOTE) not in norm(paras[fan - 1]):
        raise SystemExit("ReadMe: Fan display sentence not found")
    import openpyxl
    wb = openpyxl.load_workbook(RAW / CALIB, read_only=True, data_only=True)
    ws = wb["Fan Calibration data"]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    hdr = next(i for i, r in enumerate(rows) if r[:5] == ["Pot", "Fan Display", "Air Display", "Fan V", "U cm/s*"])
    first = rows[hdr + 1]
    wb.close()
    if not (first[0] == 10 and first[1] == 122 and first[2] == 29 and abs(first[4] - 29.1914) < 1e-3):
        raise SystemExit("calibration workbook: first calibration row changed")
    return air, fan, hdr + 1, hdr + 2  # ReadMe paragraphs; Excel header row; first data row


def geometry(material: str):
    m = material.lower()
    if "rod" in m:
        return "rod"
    if "sphere" in m or "spherical" in m:
        return "sphere"
    if "film" in m or "micron" in m:
        return "film"
    if "slab" in m or "sheet" in m or "thick" in m:
        return "sheet"
    return "other"


def radius(material: str, geom: str):
    """(radius_mm, basis). Only a rod with a size written in inches; a spherical section has no stated radius."""
    if geom == "rod":
        m = ROD_SIZE.search(material)
        if not m:
            return "", "rod size has no inch mark or number in the label: not guessed"
        inch = Fraction(m.group(1)) if "/" in m.group(1) else Fraction(Decimal(m.group(1)))
        dia = Decimal(inch.numerator) / Decimal(inch.denominator) * Decimal("25.4")
        return fmt(dia / 2), f"diameter {m.group(1)}\" x 25.4 = {fmt(dia)} mm; radius = diameter / 2 (label: {material.strip()!r})"
    if geom == "sphere":
        return "", "label gives a sphere size but not whether it is the diameter or a section of a larger sphere: not computed"
    return "", ""


def parse_air(cell: str):
    """-> (status, reason, steps list, ended_in_extinction or None, cell_mentions_extinction)"""
    s = cell.strip()
    mentions = bool(re.search(r"ext", s, re.I))
    if not s:
        return "ambiguous", "empty cell", [], None, False
    toks = s.split()
    ext = False
    if toks[-1] in ("ext", "extinguished") and len(toks) > 1:
        ext, toks = True, toks[:-1]
    if not all(NUM.match(t) for t in toks):
        return "ambiguous", "cell contains words, symbols or a fused token (not a plain series of numbers)", [], None, mentions
    vals = [Decimal(t) for t in toks]
    if any(v > MAX_CMS for v in vals):
        return "ambiguous", "a reading above 55: the duct maximum is ~55 cm/s (Summary Report), so the cell probably holds fan-display values", [], None, mentions
    return "ok", "", toks, ext, mentions


def o2_by_test():
    init, final = {}, {}
    with (REPO / "data" / "conditions" / "PSI-25.csv").open(encoding="utf-8", newline="") as fh:
        for r in csv.DictReader(fh):
            if r["method"] != "table" or r["status"] != "extracted":
                continue
            if r["variable"] == "o2_mole_fraction":
                init[r["test_id"]] = r["value"]
            elif r["variable"] == "outcome:o2_mole_fraction_after_test":
                final[r["test_id"]] = r["value"]
    return init, final


def load_interpretation():
    """Merge the extractor's rod interpretation with the verificador's verdicts. Returns ({test_id: fields}, nasa list)."""
    import json
    e_path, v_path = REVIEW / "derived-bass2-rods.extractor.json", REVIEW / "derived-bass2-rods.verificador.json"
    if not (e_path.exists() and v_path.exists()):
        return {}, []
    e = json.loads(e_path.read_text(encoding="utf-8"))
    v = json.loads(v_path.read_text(encoding="utf-8"))
    verdicts = {x["test_id"]: x for x in v["verdicts"]}
    nasa_fix = {x["id"]: x for x in v.get("nasa_quote_check", [])}
    out = {}
    for r in e["rows"]:
        vd = verdicts.get(r["test_id"])
        if vd is None:
            continue
        f = {k: r.get(k, "") for k in ("limit_type", "last_stable_flow_cm_s", "extinction_flow_cm_s",
                                         "interpretation_basis", "confidence")}
        verdict = vd["verdict"].upper()
        if verdict == "REJECT":
            f.update(limit_type="unclear", last_stable_flow_cm_s="", extinction_flow_cm_s="", confidence="unclear")
        elif verdict == "MODIFY":
            f.update({k: str(val) for k, val in (vd.get("corrected") or {}).items() if k in f})
        f["audit"] = verdict
        out[r["test_id"]] = f
    nasa = []
    for n in e["nasa_numbers"]:
        n = dict(n)
        fix = nasa_fix.get(n["id"])
        n["audit"] = fix["verdict"].upper() if fix else "NOT AUDITED"
        if fix and fix["verdict"].upper() == "MODIFY":
            n.update({k: val for k, val in (fix.get("corrected") or {}).items() if k in ("page", "quote", "statement")})
        nasa.append(n)
    return out, nasa


def main():
    air_p, fan_p, hdr_row, first_row = verify_sources()
    raw = (RAW / TABLE).read_bytes().decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(raw, newline="")))
    head = rows[0]
    i_id, i_mat, i_air = head.index("Test #"), head.index("Fuel Sample Material"), head.index("Air display")
    init, final = o2_by_test()
    unit_src = (f"BASS-II ReadMe paragraph={air_p} (docx): \"{AIR_QUOTE}\"; magnitudes agree with the fan calibration "
                f"workbook (sheet 'Fan Calibration data', Excel row {first_row}: pot 10, Air Display 29, 'U cm/s*' 29.19)")
    interp, nasa = load_interpretation()
    out = []
    for n, row in enumerate(rows[1:], start=1):
        tid, mat, cell = row[i_id].strip(), row[i_mat], row[i_air]
        geom = geometry(mat)
        r_mm, basis = radius(mat, geom)
        status, reason, steps, ext, mentions = parse_air(cell)
        steps_txt = " ".join(steps)
        flow_min = ""
        if status == "ok" and ext:
            flow_min = min(steps, key=Decimal)
        out.append({
            "accession": "PSI-25", "test_id": tid, "material": mat, "geometry_class": geom, "size_original": mat.strip(),
            "sample_radius_mm": r_mm, "radius_basis": basis, "o2_initial": init.get(tid, ""), "o2_final": final.get(tid, ""),
            "flow_steps": steps_txt, "flow_unit": "cm/s" if status == "ok" else "", "flow_unit_source": unit_src if status == "ok" else "",
            "flow_min_with_flame": flow_min, "ended_in_extinction": ("true" if ext else "false") if status == "ok" else "",
            "cell_mentions_extinction": "true" if mentions else "false", "parse_status": status, "parse_reason": reason,
            "air_display_original": cell, "source_file": TABLE, "source_row": n,
        })
        it = interp.get(tid) if geom == "rod" else None
        out[-1].update({
            "limit_type": it["limit_type"] if it else "", "last_stable_flow_cm_s": it["last_stable_flow_cm_s"] if it else "",
            "extinction_flow_cm_s": it["extinction_flow_cm_s"] if it else "",
            "interpretation_basis": it["interpretation_basis"] if it else "",
            "interpretation_status": ("unclear" if it["limit_type"] == "unclear" else "extracted") if it else "",
            "interpretation_audit": it["audit"] if it else "", "interpretation_confidence": it["confidence"] if it else "",
        })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS, lineterminator="\n")
        w.writeheader()
        w.writerows(out)
    ok = [r for r in out if r["parse_status"] == "ok"]
    summary = {
        "rows": len(out), "ok": len(ok), "ambiguous": len(out) - len(ok),
        "rods": sum(r["geometry_class"] == "rod" for r in out),
        "rods_with_radius": sum(r["geometry_class"] == "rod" and bool(r["sample_radius_mm"]) for r in out),
        "spheres": sum(r["geometry_class"] == "sphere" for r in out),
        "spheres_with_radius": sum(r["geometry_class"] == "sphere" and bool(r["sample_radius_mm"]) for r in out),
        "ok_with_radius": sum(bool(r["sample_radius_mm"]) for r in ok),
        "ended_in_extinction": sum(r["ended_in_extinction"] == "true" for r in out),
        "ext_with_radius": sum(r["ended_in_extinction"] == "true" and bool(r["sample_radius_mm"]) for r in out),
        "paragraphs": {"air": air_p, "fan": fan_p},
    }
    rods = [r for r in out if r["geometry_class"] == "rod" and r["limit_type"]]
    usable = [r for r in rods if r["limit_type"] in ("quench", "blowoff")]
    summary["rod_interpreted"] = len(rods)
    summary["limit_types"] = {k: sum(r["limit_type"] == k for r in rods) for k in ("quench", "blowoff", "none", "unclear")}
    summary["rods_with_numeric_flow"] = sum(bool(r["last_stable_flow_cm_s"] or r["extinction_flow_cm_s"]) for r in rods)
    if nasa:
        with NASA_CSV.open("w", encoding="utf-8", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=["id", "file", "page", "quote", "statement", "audit"], lineterminator="\n")
            w.writeheader()
            for n in nasa:
                w.writerow({k: n.get(k, "") for k in w.fieldnames})
    if rods:
        write_note(out, rods, usable, nasa)
    print(summary)
    return summary


def write_note(all_rows, rods, usable, nasa):
    """data/derived/bass2_rod_boundary.md: the counts are computed here; the comparison says what does not match."""
    def o2(r):
        try:
            return Decimal(r["o2_final"]) * 100
        except Exception:
            return None
    lim = {k: [r for r in rods if r["limit_type"] == k] for k in ("quench", "blowoff", "none", "unclear")}
    finals = sorted((o2(r), r["test_id"]) for r in usable if o2(r) is not None)
    plausible = [(v, t) for v, t in finals if v >= 5]
    numeric = [r for r in rods if r["last_stable_flow_cm_s"] or r["extinction_flow_cm_s"]]
    usable_num = [r for r in usable if r["last_stable_flow_cm_s"] or r["extinction_flow_cm_s"]]
    olson = [r for r in rods if re.fullmatch(r"O\d+[ab]?", r["test_id"])]
    L = ["# BASS-II PMMA rod tests: what the PSI table supports about the flammability boundary", "",
         "Generated by `extraction/build_derived.py` from `bass2_flow_steps.csv` (interpreted columns) and "
         "`bass2_rod_nasa_numbers.csv`. The interpreted columns were proposed by an extractor agent and audited by a separate "
         "verificador agent (segregated internal check by language models, not expert or NASA review). Nothing was tuned to "
         "match NASA's published numbers.", "",
         "## Counts", "",
         f"- Rod rows interpreted: **{len(rods)}** (all rows with `geometry_class = rod`; 50 have a radius, 4 labels have no inch mark and are kept as found).",
         f"- `limit_type`: quench **{len(lim['quench'])}**, blowoff **{len(lim['blowoff'])}**, none **{len(lim['none'])}**, unclear **{len(lim['unclear'])}**.",
         f"- Rods with a numeric flow in cm/s at the limit (`last_stable_flow_cm_s` or `extinction_flow_cm_s`): **{len(numeric)}**.",
         f"- Tests with a usable limit type (quench or blowoff): **{len(usable)}**, of which with a flow in cm/s at that limit: **{len(usable_num)}**.", ""]
    if finals:
        L += ["## Lowest post-burn oxygen among the usable limit tests", "",
              "Post-burn O2 is the table column \"Calibrated final O2 % by vol\" (`outcome:o2_mole_fraction_after_test` in the condition records).", "",
              "| Test | Final O2 (% by vol) | Limit type |", "|---|---|---|"]
        for v, t in finals[:6]:
            L.append(f"| {t} | {v:g} | {next(r['limit_type'] for r in usable if r['test_id'] == t)} |")
        L.append("")
        if plausible and plausible[0] != finals[0]:
            L += [f"The lowest listed value, {finals[0][0]:g} % ({finals[0][1]}), is not a credible post-burn atmosphere for a test that burned "
                  f"(anomaly noted by the extractor, left as found). The lowest plausible one is **{plausible[0][0]:g} %** ({plausible[0][1]}).", ""]
    L += ["## Comparison with NASA's published numbers", "",
          "Source: Olson & Ferkul 2015, NTRS 20150008961 (`data/raw/nasa/ntrs-20150008961/`). Quotes with pages are in "
          "`bass2_rod_nasa_numbers.csv`.", "",
          f"- **24 concurrent-flow tests.** The table has {len(olson)} Olson rod rows (ids O1..O22, letters a/b are separate runs of one sample). "
          "The paper's 24 tests are the pre-2016 Olson rows (22 clear and 2 black rods; O20-O22 are 2016 tests and are not in the Summary Report's "
          "Table A.5), as the extractor found. This is a match by count and by the verificador's check, not an identification of every test.",
          "- **13.6 % O2 minimum test point.** The lowest post-burn O2 of an Olson limit test in the table is O4 (13.6 %), which matches the paper's "
          "'minimum test point of 13.6 % O2'. The paper's boundary intercept (13.3 % O2) is a fit and is not reproduced here.",
          "- **Flow at the limit does NOT match.** NASA used the flow at which flames extinguished and the last stable flow (Figure 4, in cm/s from the "
          "daily fan calibration). In this table every quench or blowoff limit is a pot setting or fan-display value (e.g. '0.36 ext', 'blowoff pot 6.0') or "
          f"has no number: **{len(numeric)}** rods have a flow in cm/s at the limit. The paper's boundary points cannot be rebuilt from the PSI table cells. "
          "They need the daily fan-calibration data and the report's per-test observation column (Summary Report Table A.3/A.5), which are outside the "
          "condition records and were deliberately not used here.",
          "- **Stretch rate.** The paper's forced stretch of the rod tip is a_f = 3/2 U/R. With no limit flow in cm/s for any rod, no stretch rate is computed.",
          "", "## Limits", "",
          "- 'unclear' rows stay unclear: the cell shows flows stepped, raised or alternated but never says the flame went out or blew off.",
          "- The Summary Report's observation column states the outcome for many of these rows. It is not part of the PSI table and was not used to decide; "
          "if it is allowed as a second source, many 'unclear' rows would become quench or blowoff (the verificador counted 21 of the 29 that were unclear before its four corrections; see its file).",
          "- Rows P5 and P13a read 'down to ext' with the fan turned to 0: whether they count as quench limit points is in the verificador's answer in "
          "`extraction/documents/review/derived-bass2-rods.verificador.json`.", ""]
    NOTE_MD.write_text("\n".join(L), encoding="utf-8")


if __name__ == "__main__":
    main()
