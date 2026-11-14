"""PSI-98 SAFFIRE-I: two large SIBAL fabric samples (S1 concurrent, S2 opposed flow)."""
from common import CM_TO_MM, Table
from tables.helpers import numeric, text_value
from tables.saffire import SIBAL_INTERPRETATION, SIBAL_NOTE, flow_configuration, is_burn_row, percent_o2

ACCESSION = "PSI-98"
SOURCES = ["psi-data/PSI-98/Experimental table/PSI-98_Experimental table_SAFFIRE-1.csv"]
INTERPRETATIONS = [SIBAL_INTERPRETATION]


def build(skips):
    t = Table(SOURCES[0])
    out = []
    for n, row in t.numbered():
        if not is_burn_row(row[0]):
            continue
        tid = row[0].strip()
        kw = dict(acc=ACCESSION, test_id=tid)
        out += text_value(t, n, "Material", variable="material", **kw)
        out += numeric(t, n, "Sample Thickness (cm)", skips, variable="sample_thickness", unit="mm",
                       unit_original="cm", factor=CM_TO_MM, how="cm x 10", status="insufficient_evidence",
                       note=SIBAL_NOTE, **kw)
        out += numeric(t, n, "Air Flow (cm/s)", skips, variable="flow_velocity", unit="cm/s", unit_original="cm/s", **kw)
        out += percent_o2(t, n, "Percent O2", skips, acc=ACCESSION, tid=tid)
        out += numeric(t, n, "Burn Time (s)", skips, variable="outcome:burn_time", unit="s", unit_original="s", **kw)
        out += flow_configuration(t, n, "Flow Direction ", ACCESSION, tid)
    return out
