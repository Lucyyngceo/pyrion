"""PSI-101 SAME-R (Smoke Aerosol Measurement Experiment - Reflight): heated samples producing smoke."""
from common import Table
from tables.helpers import numeric, text_value

ACCESSION = "PSI-101"
SOURCES = ["psi-data/PSI-101/Experimental table/PSI-101_Experimental table_SAME-R.csv"]


def build(skips):
    t = Table(SOURCES[0])
    out = []
    for n, _ in t.numbered():
        tid = t.cell(n, "SAME Test #").strip()
        if not tid:
            continue
        kw = dict(acc=ACCESSION, test_id=tid)
        out += text_value(t, n, "Sample Type", variable="material", **kw)
        out += numeric(t, n, "Inlet velocity (cm/s)", skips, variable="flow_velocity", unit="cm/s",
                       unit_original="cm/s", note="inlet flow over the heated sample (smoke generation)", **kw)
    return out
