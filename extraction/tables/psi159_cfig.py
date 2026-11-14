"""PSI-159 ACME CFI-G: spherical porous burner, normal and inverse flames, gaseous fuels.

Normal flames: fuel issues from the burner into an O2-containing ambient; the table gives
the ambient O2 mole fraction before and after each test -> o2_mole_fraction.
Inverse flames: O2 issues from the burner into a fuel-laden ambient; "XO2" is the O2 of
the burner stream -> burner_o2_mole_fraction (never mixed with the ambient axis).
Rows of the inverse table with no test identifier are empty spreadsheet rows.
"""
from common import BAR_TO_KPA, Table, record
from tables.helpers import numeric, text_value

ACCESSION = "PSI-159"
SOURCES = ["psi-data/PSI-159/Experimental table/PSI-159_Experimental table_CFI-G_Normal Flames.csv",
           "psi-data/PSI-159/Experimental table/PSI-159_Experimental table_CFI-G_Inverse Flames.csv"]

INTERPRETATIONS = [
    "CFI-G inverse-flame \"XO2\" is the O2 mole fraction of the stream issued from the burner "
    "(`burner_o2_mole_fraction`), not the ambient O2: in an inverse flame the oxidizer flows from the "
    "burner into a fuel-laden ambient (schema definition of `flame_type`).",
]

P_NOTE = "header says approximate"


def flame_type(t, n, acc, tid):
    cell = t.cell(n, "Flame Type")
    v = cell.strip().lower()
    if v not in ("normal", "inverse"):
        return []
    return [record(t, n, "Flame Type", accession=acc, test_id=tid, variable="flame_type", value=v, unit="")]


def build(skips):
    out = []
    # normal flames
    t = Table(SOURCES[0])
    for n, _ in t.numbered():
        tid = t.cell(n, "Test").strip()
        if not tid:
            continue
        kw = dict(acc=ACCESSION, test_id=tid)
        out += flame_type(t, n, ACCESSION, tid)
        out += text_value(t, n, "Fuel", variable="fuel", **kw)
        out += numeric(t, n, " XO2 before test", skips, variable="o2_mole_fraction", unit="1",
                       note="ambient, before the test", **kw)
        out += numeric(t, n, "XO2  after test", skips, variable="o2_mole_fraction", unit="1",
                       note="ambient, after the test", **kw)
        out += numeric(t, n, "approx p (bar)", skips, variable="pressure", unit="kPa", unit_original="bar",
                       factor=BAR_TO_KPA, how="bar x 100", note=P_NOTE, **kw)
        out += numeric(t, n, "burn time (sec)", skips, variable="outcome:burn_time", unit="s",
                       unit_original="sec", **kw)
        out += text_value(t, n, "Hot ignition", variable="outcome:hot_ignition", note="as written", **kw)
        out += text_value(t, n, "Cool flame?", variable="outcome:cool_flame", note="as written", **kw)
    # inverse flames
    t = Table(SOURCES[1])
    for n, _ in t.numbered():
        tid = t.cell(n, "Test").strip()
        if not tid:
            continue
        kw = dict(acc=ACCESSION, test_id=tid)
        out += flame_type(t, n, ACCESSION, tid)
        out += text_value(t, n, "Fuel", variable="fuel", note="ambient fuel (inverse flame)", **kw)
        out += numeric(t, n, "XO2", skips, variable="burner_o2_mole_fraction", unit="1",
                       note="inverse flame: O2 of the stream issued from the burner", **kw)
        out += numeric(t, n, "approx p (bar)", skips, variable="pressure", unit="kPa", unit_original="bar",
                       factor=BAR_TO_KPA, how="bar x 100", note=P_NOTE, **kw)
        out += numeric(t, n, "burn time (sec)", skips, variable="outcome:burn_time", unit="s",
                       unit_original="sec", **kw)
        out += text_value(t, n, "Hot ignition", variable="outcome:hot_ignition", note="as written", **kw)
    return out
