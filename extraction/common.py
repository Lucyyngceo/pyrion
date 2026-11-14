"""Shared helpers for building PYRION condition records.

Every record follows schema/condition_record.schema.json. This module only
reads files under data/raw/ and never writes there.
"""
from __future__ import annotations

import csv
import io
import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_EVEN, localcontext
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
RAW = REPO / "data" / "raw"
SCHEMA = REPO / "schema" / "condition_record.schema.json"
OUT_DIR = REPO / "data" / "conditions"

FIELDS = [
    "accession", "test_id", "variable", "value", "unit", "value_original", "unit_original",
    "method", "source_file", "source_location", "quote", "status", "note",
]

# Exact conversion factors. Each conversion is written into the record's note.
ATM_TO_KPA = Decimal("101.325")
BAR_TO_KPA = Decimal("100")
MMHG_TO_KPA = Decimal("101.325") / Decimal("760")  # 1 atm = 760 mmHg
PSI_TO_KPA = Decimal("6.894757293168")
INCH_TO_MM = Decimal("25.4")
CM_TO_MM = Decimal("10")
MICRON_TO_MM = Decimal("0.001")
PERCENT_TO_FRACTION = Decimal("0.01")
CELSIUS_TO_KELVIN = Decimal("273.15")

SIG_DIGITS = 6  # significant digits kept after an inexact conversion

_NUM_RE = re.compile(r"^[+-]?(\d+\.?\d*|\.\d+)$")


def is_number(text: str) -> bool:
    return bool(_NUM_RE.match(text.strip()))


def dec(text: str) -> Decimal:
    t = text.strip()
    if not is_number(t):
        raise ValueError(f"not a plain number: {text!r}")
    return Decimal(t)


def fmt(d: Decimal) -> str:
    """Plain decimal text, no exponent, no trailing zeros after the point."""
    s = format(d, "f")
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    if s in ("-0", ""):
        s = "0"
    return s


def round_sig(d: Decimal, sig: int = SIG_DIGITS) -> Decimal:
    if d == 0:
        return d
    with localcontext() as ctx:
        ctx.rounding = ROUND_HALF_EVEN
        exp = d.adjusted() - sig + 1
        return d.quantize(Decimal(1).scaleb(exp))


def convert(text: str, factor: Decimal | None = None, offset: Decimal | None = None,
            how: str = "") -> tuple[str, str]:
    """Normalize a numeric cell, optionally multiplying by `factor` and adding `offset`.

    Returns (value, note). Exact results are kept exact. A converted value with more
    than SIG_DIGITS significant digits is rounded to SIG_DIGITS, and the note says so.
    A value read without conversion keeps all the digits of the source.
    """
    d = dec(text)
    if factor is not None:
        d = d * factor
    if offset is not None:
        d = d + offset
    note = how
    if (factor is not None or offset is not None) and len(d.normalize().as_tuple().digits) > SIG_DIGITS:
        d = round_sig(d)
        note = _join(how, f"rounded to {SIG_DIGITS} significant digits")
    return fmt(d), note


def value_range(lo: str, hi: str) -> str:
    a, b = Decimal(lo), Decimal(hi)
    if a > b:
        lo, hi = hi, lo
    return f"{lo}..{hi}"


class Table:
    """A CSV table from data/raw, read exactly as stored.

    Rows are numbered 1..N after the header row (schema convention).
    """

    def __init__(self, relpath: str, header_row: int = 0):
        self.relpath = relpath
        raw = (RAW / relpath).read_bytes()
        try:
            text = raw.decode("utf-8-sig")
            self.encoding = "utf-8"
        except UnicodeDecodeError:
            text = raw.decode("cp1252")
            self.encoding = "cp1252"
        rows = list(csv.reader(io.StringIO(text, newline="")))
        self.headers = rows[header_row]
        self.rows = rows[header_row + 1:]
        self.sheet = None

    def col(self, header: str) -> int:
        idx = [i for i, h in enumerate(self.headers) if h == header]
        if len(idx) != 1:
            raise KeyError(f"{self.relpath}: header {header!r} found {len(idx)} times")
        return idx[0]

    def cell(self, n: int, header: str) -> str:
        row = self.rows[n - 1]
        i = self.col(header)
        return row[i] if i < len(row) else ""

    def numbered(self):
        for n, row in enumerate(self.rows, start=1):
            yield n, row

    def location(self, n: int, *headers: str) -> str:
        parts = []
        if self.sheet is not None:
            parts.append(f"sheet={self.sheet}")
        parts.append(f"row={n}")
        parts.extend(f"column={h}" for h in headers)
        return ";".join(parts)


class Sheet(Table):
    """One worksheet of an .xlsx file under data/raw, read with openpyxl (values only).

    `header_row` is the 1-based Excel row that holds the column headers. Data rows are
    numbered 1..N below it; the Excel row number is added to each record's note.
    """

    def __init__(self, relpath: str, sheet: str, header_row: int):
        import openpyxl  # optional dependency, only for xlsx sources

        self.relpath = relpath
        self.encoding = "xlsx"
        wb = openpyxl.load_workbook(RAW / relpath, read_only=True, data_only=True)
        ws = wb[sheet]
        rows = [list(r) for r in ws.iter_rows(values_only=True)]
        wb.close()
        self.sheet = sheet
        self.header_row = header_row
        self.headers = ["" if h is None else str(h) for h in rows[header_row - 1]]
        self.rows = [["" if c is None else _cell_text(c) for c in r] for r in rows[header_row:]]

    def excel_row(self, n: int) -> int:
        return self.header_row + n


def _cell_text(c) -> str:
    if isinstance(c, float):
        r = repr(c)
        return r[:-2] if r.endswith(".0") else r
    return str(c)


def record(table: Table, n: int, headers, *, accession: str, test_id: str, variable: str,
           value: str, unit: str, value_original: str | None = None, unit_original: str = "",
           status: str = "extracted", note: str = "") -> dict:
    """Build one `method=table` record. `headers` is one header or a tuple of headers."""
    if isinstance(headers, str):
        headers = (headers,)
    if value_original is None:
        value_original = " | ".join(table.cell(n, h) for h in headers)
    if isinstance(table, Sheet):
        note = _join(note, f"Excel row {table.excel_row(n)}")
    return {
        "accession": accession,
        "test_id": test_id,
        "variable": variable,
        "value": value,
        "unit": unit,
        "value_original": value_original,
        "unit_original": unit_original,
        "method": "table",
        "source_file": table.relpath.replace("\\", "/"),
        "source_location": table.location(n, *headers),
        "quote": " | ".join(headers),
        "status": status,
        "note": note,
    }


def _join(*parts: str) -> str:
    return "; ".join(p for p in parts if p)


join_notes = _join


class Skips:
    """Collects cells an adapter deliberately did not turn into records, with the reason."""

    def __init__(self):
        self.items: list[dict] = []

    def add(self, accession, relpath, n, header, text, reason):
        self.items.append({"accession": accession, "source_file": relpath, "row": n,
                           "column": header, "cell": text, "reason": reason})
