"""PSI-102 SAME (Smoke and Aerosol Measurement Experiment): heated samples producing smoke.

Rows 5-8 read "<material>: same conditions as 1-4"; the material name before the colon is
recorded, and no flow value is copied from rows 1-4.
"""
from common import Table, record
from tables.helpers import numeric

ACCESSION = "PSI-102"
SOURCES = ["psi-data/PSI-102/Experimental table/PSI-102_Experimental table_SAME.csv"]
INTERPRETATIONS = [
    "SAME rows 5-8 read \"<material>: same conditions as 1-4\": only the material is recorded; their conditions are "
    "not copied from rows 1-4. SAME heats samples to produce smoke; its air flow is the flow over the heated sample.",
    "SAME air-flow values are `insufficient_evidence`: the PSI table matches the pre-flight test matrix (Baseline "
    "Concept Description, page 13), not the flown log (Final Science Report, Appendix A), and the Final Report says the "
    "system was designed for 2 to 8 cm/s while the table lists 10 cm/s (verificador finding).",
]


def build(skips):
    t = Table(SOURCES[0])
    out = []
    for n, _ in t.numbered():
        tid = t.cell(n, "Sample #").strip()
        cell = t.cell(n, "Sample Material  ")
        name = cell.split(":")[0].strip()
        if name:
            out.append(record(t, n, "Sample Material  ", accession=ACCESSION, test_id=tid, variable="material",
                              value=name, unit="", value_original=name if ":" in cell else cell,
                              note="cell continues: " + cell.split(":", 1)[1].strip() if ":" in cell else ""))
        out += numeric(t, n, "Air Flow (cm/s)", skips, variable="flow_velocity", unit="cm/s", unit_original="cm/s",
                       status="insufficient_evidence",
                       note="planned test matrix, not the flown log (see SUMMARY.md); air flow over the heated sample",
                       acc=ACCESSION, test_id=tid)
    return out
