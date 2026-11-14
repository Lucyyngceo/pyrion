"""PSI-69 FLEX (Flame Extinguishment Experiment): one row per droplet test.

The CSV drops chemical subscripts in its headers: the composition columns read "O", "N",
"CO" and "He". They are read as O2, N2, CO2 and He because (a) the four fractions of every
row sum to 1 and (b) the FLEX Test Plan (PSI-69 Science Documents) writes the matrices as
"Fuel: C7H16 , Diluent: N2 , Suppressant: CO2" with "XN2 = 1.0 - XO2 - XCO2".
Cells holding an en dash mean "no value" and produce no record.
"""
from decimal import Decimal

from common import MMHG_TO_KPA, Table, join_notes, record
from tables.helpers import diluent_from_fractions, numeric, text_value

ACCESSION = "PSI-69"
SOURCES = ["psi-data/PSI-69/Experimental table/PSI-69_Experimental table_FLEX.csv"]

H_ID, H_NUM = "FLEX Identifier", "FLEX Test #"
H_FUEL = "Fuel"
H_P = "Ambient pressure; mmHg"
H_O2 = "O initial ambient composition; mole fraction"
H_N2 = "N initial ambient composition; mole fraction"
H_CO2 = "CO initial ambient composition; mole fraction"
H_HE = "He initial ambient composition; mole fraction"
H_D0 = "Droplet initial diameter; mm"
H_DEXT = "Visible flame extinction diameter; mm"
H_K = "Burning rate; mm"
H_TB = "Burn time; s"
H_END = "Test end"

SUBSCRIPT_NOTE = "header subscripts lost in the CSV: O, N, CO, He read as O2, N2, CO2, He (see SUMMARY.md)"

INTERPRETATIONS = [
    "FLEX composition headers read \"O\", \"N\", \"CO\", \"He\" (subscripts lost in the CSV). They are read as "
    "O2, N2, CO2 and He: the four fractions of every row sum to 1, and the FLEX Test Plan "
    "(`psi-data/PSI-69/Science Documents/PSI-69_Science Documents_FLEX_Test_Plan.pdf`, Table 8) writes "
    "\"Fuel: C7H16 , Diluent: N2 , Suppressant: CO2\" and \"XN2 = 1.0 - XO2 - XCO2\".",
    "FLEX `diluent` is derived per row from the N2, CO2 and He fractions: the single non-zero species, "
    "or `mixed` when N2 is combined with CO2 or He.",
    "FLEX \"Burning rate; mm\" is kept as `insufficient_evidence`: the unit written in the header (mm) "
    "is not a unit of burning rate, and the table does not state the right one.",
]


def build(skips):
    t = Table(SOURCES[0])
    out = []
    ids = [t.cell(n, H_ID).strip() for n, _ in t.numbered()]
    for n, _ in t.numbered():
        ident = t.cell(n, H_ID).strip()
        tnum = t.cell(n, H_NUM).strip()
        tid = ident if ident and ids.count(ident) == 1 else f"{ident or 'no identifier'} (FLEX Test #{tnum})"
        kw = dict(acc=ACCESSION, test_id=tid)

        # composition must close to 1 for the subscript reading to hold
        comp = [t.cell(n, h).strip() for h in (H_O2, H_N2, H_CO2, H_HE)]
        closes = all(c.replace(".", "", 1).isdigit() for c in comp) and abs(sum(Decimal(c) for c in comp) - 1) <= Decimal("0.011")
        comp_note = SUBSCRIPT_NOTE if closes else join_notes(SUBSCRIPT_NOTE, "fractions of this row do not sum to 1")

        out += text_value(t, n, H_FUEL, variable="fuel", **kw)
        out += numeric(t, n, H_P, skips, variable="pressure", unit="kPa", unit_original="mmHg",
                       factor=MMHG_TO_KPA, how="mmHg x 101.325/760", **kw)
        out += numeric(t, n, H_O2, skips, variable="o2_mole_fraction", unit="1", unit_original="mole fraction",
                       note=join_notes("initial ambient composition", comp_note), **kw)
        if closes:
            out += diluent_from_fractions(t, n, {H_N2: "N2", H_CO2: "CO2", H_HE: "He"},
                                          note=join_notes("initial ambient composition", SUBSCRIPT_NOTE), **kw)
        out += numeric(t, n, H_D0, skips, variable="droplet_diameter_initial", unit="mm", unit_original="mm", **kw)
        out += numeric(t, n, H_DEXT, skips, variable="outcome:visible_flame_extinction_diameter", unit="mm",
                       unit_original="mm", **kw)
        out += numeric(t, n, H_K, skips, variable="outcome:burning_rate", unit="mm", unit_original="mm",
                       status="insufficient_evidence",
                       note="header gives the unit 'mm', which is not a unit of burning rate; the true unit "
                            "(likely a superscript lost in the CSV) is not stated", **kw)
        out += numeric(t, n, H_TB, skips, variable="outcome:burn_time", unit="s", unit_original="s", **kw)
        out += text_value(t, n, H_END, variable="outcome:test_end", note="as written in the table", **kw)
    return out
