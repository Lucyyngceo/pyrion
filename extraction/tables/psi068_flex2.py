"""PSI-68 FLEX-2: a conditions table with one row per fuel (not one row per test).

Each cell states the range or the list of values covered for that fuel. test_id is the
fuel as written in the first column, and every record says it is a per-fuel summary.
"""
from common import ATM_TO_KPA, CELSIUS_TO_KELVIN, Table, join_notes, record
from tables.helpers import numeric, numeric_list, text_value

ACCESSION = "PSI-68"
SOURCES = ["psi-data/PSI-68/Experimental table/PSI-68_Experimental table_Flex2.csv"]

H_FUEL = "Sample (Fuel Type)"
H_D0 = "Initial Droplet Diameter (mm)"
H_MIX = "Ambient Gas Mixture "
H_O2 = "Oxygen Mole Fraction"
H_P = "Ambient Pressure (atm)"
H_T = " Ambient Temperature (C)"
H_U = "Flow Velocity (cm/s)"

ROW_NOTE = "per-fuel conditions summary, not a single test"

INTERPRETATIONS = [
    "FLEX-2 table rows are fuels, not tests: each cell gives the range or list of conditions "
    "covered for that fuel. `test_id` is the fuel as written; a combination of the listed values "
    "is not claimed to have been tested.",
    "FLEX-2 \"Ambient Gas Mixture\" reads \"O2/N2 or O2/He\": one `diluent` record per alternative (N2, He).",
]

MIX = {"O2/N2": "N2", "O2/He": "He"}


def build(skips):
    t = Table(SOURCES[0])
    out = []
    for n, _ in t.numbered():
        fuel = t.cell(n, H_FUEL).strip()
        kw = dict(acc=ACCESSION, test_id=fuel)
        out += text_value(t, n, H_FUEL, variable="fuel", note=ROW_NOTE, **kw)
        out += numeric(t, n, H_D0, skips, variable="droplet_diameter_initial", unit="mm", unit_original="mm",
                       note=ROW_NOTE, **kw)
        mix = t.cell(n, H_MIX)
        parts = [p.strip() for p in mix.split(" or ")]
        if all(p in MIX for p in parts):
            for p in parts:
                out.append(record(t, n, H_MIX, accession=ACCESSION, test_id=fuel, variable="diluent",
                                  value=MIX[p], unit="", value_original=p,
                                  note=join_notes(f"one of the alternatives in the cell {mix.strip()!r}", ROW_NOTE)))
        else:
            skips.add(ACCESSION, t.relpath, n, H_MIX, mix, "diluent: mixture not recognised")
        out += numeric_list(t, n, H_O2, skips, variable="o2_mole_fraction", unit="1", unit_original="",
                            note=ROW_NOTE, **kw)
        out += numeric_list(t, n, H_P, skips, variable="pressure", unit="kPa", unit_original="atm",
                            factor=ATM_TO_KPA, how="atm x 101.325", note=ROW_NOTE, **kw)
        out += numeric(t, n, H_T, skips, variable="ambient_temperature", unit="K", unit_original="C",
                       offset=CELSIUS_TO_KELVIN, how="C + 273.15", note=ROW_NOTE, **kw)
        out += numeric(t, n, H_U, skips, variable="flow_velocity", unit="cm/s", unit_original="cm/s",
                       note=ROW_NOTE, **kw)
    return out
