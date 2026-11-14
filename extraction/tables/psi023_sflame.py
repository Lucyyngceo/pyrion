"""PSI-23 ACME s-Flame (spherical diffusion flames): one row per test day.

"Atmosphere*" reads e.g. "~21% O2 with N2" or "~30% and ~21% O2 with He". The note marked *
says the atmosphere is about 1 atm and that "O2% drops with vitiation": O2 values are
approximate initial values. The diluent follows "with". The column shows a spreadsheet
fill series ("with N3", "with N4", ...): those diluents (and fuels written "with N3") are
insufficient_evidence.
"""
import re

from common import PERCENT_TO_FRACTION, Table, convert, join_notes, record
from tables.acme_fill import plausible

ACCESSION = "PSI-23"
SOURCES = ["psi-data/PSI-23/Experimental table/PSI-23_Experimental table_ACME s-Flame.csv"]
H_ATM = "Atmosphere*"
H_FUEL = "Fuel Bottle"
INTERPRETATIONS = [
    "s-Flame \"Atmosphere*\" cells (\"~21% O2 with N2\") give approximate initial O2 (the table's note: "
    "\"O2% drops with vitiation\") and the diluent after \"with\". The column shows a spreadsheet fill series "
    "(\"with N3\", \"with N4\", \"with N5\", \"with N6\"): those diluents, and fuels written \"with N3\", are "
    "`insufficient_evidence`.",
]
O2_RE = re.compile(r"~(\d+(?:\.\d+)?)%")
DIL_RE = re.compile(r"with\s+(N\d+|He)\b")
O2_NOTE = "approximate (~) in source; initial value (the table's note: O2% drops with vitiation)"


def build(skips):
    t = Table(SOURCES[0])
    out = []
    for n, _ in t.numbered():
        tid = t.cell(n, "Test Day*").strip()
        if not tid:
            continue
        atm = t.cell(n, H_ATM)
        if "O2" in atm:
            for m in O2_RE.finditer(atm):
                v, how = convert(m.group(1), PERCENT_TO_FRACTION, None, "percent x 0.01")
                out.append(record(t, n, H_ATM, accession=ACCESSION, test_id=tid, variable="o2_mole_fraction",
                                  value=v, unit="1", value_original=m.group(0), unit_original="%",
                                  note=join_notes(O2_NOTE, how)))
        d = DIL_RE.search(atm)
        if d:
            ok = d.group(1) in ("N2", "He")
            out.append(record(t, n, H_ATM, accession=ACCESSION, test_id=tid, variable="diluent",
                              value=d.group(1) if ok else atm.strip(), unit="", value_original=d.group(0),
                              status="extracted" if ok else "insufficient_evidence",
                              note="" if ok else f"{d.group(1)!r} is not a gas: spreadsheet fill-series artifact"))
        fuel = t.cell(n, H_FUEL)
        if fuel.strip():
            ok = plausible(fuel, ("CH4", "C2H4", "H2"))
            out.append(record(t, n, H_FUEL, accession=ACCESSION, test_id=tid, variable="fuel", value=fuel.strip(),
                              unit="", value_original=fuel, status="extracted" if ok else "insufficient_evidence",
                              note="" if ok else "contains a spreadsheet fill-series artifact (e.g. 'N3')"))
    return out
