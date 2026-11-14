"""PSI-20 ACME BRE (Burning Rate Emulator): one row per test day.

The table has no test identifier: test_id = "<Year>-<Month>-<Date>" as written. "Oxygen Conc
(percent)" lists the approximate O2 of the tests that ignited that day (Notes, row 1):
one record per listed value. Cells "3400%" and "2100%" read as thousands of percent, a
spreadsheet percent-format artifact: insufficient_evidence.
"""
import re

from common import PERCENT_TO_FRACTION, Table, record
from tables.helpers import numeric_list, text_value

ACCESSION = "PSI-20"
SOURCES = ["psi-data/PSI-20/Experimental table/PSI-20_Experimental table_ACME BRE.csv"]
H_O2 = "Oxygen Conc (percent)"
O2_NOTE = "approximate, for the tests that ignited (table Notes, row 1)"
INTERPRETATIONS = [
    "BRE has no test identifier: `test_id` is \"<Year>-<Month>-<Date>\" as written. Its O2 cells list the "
    "approximate O2 of the tests that ignited that day (Notes, row 1); each listed value is one record.",
    "BRE O2 cells \"3400%\" and \"2100%\" (2019 March 7 and April 1) read as thousands of percent, a spreadsheet "
    "percent-format artifact: `insufficient_evidence`.",
]


def build(skips):
    t = Table(SOURCES[0])
    out = []
    for n, _ in t.numbered():
        tid = "-".join(t.cell(n, h).strip() for h in ("Year", "Month", "Date"))
        kw = dict(acc=ACCESSION, test_id=tid)
        out += text_value(t, n, "Fuel Bottle", variable="fuel", **kw)
        cell = t.cell(n, H_O2)
        if re.match(r"^\s*\d+%\s*$", cell):
            out.append(record(t, n, H_O2, accession=ACCESSION, test_id=tid, variable="o2_mole_fraction",
                              value=cell.strip(), unit="1", value_original=cell, unit_original="percent",
                              status="insufficient_evidence",
                              note="reads as thousands of percent; spreadsheet percent-format artifact"))
            continue
        out += numeric_list(t, n, H_O2, skips, variable="o2_mole_fraction", unit="1", unit_original="percent",
                            factor=PERCENT_TO_FRACTION, how="percent x 0.01", note=O2_NOTE, **kw)
    return out
