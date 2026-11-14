"""PSI-10 ACME/Flame Design: spherical porous burner, normal and inverse flames.

PSI shows no license for PSI-10 (checked 2026-11-14): every record says so in its note.
Normal flames: "XO2 (init)" / "XO2 (final)" are ambient O2 mole fractions.
Inverse flames: "XO2" is the O2 of the stream issued from the burner -> burner_o2_mole_fraction.
Cells reading RAMP / RAMPED / LOW O2 hold no single value and produce no record.
"""
from common import ATM_TO_KPA, Table, join_notes, record
from tables.helpers import numeric, text_value

ACCESSION = "PSI-10"
SOURCES = ["psi-data/PSI-10/Experimental table/PSI-10_Experimental table_Flame Design_Normal Flame.csv",
           "psi-data/PSI-10/Experimental table/PSI-10_Experimental table_Flame Design_Inverse Flame.csv"]
LICENSE = "license not stated"

INTERPRETATIONS = [
    "Flame Design inverse-flame \"XO2\" is the O2 mole fraction of the burner stream "
    "(`burner_o2_mole_fraction`), not the ambient O2.",
    "PSI-10 has no license on its PSI page or record (checked 2026-11-14): every record carries "
    "`license not stated` in its note.",
]


def build(skips):
    out = []
    t = Table(SOURCES[0])
    for n, _ in t.numbered():
        tid = t.cell(n, "Test").strip()
        kw = dict(acc=ACCESSION, test_id=tid)
        out += _flame_type(t, n, tid)
        out += text_value(t, n, "Fuel", variable="fuel", note=LICENSE, **kw)
        out += numeric(t, n, "XO2 (init)", skips, variable="o2_mole_fraction", unit="1",
                       note=join_notes("ambient, initial", LICENSE), **kw)
        out += numeric(t, n, "XO2 (final)", skips, variable="outcome:o2_mole_fraction_after_test", unit="1",
                       note=join_notes("ambient, final", LICENSE), **kw)
        out += _pressures(t, n, skips, kw)
    t = Table(SOURCES[1])
    for n, _ in t.numbered():
        tid = t.cell(n, "Test").strip()
        kw = dict(acc=ACCESSION, test_id=tid)
        out += _flame_type(t, n, tid)
        out += numeric(t, n, "XO2", skips, variable="burner_o2_mole_fraction", unit="1",
                       note=join_notes("inverse flame: O2 of the stream issued from the burner", LICENSE), **kw)
        out += _pressures(t, n, skips, kw)
    return out


def _pressures(t, n, skips, kw):
    out = numeric(t, n, "pinit (atm)", skips, variable="pressure", unit="kPa", unit_original="atm",
                  factor=ATM_TO_KPA, how="atm x 101.325", note=join_notes("initial", LICENSE), **kw)
    out += numeric(t, n, "pfinal (atm)", skips, variable="outcome:pressure_after_test", unit="kPa",
                   unit_original="atm", factor=ATM_TO_KPA, how="atm x 101.325", note=join_notes("final", LICENSE), **kw)
    return out


def _flame_type(t, n, tid):
    v = t.cell(n, "Flame Type").strip().lower()
    if v not in ("normal", "inverse"):
        return []
    return [record(t, n, "Flame Type", accession=ACCESSION, test_id=tid, variable="flame_type", value=v,
                   unit="", note=LICENSE)]
