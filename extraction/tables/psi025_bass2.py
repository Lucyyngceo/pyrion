"""PSI-25 BASS-II (Burning and Suppression of Solids - II): one row per test.

- Material: the "Fuel Sample Material" cell as written.
- Sample thickness: parsed from the material text only where it states a thickness
  ("100 micron", "1 mm thick", "0.2 mm PMMA film", "4 mm 1 sided"). Rod diameters and
  widths are not thicknesses. A cell that states two different thicknesses is
  insufficient_evidence.
- O2: "Calibrated initial O2 % by vol" is the test condition; the final reading is an
  outcome (outcome:o2_mole_fraction_after_test), never a point on the O2 axis.
- Flow velocity: "Air display", which the BASS-II ReadMe defines as the duct flow speed in
  cm/s. A cell listing only numbers gives the range of readings during the test; a cell
  mixing numbers and words is insufficient_evidence.
- "Fan display" is not used: the ReadMe defines it as fan voltage x 10, not a velocity.
"""
import re
from decimal import Decimal

from common import MICRON_TO_MM, PERCENT_TO_FRACTION, Table, convert, fmt, join_notes, record
from tables.helpers import numeric, text_value

ACCESSION = "PSI-25"
SOURCES = ["psi-data/PSI-25/Experimental table/PSI-25_Experimental table_BASS-II.csv"]
README = "psi-data/PSI-25/Science Documents/PSI-25_Science Documents_BASS-II_ReadMe.docx"

H_ID = "Test #"
H_MAT = "Fuel Sample Material"
H_AIR = "Air display"
H_O2I = "Calibrated  initial O2 % by vol "
H_O2F = "Calibrated final O2 % by vol"

AIR_NOTE = ("the unit is not in the table: BASS-II ReadMe (psi-data/PSI-25/Science Documents/"
            "PSI-25_Science Documents_BASS-II_ReadMe.docx, paragraph 20) says the display is the duct flow speed in cm/s, "
            "response time ~1 min")

INTERPRETATIONS = [
    "BASS-II `outcome:o2_mole_fraction_after_test` above the test's initial O2 by more than the sensor resolution "
    "(0.1 % O2, Summary Report page 14) is `insufficient_evidence`, kept as written: P22b (39.1 %, initial 20.0 %) and "
    "T28b (40.4 %, initial 20.7 %) cannot follow from a burn in a sealed volume diluted with N2.",
    "BASS-II \"Air display\" is `insufficient_evidence` in every row: the cell is a series of display readings taken "
    "during the test (e.g. \"5 2 0 11 2 11 2 0\"), not a fixed flow condition, and its cm/s unit comes only from the "
    "BASS-II ReadMe (paragraph 20: \"flow speed measured in the duct in cm/s on the video display\"). Same rule as "
    "\"Fan display\", which is not converted at all (ReadMe: \"instantaneous fan voltagex10\").",
    "BASS-II `sample_thickness` is parsed from the material description (\"100 micron\", \"1 mm thick\", "
    "\"0.2 mm PMMA film\", \"4 mm 1 sided\"). Rod diameters (e.g. 1/4\") and sample widths are not thicknesses "
    "and give no record. A description stating two different thicknesses is `insufficient_evidence`.",
]

NUM = r"(\d*\.?\d+)"
THICK_PATTERNS = [
    (re.compile(NUM + r"\s*micron"), MICRON_TO_MM, "micron x 0.001"),
    (re.compile(NUM + r"\s*mm\s+(?:thick|PMMA\s+film|1 sided|2 sided)"), None, ""),
    (re.compile(NUM + r"\s*cm\s+thick"), Decimal(10), "cm x 10"),
]
PURE_NUMBERS = re.compile(r"^\s*\d*\.?\d+(?:\s+\d*\.?\d+)*\s*$")


# O2 sensor resolution of the CSA-CP (Summary Report, page 14: "The resolution of the O2 sensor in the CSA-CP was
# 0.1 percent O2"). A final reading that exceeds the initial one by more than this cannot come from a burn in an
# N2-diluted sealed working volume, where O2 only goes down.
O2_SENSOR_RESOLUTION = Decimal("0.1")
INCONSISTENT_NOTE = "as written in PSI; inconsistent with the test's initial O₂ (≤ 22.2 %)"


def inconsistent_final(t, n, rec):
    """After-test O2 above the test's initial O2 (beyond sensor resolution): kept as written, not usable evidence."""
    try:
        initial = Decimal(t.cell(n, H_O2I).strip())
        final = Decimal(t.cell(n, H_O2F).strip())
    except Exception:
        return rec
    if final > initial + O2_SENSOR_RESOLUTION:
        rec = dict(rec)
        rec["status"] = "insufficient_evidence"
        rec["note"] = join_notes(INCONSISTENT_NOTE, f"initial {initial} % by vol, final {final} % by vol", rec["note"])
    return rec


def thickness(t, n, tid):
    cell = t.cell(n, H_MAT)
    found = []
    for rx, factor, how in THICK_PATTERNS:
        for m in rx.finditer(cell):
            v, note = convert(m.group(1), factor, None, how)
            found.append((v, m.group(0), note))
    if not found:
        return []
    values = {Decimal(v) for v, _, _ in found}
    if len(values) == 1:
        v, text, note = found[0]
        return [record(t, n, H_MAT, accession=ACCESSION, test_id=tid, variable="sample_thickness", value=v,
                       unit="mm", value_original=text, unit_original=text.split()[-1] if "micron" in text else "mm",
                       note=join_notes(note, f"parsed from the material description {cell.strip()!r}"))]
    return [record(t, n, H_MAT, accession=ACCESSION, test_id=tid, variable="sample_thickness",
                   value=cell.strip(), unit="mm", value_original=cell, status="insufficient_evidence",
                   note="the description states two different thicknesses: "
                        + ", ".join(text for _, text, _ in found))]


def air(t, n, tid, skips):
    """Every non-empty "Air display" cell becomes insufficient_evidence: it is a series of display readings taken
    during the test (e.g. "5 2 0 11 2 11 2 0"), not a fixed flow condition. The cm/s unit comes from the ReadMe."""
    cell = t.cell(n, H_AIR)
    s = cell.strip()
    if not s:
        return []
    return [record(t, n, H_AIR, accession=ACCESSION, test_id=tid, variable="flow_velocity", value=s,
                   unit="cm/s", value_original=cell, unit_original="", status="insufficient_evidence",
                   note=join_notes("display reading series during the test, not a test condition", AIR_NOTE))]


def build(skips):
    t = Table(SOURCES[0])
    out = []
    for n, _ in t.numbered():
        tid = t.cell(n, H_ID).strip()
        kw = dict(acc=ACCESSION, test_id=tid)
        out += text_value(t, n, H_MAT, variable="material", **kw)
        out += thickness(t, n, tid)
        for h, var in ((H_O2I, "o2_mole_fraction"), (H_O2F, "outcome:o2_mole_fraction_after_test")):
            recs = numeric(t, n, h, skips, variable=var, unit="1", unit_original="% by vol",
                           factor=PERCENT_TO_FRACTION, how="percent x 0.01",
                           note="calibrated (BASS-II ReadMe: sensor corrected to the ISS reading by a constant offset)",
                           **kw)
            if h == H_O2F:
                recs = [inconsistent_final(t, n, r) for r in recs]
            out += recs
        out += air(t, n, tid, skips)
    return out
