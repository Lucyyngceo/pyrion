"""PSI-99 SAFFIRE-II: nine 5 cm x 29 cm samples. Cells carry their unit ("20 cm/s", "0.27 mm").

"Percent O2 (Note 1)": the table's Note 1 reads "Derived from measured CO2 production and
referenced to initial O2 concentration reported by ISS." Every O2 record carries it.
Rows 2-6 and 2-9 leave Material empty (the table does not say it repeats the row above):
no material record for them. The micro-g and 1-g burn/spread columns are not mapped: the
1-g columns are normal-gravity comparison tests, not the flight burn, and the micro-g
"Spread Length" column holds rates (mm/s) under a length header.
"""
import re

from common import Table, convert, join_notes, record
from tables.helpers import text_value
from tables.saffire import (CMS, MM, SEC, SIBAL_INTERPRETATION, flow_configuration, is_burn_row, percent_o2,
                            value_with_unit)

ACCESSION = "PSI-99"
SOURCES = ["psi-data/PSI-99/Experimental table/PSI-99_Experimental table_SAFFIRE-2.csv"]
NOTE1 = ("Note 1 of the table: Derived from measured CO2 production and referenced to initial O2 "
         "concentration reported by ISS.")
H_THICK = "Samle Thickness "

INTERPRETATIONS = [
    SIBAL_INTERPRETATION,
    "SAFFIRE-II \"Percent O2 (Note 1)\": Note 1, at the foot of the same table, reads \"Derived from measured CO2 "
    "production and referenced to initial O2 concentration reported by ISS.\" The O2 values are therefore derived, "
    "not measured directly; each record says so.",
    "SAFFIRE-II thickness \"037 mm\" (samples 2-4 to 2-6) lacks a decimal point (0.37 mm or 37 mm): "
    "`insufficient_evidence`. \"0.85 and 0.37 mm\" (sample 2-7, \"PMMA & Nomex\") gives one record per value.",
    "SAFFIRE-II \"1-g Burn Length\" and \"1-g Spread Rate\" are normal-gravity comparison tests and are not mapped "
    "onto the flight samples; the micro-g columns are not mapped either (their header says length, the cells say mm/s).",
]

LIST_MM = re.compile(r"^\s*(\d*\.?\d+)\s+and\s+(\d*\.?\d+)\s*mm\s*$")


def thickness(t, n, skips, tid):
    cell = t.cell(n, H_THICK)
    s = cell.strip()
    if re.match(r"^0\d", s):  # "037 mm": no decimal point
        return [record(t, n, H_THICK, accession=ACCESSION, test_id=tid, variable="sample_thickness", value=s,
                       unit="mm", value_original=cell, unit_original="mm", status="insufficient_evidence",
                       note="written without a decimal point (0.37 mm or 37 mm?)")]
    m = LIST_MM.match(s)
    if m:
        out = []
        for num in (m.group(1), m.group(2)):
            v, _ = convert(num)
            out.append(record(t, n, H_THICK, accession=ACCESSION, test_id=tid, variable="sample_thickness",
                              value=v, unit="mm", value_original=num, unit_original="mm",
                              note=f"one of the values listed in the cell {s!r} (materials 'PMMA & Nomex')"))
        return out
    return value_with_unit(t, n, H_THICK, skips, acc=ACCESSION, tid=tid, variable="sample_thickness",
                           unit="mm", factors=MM)


def build(skips):
    t = Table(SOURCES[0])
    out = []
    for n, row in t.numbered():
        if not is_burn_row(row[0]):
            continue
        tid = row[0].strip()
        out += text_value(t, n, "Material", variable="material", acc=ACCESSION, test_id=tid)
        out += thickness(t, n, skips, tid)
        out += value_with_unit(t, n, "Air Flow (cm/s)", skips, acc=ACCESSION, tid=tid, variable="flow_velocity",
                               unit="cm/s", factors=CMS)
        out += percent_o2(t, n, "Percent O2 (Note 1)", skips, acc=ACCESSION, tid=tid, note=NOTE1)
        out += value_with_unit(t, n, "Burn Time (s)", skips, acc=ACCESSION, tid=tid, variable="outcome:burn_time",
                               unit="s", factors=SEC)
        out += flow_configuration(t, n, "Flow Direction", ACCESSION, tid)
    return out
