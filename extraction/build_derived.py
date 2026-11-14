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
          "source_file", "source_row"]

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


def main():
    air_p, fan_p, hdr_row, first_row = verify_sources()
    raw = (RAW / TABLE).read_bytes().decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(raw, newline="")))
    head = rows[0]
    i_id, i_mat, i_air = head.index("Test #"), head.index("Fuel Sample Material"), head.index("Air display")
    init, final = o2_by_test()
    unit_src = (f"BASS-II ReadMe paragraph={air_p} (docx): \"{AIR_QUOTE}\"; magnitudes agree with the fan calibration "
                f"workbook (sheet 'Fan Calibration data', Excel row {first_row}: pot 10, Air Display 29, 'U cm/s*' 29.19)")
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
    print(summary)
    return summary


if __name__ == "__main__":
    main()
