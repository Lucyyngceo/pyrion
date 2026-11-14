"""PSI-21 ACME CLD Flame (coflow laminar diffusion flame): one row per test day.

Fuel bottles are recorded as written. The column shows a spreadsheet fill series
("40% CH4", "40% CH5", ... "100% C2H11"): only CH4 and C2H4, the fuels the "Test Type" column
names, are taken as stated; every other formula is insufficient_evidence.
"""
from common import Table, record
from tables.acme_fill import plausible

ACCESSION = "PSI-21"
SOURCES = ["psi-data/PSI-21/Experimental table/PSI-21_Experimental table_CLD Flame.csv"]
INTERPRETATIONS = [
    "CLD \"Fuel Bottle\" shows a spreadsheet fill series (\"40% CH4\", \"40% CH5\", \"40% CH6\" ... \"100% C2H11\"). "
    "Only CH4 and C2H4, the fuels named by the \"Test Type\" column, are taken as stated; every other formula "
    "(including C2H6 inside an ethylene series) is `insufficient_evidence`.",
]


def build(skips):
    t = Table(SOURCES[0])
    out = []
    for n, _ in t.numbered():
        tid = t.cell(n, "Test Day").strip()
        cell = t.cell(n, "Fuel Bottle")
        if not tid or not cell.strip():
            continue
        ok = plausible(cell, ("CH4", "C2H4"))
        out.append(record(t, n, "Fuel Bottle", accession=ACCESSION, test_id=tid, variable="fuel", value=cell.strip(),
                          unit="", value_original=cell, status="extracted" if ok else "insufficient_evidence",
                          note="" if ok else "formula looks like a spreadsheet fill-series artifact"))
    return out
