"""PSI-22 ACME E-FIELD Flames: one row per test day; continuation rows (no test day) list
further fuel concentrations of the day above and give no record here.

E-FIELD applies an electric field to the flame. It is NOT a gravity level and nothing in
this adapter produces a gravity record.
"""
from common import Table
from tables.helpers import text_value

ACCESSION = "PSI-22"
SOURCES = ["psi-data/PSI-22/Experimental table/PSI-22_Experimental table_ACME E-FIELD Flames.csv"]
INTERPRETATIONS = [
    "E-FIELD Flames applies an electric field to coflow and gas-jet flames. The field is an analog of a body force, "
    "not a gravity level: no gravity record comes from it.",
]


def build(skips):
    t = Table(SOURCES[0])
    out = []
    for n, _ in t.numbered():
        tid = t.cell(n, "Test Day").strip()
        if not tid:
            continue
        out += text_value(t, n, "Fuel Bottle", variable="fuel", acc=ACCESSION, test_id=tid)
    return out
