"""PSI-107 SPICE (Smoke Point In Co-flow Experiment): one row per flame setting.

The table has no test identifier. test_id = "GMT <day> <ignition time>", both as written in
the first two columns; rows sharing an ignition are successive fuel-flow settings of one
burn. "Air Rate (cm/s)" is the co-flowing air velocity.
"""
from common import Table
from tables.helpers import numeric, text_value

ACCESSION = "PSI-107"
SOURCES = ["psi-data/PSI-107/Experimental table/PSI-107_Experimental table_Spice.csv"]
INTERPRETATIONS = [
    "SPICE rows have no test identifier: `test_id` is built as \"GMT <GMT date> <GMT ignition>\" from the first two "
    "columns, exactly as written. Rows sharing an ignition time are successive fuel-flow settings of one burn.",
    "SPICE rows with a negative \"Air Rate (cm/s)\" (-0.28, -5.92) are `insufficient_evidence`: a co-flow speed "
    "cannot be negative as written, and the table does not explain it.",
]


def build(skips):
    t = Table(SOURCES[0])
    out = []
    for n, _ in t.numbered():
        day, ign = t.cell(n, "GMT date").strip(), t.cell(n, "GMT ignition").strip()
        if not day:
            continue
        kw = dict(acc=ACCESSION, test_id=f"GMT {day} {ign}")
        out += text_value(t, n, "Fuel", variable="fuel", **kw)
        neg = t.cell(n, "Air Rate (cm/s)").strip().startswith("-")
        out += numeric(t, n, "Air Rate (cm/s)", skips, variable="flow_velocity", unit="cm/s", unit_original="cm/s",
                       status="insufficient_evidence" if neg else "extracted",
                       note="negative air rate: not a possible co-flow speed as written" if neg else "co-flowing air velocity",
                       **kw)
    return out
