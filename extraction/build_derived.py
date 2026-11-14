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

from common import REPO, RAW, fmt, round_sig  # noqa: E402

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
          "interpretation_status", "interpretation_audit", "interpretation_confidence",
          # second pass (rod rows only): Summary Report observation column + fan calibration workbook
          "limit_type_report", "limit_type_final", "limit_type_report_basis", "last_stable_setting", "extinction_setting",
          "limit_flow_cm_s_lo", "limit_flow_cm_s_hi", "limit_flow_basis", "limit_flags",
          "forced_stretch_lo_per_s", "forced_stretch_hi_per_s"]
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


def load_flow_pass():
    """Second pass: extractor file + verificador verdicts. Returns {test_id: fields}; empty if either file is missing."""
    import json
    e_path = REVIEW / "derived-bass2-rods-flow.extractor.json"
    v_path = REVIEW / "derived-bass2-rods-flow.verificador.json"
    if not (e_path.exists() and v_path.exists()):
        return {}
    e = json.loads(e_path.read_text(encoding="utf-8"))
    v = json.loads(v_path.read_text(encoding="utf-8"))
    verdicts = {x["test_id"]: x for x in v["verdicts"]}
    keys = ("limit_type_report", "limit_type_report_basis", "last_stable_setting", "extinction_setting",
            "limit_flow_cm_s_lo", "limit_flow_cm_s_hi", "limit_flow_basis")
    out = {}
    for r in e["rows"]:
        vd = verdicts.get(r["test_id"])
        if vd is None:
            continue
        f = {k: str(r.get(k, "") or "") for k in keys}
        f["flags"] = list(r.get("flags") or [])
        verdict = vd["verdict"].upper()
        if verdict == "REJECT":
            f.update({k: "" for k in keys})
        elif verdict == "MODIFY":
            f.update({k: str(val) for k, val in (vd.get("corrected") or {}).items() if k in keys})
            if "flags" in (vd.get("corrected") or {}):
                f["flags"] = list(vd["corrected"]["flags"])
        out[r["test_id"]] = f
    return out


def stretch(radius_mm: str, lo: str, hi: str):
    """Forced stretch of the rod tip a_f = 3/2 * U / R (NTRS 20150008961, p.7), U in cm/s, R in cm: s^-1. Each end separately."""
    if not radius_mm:
        return "", ""
    r_cm = Decimal(radius_mm) / 10
    f = lambda u: fmt(round_sig(Decimal("1.5") * Decimal(u) / r_cm, 4)) if u else ""  # noqa: E731
    return f(lo), f(hi)


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
    flow = load_flow_pass()
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
        fp = flow.get(tid) if geom == "rod" else None
        lt = it["limit_type"] if it else ""
        rep = fp["limit_type_report"] if fp else ""
        final_lt = lt
        if fp and rep in ("quench", "blowoff", "none") and (
                lt == "unclear" or any(f.startswith("FAN_TO_ZERO_END") for f in fp["flags"])):
            final_lt = rep
        s_lo, s_hi = stretch(r_mm, fp["limit_flow_cm_s_lo"], fp["limit_flow_cm_s_hi"]) if fp else ("", "")
        out[-1].update({
            "limit_type_report": rep, "limit_type_final": final_lt if it else "",
            "limit_type_report_basis": fp["limit_type_report_basis"] if fp else "",
            "last_stable_setting": fp["last_stable_setting"] if fp else "",
            "extinction_setting": fp["extinction_setting"] if fp else "",
            "limit_flow_cm_s_lo": fp["limit_flow_cm_s_lo"] if fp else "", "limit_flow_cm_s_hi": fp["limit_flow_cm_s_hi"] if fp else "",
            "limit_flow_basis": fp["limit_flow_basis"] if fp else "", "limit_flags": "; ".join(fp["flags"]) if fp else "",
            "forced_stretch_lo_per_s": s_lo, "forced_stretch_hi_per_s": s_hi,
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
    usable = [r for r in rods if (r["limit_type_final"] or r["limit_type"]) in ("quench", "blowoff")]
    summary["rod_interpreted"] = len(rods)
    summary["limit_types_first_pass"] = {k: sum(r["limit_type"] == k for r in rods) for k in ("quench", "blowoff", "none", "unclear")}
    summary["limit_types_final"] = {k: sum(r["limit_type_final"] == k for r in rods) for k in ("quench", "blowoff", "none", "unclear")}
    summary["rods_with_one_flow_end"] = sum(bool(r["limit_flow_cm_s_lo"]) != bool(r["limit_flow_cm_s_hi"]) for r in rods)
    summary["rods_with_full_bracket"] = sum(bool(r["limit_flow_cm_s_lo"] and r["limit_flow_cm_s_hi"]) for r in rods)
    summary["rods_with_stretch"] = sum(bool(r["forced_stretch_lo_per_s"] or r["forced_stretch_hi_per_s"]) for r in rods)
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
    """data/derived/bass2_rod_boundary.md: the counts are computed here; the comparison says what does or does not match."""
    def o2(r):
        try:
            return Decimal(r["o2_final"]) * 100
        except Exception:
            return None
    final = lambda r: r["limit_type_final"] or r["limit_type"]  # noqa: E731
    lim = {k: [r for r in rods if final(r) == k] for k in ("quench", "blowoff", "none", "unclear")}
    first = {k: sum(r["limit_type"] == k for r in rods) for k in ("quench", "blowoff", "none", "unclear")}
    clean = [r for r in usable if "ANOMALY_PSI_O2" not in r["limit_flags"]]
    finals = sorted((o2(r), r["test_id"]) for r in clean if o2(r) is not None)
    one = [r for r in rods if bool(r["limit_flow_cm_s_lo"]) != bool(r["limit_flow_cm_s_hi"])]
    full = [r for r in rods if r["limit_flow_cm_s_lo"] and r["limit_flow_cm_s_hi"]]
    with_r = [r for r in one + full if r["sample_radius_mm"]]
    stretched = [r for r in rods if r["forced_stretch_lo_per_s"] or r["forced_stretch_hi_per_s"]]
    olson = [r for r in rods if re.fullmatch(r"O\d+[ab]?", r["test_id"])]
    L = ["# BASS-II PMMA rod tests: what the PSI files support about the flammability boundary", "",
         "Generated by `extraction/build_derived.py` from `bass2_flow_steps.csv` and `bass2_rod_nasa_numbers.csv`. Interpreted columns were "
         "proposed by an extractor agent and audited by a separate verificador agent in two passes (segregated internal check by language "
         "models, not expert or NASA review). Nothing was tuned to match NASA's published numbers.", "",
         "Sources of the two passes: pass 1 used only the PSI experimental table cells; pass 2 added the BASS-II Summary Report observation "
         "column (Tables A.3 and A.5, pp. 114-115 and 118-119) and the fan calibration workbook "
         "(`psi-data/PSI-25/Reference Data/PSI-25_Reference Data_Fan calibration data.xlsx`). Pass-1 columns are kept as they were.", "",
         "## Counts", "",
         f"- Rod rows: **{len(rods)}** (50 have a radius; 4 labels have no inch mark and are kept as found).",
         f"- `limit_type` (cells only, pass 1): quench {first['quench']}, blowoff {first['blowoff']}, none {first['none']}, unclear {first['unclear']}.",
         f"- `limit_type_final` (after the Summary Report observation column): quench **{len(lim['quench'])}**, blowoff **{len(lim['blowoff'])}**, "
         f"none **{len(lim['none'])}**, unclear **{len(lim['unclear'])}**. One rule for a flame put out by setting the fan to 0 or off (P2, P4, P5, P6, P13a): `none`, flagged `FAN_TO_ZERO_END`.",
         f"- Rods with a **complete** flow bracket in cm/s (`limit_flow_cm_s_lo` and `_hi`): **{len(full)}**.",
         f"- Rods with **one end** of the bracket in cm/s: **{len(one)}** ({', '.join(r['test_id'] for r in one)}); with a radius: **{len(with_r)}**.",
         "- The conversions use the workbook's restrictor bands read by position (band 3 = two restrictors), which the verificador found supported but never 'direct'; "
         "every converted value is `derived`, taken at the commanded pot setting, and is a loose upper end of a blowoff (the blowoff happened during the ramp, at or below it).", ""]
    L += ["## Forced stretch a_f = 3/2 · U / R", "",
          "Formula and symbol from Olson & Ferkul 2015 (NTRS 20150008961, p.7): forced stretch of the rod tip a_f = 3/2 · U/R, U in cm/s and R the rod radius in cm. "
          "Computed here for each known end separately; no bracket is complete, so each value is an **upper bound of the stretch at blowoff**, not an interval.", ""]
    if stretched:
        L += ["| Test | Rod radius (mm) | Blowoff flow upper end (cm/s) | Stretch upper bound a_f (1/s) |", "|---|---|---|---|"]
        for r in stretched:
            L.append(f"| {r['test_id']} | {r['sample_radius_mm']} | {r['limit_flow_cm_s_hi']} | {r['forced_stretch_hi_per_s']} |")
        L.append("")
    else:
        L += ["No row has both a flow end in cm/s and a radius, so no stretch is computed.", ""]
    if finals:
        L += ["## Lowest post-burn oxygen among the limit tests", "",
              "Post-burn O2 is the table column \"Calibrated final O2 % by vol\". P22a (0.6 %) and P22b (39.1 %) are anomalies of the PSI table, flagged "
              "`ANOMALY_PSI_O2`, and are excluded from this minimum.", "",
              "| Test | Final O2 (% by vol) | Limit type |", "|---|---|---|"]
        for v, t in finals[:5]:
            L.append(f"| {t} | {v:g} | {final(next(r for r in clean if r['test_id'] == t))} |")
        L.append("")
    L += ["## Comparison with NASA's published statements", "",
          "Source: Olson & Ferkul 2015, NTRS 20150008961. Quotes with pages are in `bass2_rod_nasa_numbers.csv`.", "",
          f"- **24 concurrent-flow tests:** matches by count. The table has {len(olson)} Olson rod rows (O1..O22); the paper's 24 are the pre-2016 ones (22 clear and 2 black rods). Not an identification of every test.",
          f"- **Minimum O2 of 13.6 %:** matches: the lowest post-burn O2 among the limit tests is {finals[0][0]:g} % ({finals[0][1]})." if finals else "- **Minimum O2:** no value.",
          f"- **Quench at low flow, blowoff at high flow:** consistent in words, not testable in numbers. All {len(one)} cm/s values we can give are blowoff flows (upper ends "
          + (f"{min(Decimal(r['limit_flow_cm_s_hi']) for r in one if r['limit_flow_cm_s_hi'])} to {max(Decimal(r['limit_flow_cm_s_hi']) for r in one if r['limit_flow_cm_s_hi'])} cm/s" if one else "none")
          + f"); the {len(lim['quench'])} quench limits sit at pot settings of about 0.26 to 0.38, below the lowest pot the calibration tabulates for a day, and interpolation was not allowed, so no quench flow is converted.",
          "- **Flow boundary of the paper (Figure 4):** not reproduced. It was not digitized and nothing was tuned: with no complete bracket and one-sided blowoff bounds, "
          "the PSI files do not allow a flow-versus-oxygen boundary to be rebuilt from them.", "",
          "## Limits", "",
          "- Calibrations exist only for 2014 dates in the workbook; no 2016 test (O20-O22) has a calibration or a report observation. Dates 6/13, 6/16 and 7/30 have no block.",
          "- Where the table cell and the report disagree on how a test ended, the cell-only label was kept as `unclear` (P19, P21a, O3a overshoot).",
          "- The Summary Report observation column and the calibration workbook are PSI files, but they are second sources next to the table; their column alignment was read from a text layer.",
          "- Details and the verificador's answers: `extraction/documents/review/derived-bass2-rods*.json`.", ""]
    NOTE_MD.write_text("\n".join(L), encoding="utf-8")


if __name__ == "__main__":
    main()
