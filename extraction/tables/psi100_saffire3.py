"""PSI-100 SAFFIRE-III: two large SIBAL fabric samples. The table gives no O2 value."""
from common import Table
from tables.helpers import text_value
from tables.saffire import (CMS, MM, SIBAL_INTERPRETATION, SIBAL_NOTE, flow_configuration, is_burn_row,
                            value_with_unit)

ACCESSION = "PSI-100"
SOURCES = ["psi-data/PSI-100/Experimental table/PSI-100_Experimental table_SAFFIRE-3.csv"]
INTERPRETATIONS = [SIBAL_INTERPRETATION]


def build(skips):
    t = Table(SOURCES[0])
    out = []
    for n, row in t.numbered():
        if not is_burn_row(row[0]):
            continue
        tid = row[0].strip()
        out += text_value(t, n, "Material", variable="material", acc=ACCESSION, test_id=tid)
        out += value_with_unit(t, n, "Sample Thickness", skips, acc=ACCESSION, tid=tid, variable="sample_thickness",
                               unit="mm", factors=MM, status="insufficient_evidence", note=SIBAL_NOTE)
        out += value_with_unit(t, n, "Air Flow ", skips, acc=ACCESSION, tid=tid, variable="flow_velocity",
                               unit="cm/s", factors=CMS)
        out += flow_configuration(t, n, "Direction", ACCESSION, tid)
    return out
