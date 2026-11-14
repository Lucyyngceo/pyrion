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

AIR_NOTE = ("Air display = duct flow speed in cm/s (BASS-II ReadMe); readings during the test, "
            "slow response (~1 min)")

INTERPRETATIONS = [
    "BASS-II \"Air display\" has no unit in the table. The BASS-II ReadMe "
    f"(`{README}`, paragraph 20) states: \"Air display:  flow speed measured in the duct in cm/s on the video "
    "display.  Response time is very slow (~ 1 min), so reading is only steady for long times at the same flow "
    "setting.\" Cells that list only numbers become a `flow_velocity` range (lowest..highest reading during "
    "the test); cells mixing numbers and words are `insufficient_evidence`.",
    "BASS-II \"Fan display\" is not converted: the same ReadMe defines it as \"instantaneous fan voltagex10\", "
    "not a velocity.",
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
    cell = t.cell(n, H_AIR)
    s = cell.strip()
    if not s:
        return []
    if PURE_NUMBERS.match(s):
        nums = [Decimal(x) for x in s.split()]
        lo, hi = fmt(min(nums)), fmt(max(nums))
        value = lo if lo == hi else f"{lo}..{hi}"
        extra = "single reading" if lo == hi else "range of the readings listed in the cell"
        return [record(t, n, H_AIR, accession=ACCESSION, test_id=tid, variable="flow_velocity", value=value,
                       unit="cm/s", value_original=cell, unit_original="", note=join_notes(extra, AIR_NOTE))]
    return [record(t, n, H_AIR, accession=ACCESSION, test_id=tid, variable="flow_velocity", value=s,
                   unit="cm/s", value_original=cell, unit_original="", status="insufficient_evidence",
                   note=join_notes("cell mixes readings with words; not parsed", AIR_NOTE))]


def build(skips):
    t = Table(SOURCES[0])
    out = []
    for n, _ in t.numbered():
        tid = t.cell(n, H_ID).strip()
        kw = dict(acc=ACCESSION, test_id=tid)
        out += text_value(t, n, H_MAT, variable="material", **kw)
        out += thickness(t, n, tid)
        for h, var in ((H_O2I, "o2_mole_fraction"), (H_O2F, "outcome:o2_mole_fraction_after_test")):
            out += numeric(t, n, h, skips, variable=var, unit="1", unit_original="% by vol",
                           factor=PERCENT_TO_FRACTION, how="percent x 0.01",
                           note="calibrated (BASS-II ReadMe: sensor corrected to the ISS reading by a constant offset)",
                           **kw)
        out += air(t, n, tid, skips)
    return out
