"""PSI-26 BASS (Burning and Suppression of Solids).

The PSI experimental table gives only date, test numbers, sample number and material.
The as-run test matrix (PSI-26 Science Documents, sheet "as run matrix", headers on Excel
row 3) adds, per test, the ISS environment at test time: "O2 % by volume" and
"pressure, atm". Both files are read by code and joined on the as-run test number.

The as-run "O2 % by volume" cells hold fractions (0.221), not percentages: they are kept as
fractions and the note says so. Both columns sit under the header group "ISS
environment"; the table does not say where they were measured.
"""
from decimal import Decimal

from common import ATM_TO_KPA, Sheet, Table, record
from tables.helpers import numeric, text_value

ACCESSION = "PSI-26"
SOURCES = ["psi-data/PSI-26/Experimental table/PSI-26_Experimental table_BASS.csv",
           "psi-data/PSI-26/Science Documents/PSI-26_Science Documents_As Run_Test Matrix.xlsx"]

H_RUN = "As Run Test #"
H_MAT = "Fuel Sample Material"
X_RUN = "As run test no."
X_O2 = "O2 % by volume"
X_P = "pressure, atm"

ENV_NOTE = "listed under the header group 'ISS environment' of the as-run matrix; the table does not say where it was measured"

INTERPRETATIONS = [
    "BASS as-run matrix (`psi-data/PSI-26/Science Documents/PSI-26_Science Documents_As Run_Test Matrix.xlsx`, "
    "sheet \"as run matrix\"): the column \"O2 % by volume\" holds values such as 0.221 and 0.1707. They are read "
    "as mole fractions (22.1 %, 17.07 %), not as 0.221 %: a flame cannot burn at 0.2 % oxygen and the tests did "
    "burn. Both this column and \"pressure, atm\" sit under the header group \"ISS environment\"; the table "
    "does not say whether they were read in the station cabin or inside the glovebox work volume (values down "
    "to 0.159 suggest a diluted work volume, which is not stated).",
    "BASS rows whose material reads \"SOOT Cleaning\" are not tests and give no record.",
]


def build(skips):
    out = []
    t = Table(SOURCES[0])
    for n, _ in t.numbered():
        tid = t.cell(n, H_RUN).strip()
        mat = t.cell(n, H_MAT).strip()
        if not tid or mat == "SOOT Cleaning":
            continue
        out += text_value(t, n, H_MAT, variable="material", acc=ACCESSION, test_id=tid)

    x = Sheet(SOURCES[1], "as run matrix", header_row=3)
    for n, _ in x.numbered():
        tid = x.cell(n, X_RUN).strip()
        if not tid.isdigit():
            continue
        o2 = x.cell(n, X_O2).strip()
        if o2:
            try:
                ok = Decimal(o2) < 1
            except Exception:
                ok = False
            if ok:
                out.append(record(x, n, X_O2, accession=ACCESSION, test_id=tid, variable="o2_mole_fraction",
                                  value=o2, unit="1", unit_original="% by volume",
                                  note=f"cell holds a fraction although the header says %; {ENV_NOTE}"))
            else:
                skips.add(ACCESSION, x.relpath, n, X_O2, o2, "O2: not a fraction below 1")
        out += numeric(x, n, X_P, skips, variable="pressure", unit="kPa", unit_original="atm",
                       factor=ATM_TO_KPA, how="atm x 101.325", note=ENV_NOTE, acc=ACCESSION, test_id=tid)
    return out
