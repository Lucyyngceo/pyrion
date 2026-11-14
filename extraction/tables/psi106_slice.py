"""PSI-106 SLICE: one row per test day, with the fuel mixture as written.

test_id = the date at the start of "Test Date". The last row's date cell says that day was
SPICE testing ("Last day of testing: SPICE testing with ..."), so its fuel is kept as
insufficient_evidence for SLICE.
"""
import re

from common import Table, record

ACCESSION = "PSI-106"
SOURCES = ["psi-data/PSI-106/Experimental table/PSI-106_Experimental table_Slice.csv"]
INTERPRETATIONS = [
    "SLICE `test_id` is the date at the start of the \"Test Date\" cell. The 2012-MAR-23 row is described in the same "
    "cell as \"SPICE testing\", so its fuel is `insufficient_evidence` for SLICE.",
]
DATE = re.compile(r"^\s*(\d{4}-[A-Z]{3}-\d{2})")


def build(skips):
    t = Table(SOURCES[0])
    out = []
    for n, _ in t.numbered():
        dcell = t.cell(n, "Test Date")
        m = DATE.match(dcell)
        fuel = t.cell(n, "Fuel Type")
        if not m or not fuel.strip():
            continue
        spice = "SPICE testing" in dcell
        out.append(record(t, n, "Fuel Type", accession=ACCESSION, test_id=m.group(1), variable="fuel",
                          value=fuel.strip(), unit="", value_original=fuel,
                          status="insufficient_evidence" if spice else "extracted",
                          note="the date cell says this day was SPICE testing" if spice else ""))
    return out
