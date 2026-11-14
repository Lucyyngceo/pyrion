"""Shared mapping for the SAFFIRE I-III tables (PSI-98, PSI-99, PSI-100).

Rows whose first cell starts with "F1C" / "F2C" are pre/post-test flow visualisation, and
rows starting with "Note" are footnotes: neither is a burn, and neither gives records.

SIBAL thickness disagrees across the SAFFIRE sources: SAFFIRE-I lists "0.37" in a
"(cm)" column, SAFFIRE-III ".33 cm", SAFFIRE-II "037 mm", and the shared SAFFIRE
"Objectives, Development and Status" paper lists "SIBAL fabric 0.33 mm". The sources do not
say which unit is right, so these thickness records are insufficient_evidence.
"""
import re

from common import CM_TO_MM, PERCENT_TO_FRACTION, convert, join_notes, record
from tables.helpers import numeric, text_value

SIBAL_NOTE = ("SIBAL thickness is given in cm here, but the shared SAFFIRE paper "
              "(Objectives, Development and Status) lists 'SIBAL fabric 0.33 mm' and SAFFIRE-II writes '037 mm'; "
              "the sources do not say which unit is right (NTRS 20180005168 Table 1, page 30, writes 0.37 mm for the SIBAL "
              "fabric of all three flights, but PSI is the source of record)")
SIBAL_INTERPRETATION = (
    "SAFFIRE SIBAL fabric thickness is `insufficient_evidence` in all three flights: SAFFIRE-I gives 0.37 in a "
    "\"Sample Thickness (cm)\" column, SAFFIRE-III \".33 cm\", SAFFIRE-II \"037 mm\" (decimal point missing), and "
    "the SAFFIRE paper shared by the three investigations "
    "(`psi-data/PSI-98/Science Documents/PSI-98_Science Documents_SAFFIRE Objectives, Development and Status.pdf`, "
    "sample table) lists \"SIBAL fabric 0.33 mm\". A factor of 10 separates them. NTRS 20180005168 (Urban et al. 2017) Table 1, page 30, writes 0.37 mm for the SIBAL "
    "fabric of Saffire-I, II and III; that supports mm, but PSI's own sources disagree, so the status stays "
    "`insufficient_evidence`.")
FLOW_CFG = {"concurrent": "concurrent", "opposed": "opposed"}
VALUE_UNIT = re.compile(r"^\s*(~\s*)?(\d*\.?\d+)\s*(mm|cm|cm/s|s|W)\s*$")


def is_burn_row(first_cell: str) -> bool:
    s = first_cell.strip()
    return bool(s) and not s.startswith(("F1C", "F2C", "Note"))


def flow_configuration(t, n, header, acc, tid):
    cell = t.cell(n, header)
    v = cell.strip().lower()
    if v not in FLOW_CFG:
        return []
    return [record(t, n, header, accession=acc, test_id=tid, variable="flow_configuration",
                   value=FLOW_CFG[v], unit="", value_original=cell)]


def value_with_unit(t, n, header, skips, *, acc, tid, variable, unit, factors, note="", status="extracted"):
    """Cells such as '20 cm/s', '0.27 mm', '1 cm': the unit written in the cell picks the factor."""
    cell = t.cell(n, header)
    m = VALUE_UNIT.match(cell)
    if not m or m.group(3) not in factors:
        if cell.strip():
            skips.add(acc, t.relpath, n, header, cell, f"{variable}: not '<number> <unit>'")
        return []
    factor, how = factors[m.group(3)]
    v, cnote = convert(m.group(2), factor, None, how)
    approx = "approximate (~) in source" if m.group(1) else ""
    return [record(t, n, header, accession=acc, test_id=tid, variable=variable, value=v, unit=unit,
                   value_original=cell, unit_original=m.group(3), status=status,
                   note=join_notes(approx, cnote, note))]


def percent_o2(t, n, header, skips, *, acc, tid, note=""):
    return numeric(t, n, header, skips, acc=acc, test_id=tid, variable="o2_mole_fraction", unit="1",
                   unit_original="percent", factor=PERCENT_TO_FRACTION, how="percent x 0.01", note=note)


MM = {"mm": (None, ""), "cm": (CM_TO_MM, "cm x 10")}
CMS = {"cm/s": (None, "")}
SEC = {"s": (None, "")}
