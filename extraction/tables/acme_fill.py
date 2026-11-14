"""Spreadsheet fill-series artifacts in the ACME day tables (PSI-21, PSI-23).

Dragging a cell down in a spreadsheet increments its last number: "40% CH4" becomes
"40% CH5", "40% CH6", ...; "~21% O2 with N2" becomes "... with N3". Such cells do not
state a real fuel or diluent; their records are insufficient_evidence.
"""
import re

SPECIES = re.compile(r"\b(C\d*H\d+|H\d+|N\d+|He)\b")


def plausible(text: str, fuels) -> bool:
    """True when every species written in `text` is one of `fuels`, N2 or He."""
    return all(s in fuels or s in ("N2", "He") for s in SPECIES.findall(text))
