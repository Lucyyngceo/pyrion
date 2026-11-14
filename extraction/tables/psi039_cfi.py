"""PSI-39 CFI (Cool Flames Investigation): one row per droplet test.

Pressure cells carry their unit ("1 atm"). The Oxygen, Nitrogen and Helium columns give
no unit; in every row they sum to 1, so they are read as fractions of the ambient.
"""
import re

from common import ATM_TO_KPA, Table, convert, join_notes, record
from tables.helpers import diluent_from_fractions, numeric, text_value

ACCESSION = "PSI-39"
SOURCES = ["psi-data/PSI-39/Experimental table/PSI-39_Experimental table_CFI.csv"]

H_ID = "Flex Number"
H_P = "Pressure"
H_O2 = "Oxygen"
H_N2 = "Nitrogen"
H_HE = "Helium"
H_FUEL = "Fuel "

FRACTION_NOTE = "header gives no unit; Oxygen + Nitrogen + Helium = 1 in every row (read as ambient fractions)"
INTERPRETATIONS = [
    "CFI \"Oxygen\", \"Nitrogen\" and \"Helium\" columns carry no unit. They are read as ambient mole "
    "fractions because the three sum to 1 in every row; `diluent` is N2, He or `mixed` from the two inert columns.",
]

P_RE = re.compile(r"^\s*(\d*\.?\d+)\s*atm\s*$")


def build(skips):
    t = Table(SOURCES[0])
    out = []
    for n, _ in t.numbered():
        kw = dict(acc=ACCESSION, test_id=t.cell(n, H_ID).strip())
        out += text_value(t, n, H_FUEL, variable="fuel", **kw)
        cell = t.cell(n, H_P)
        m = P_RE.match(cell)
        if m:
            v, note = convert(m.group(1), ATM_TO_KPA, None, "atm x 101.325")
            out.append(record(t, n, H_P, accession=ACCESSION, test_id=kw["test_id"], variable="pressure",
                              value=v, unit="kPa", unit_original="atm", note=note))
        elif cell.strip():
            skips.add(ACCESSION, t.relpath, n, H_P, cell, "pressure: not '<number> atm'")
        comp = [t.cell(n, h).strip() for h in (H_O2, H_N2, H_HE)]
        try:
            closes = abs(sum(float(c) for c in comp) - 1) < 0.011
        except ValueError:
            closes = False
        out += numeric(t, n, H_O2, skips, variable="o2_mole_fraction", unit="1",
                       note=FRACTION_NOTE if closes else "header gives no unit; fractions of this row do not sum to 1",
                       status="extracted" if closes else "insufficient_evidence", **kw)
        if closes:
            out += diluent_from_fractions(t, n, {H_N2: "N2", H_HE: "He"}, note="header gives no unit", **kw)
    return out
