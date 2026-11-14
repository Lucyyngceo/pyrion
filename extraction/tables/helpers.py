"""Column mappers shared by several adapters."""
from __future__ import annotations

import re
from decimal import Decimal

from common import convert, is_number, join_notes, record, value_range

LIST_SPLIT = re.compile(r"\s*(?:;|,|\bor\b)\s*")
RANGE_RE = re.compile(r"^\s*~?\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*(?:-|to|–)\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*$")
NO_VALUE = {"–", "—", "-", "n/a", "N/A", "none", "None", "RAMPED"}
APPROX_RE = re.compile(r"^\s*~\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*$")


def numeric(t, n, header, skips, *, acc, test_id, variable, unit, unit_original="",
            factor=None, offset=None, how="", note="", status="extracted", text=None):
    """One record from a cell holding a plain number, an approximate number (~ x) or a
    range (a - b, a to b). Anything else is reported to `skips` and produces nothing."""
    cell = t.cell(n, header) if text is None else text
    s = cell.strip()
    if not s:
        return []
    if s in NO_VALUE:
        skips.add(acc, t.relpath, n, header, cell, "cell marks 'no value'")
        return []
    m_r = RANGE_RE.match(s)
    m_a = APPROX_RE.match(s)
    if is_number(s):
        v, cnote = convert(s, factor, offset, how)
        return [record(t, n, header, accession=acc, test_id=test_id, variable=variable, value=v, unit=unit,
                       value_original=s if text is not None else cell, unit_original=unit_original,
                       status=status, note=join_notes(cnote, note))]
    if m_a:
        v, cnote = convert(m_a.group(1), factor, offset, how)
        return [record(t, n, header, accession=acc, test_id=test_id, variable=variable, value=v, unit=unit,
                       value_original=s if text is not None else cell, unit_original=unit_original,
                       status=status, note=join_notes("approximate (~) in source", cnote, note))]
    if m_r:
        lo, cnote = convert(m_r.group(1), factor, offset, how)
        hi, _ = convert(m_r.group(2), factor, offset, how)
        approx = "approximate (~) in source" if s.startswith("~") else ""
        return [record(t, n, header, accession=acc, test_id=test_id, variable=variable,
                       value=value_range(lo, hi), unit=unit,
                       value_original=s if text is not None else cell, unit_original=unit_original,
                       status=status, note=join_notes(approx, "range stated in one cell", cnote, note))]
    skips.add(acc, t.relpath, n, header, cell, f"{variable}: not a number, approximate number or range")
    return []


def numeric_list(t, n, header, skips, **kw):
    """A cell listing discrete values ('0.17; 0.21;0.25; 0.3', '0.5; 1.0; or 3.0') gives one
    record per listed value; value_original is the listed item as written."""
    cell = t.cell(n, header)
    items = [i for i in LIST_SPLIT.split(cell.strip()) if i.strip()]
    if len(items) <= 1:
        return numeric(t, n, header, skips, **kw)
    out = []
    note = kw.pop("note", "")
    for item in items:
        out += numeric(t, n, header, skips, text=item.strip(),
                       note=join_notes(f"one of the values listed in the cell {cell.strip()!r}", note), **kw)
    return out


def text_value(t, n, header, *, acc, test_id, variable, note="", value=None):
    cell = t.cell(n, header)
    if not cell.strip():
        return []
    return [record(t, n, header, accession=acc, test_id=test_id, variable=variable,
                   value=(value if value is not None else cell.strip()), unit="", value_original=cell,
                   note=note)]


def diluent_from_fractions(t, n, columns, *, acc, test_id, note=""):
    """`columns` maps header -> diluent species. diluent = the single non-zero species,
    or `mixed` when more than one is non-zero (schema value convention)."""
    present, headers = [], list(columns)
    for h in headers:
        c = t.cell(n, h).strip()
        if not is_number(c):
            return []
        if Decimal(c) > 0:
            present.append(columns[h])
    if not present:
        return []
    value = present[0] if len(present) == 1 else "mixed"
    extra = f"non-zero: {', '.join(present)}" if len(present) > 1 else ""
    return [record(t, n, tuple(headers), accession=acc, test_id=test_id, variable="diluent",
                   value=value, unit="", note=join_notes(extra, note))]
