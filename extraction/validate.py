"""Validate PYRION condition records against the shared contract. Standard library only.

    python -I extraction/validate.py                 # data/conditions/*.csv
    python -I extraction/validate.py --no-source     # skip the check against data/raw/
    python -I extraction/validate.py path/to/file.csv ...

Checks every record against schema/condition_record.schema.json and the rules and
units of schema/README.md. When data/raw/ is present it also re-opens each source:
for a table record the cell at `row`/`column` must hold `value_original`; for a
document record the verbatim `quote` must occur in the source text. PDF, DOCX and
XLSX sources are read with the standard library where possible (DOCX); PDF and XLSX
need PyMuPDF/pypdf and openpyxl and are reported as "not checked" without them.

Exit status 1 and a list of every failure if anything is wrong.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import unicodedata
import zipfile
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path
from xml.etree import ElementTree as ET

REPO = Path(__file__).resolve().parent.parent
RAW = REPO / "data" / "raw"
SCHEMA_JSON = REPO / "schema" / "condition_record.schema.json"
SCHEMA_README = REPO / "schema" / "README.md"
CONDITIONS = REPO / "data" / "conditions"

NUM = r"[+-]?(?:\d+\.?\d*|\.\d+)"
NUM_RE = re.compile(rf"^{NUM}$")
RANGE_RE = re.compile(rf"^({NUM})\.\.({NUM})$")
TABLE_LOC_RE = re.compile(r"^(?:sheet=([^;]+);)?row=(\d+)((?:;column=.+?)+)$")
DOC_LOC_RE = re.compile(r"^(page|section|paragraph|sheet|row|slide)=.+")
GRAVITY_WORDS = re.compile(
    r"micro-?\s?gravity|low[- ]gravity|low-g|reduced[- ]gravity|normal[- ]gravity|1-g\b|"
    r"\b0-g\b|weightless|free[- ]fall|zero[- ]gravity|\bg-level|lunar gravity|partial[- ]gravity",
    re.IGNORECASE)
NONNEGATIVE = {"pressure", "flow_velocity", "sample_thickness", "droplet_diameter_initial",
               "ambient_temperature", "gravity_level"}
FRACTIONS = {"o2_mole_fraction", "burner_o2_mole_fraction"}


# ---------------------------------------------------------------- contract
def load_contract():
    schema = json.loads(SCHEMA_JSON.read_text(encoding="utf-8"))
    required = schema["required"]
    props = schema["properties"]
    var_re = re.compile(props["variable"]["pattern"])
    value_enum, unit_const = {}, {}
    for rule in schema.get("allOf", []):
        cond = rule["if"]["properties"]["variable"]
        names = [cond["const"]] if "const" in cond else list(cond.get("enum", []))
        then = rule["then"]["properties"]
        for name in names:
            if "value" in then:
                value_enum[name] = set(then["value"]["enum"])
            if "unit" in then:
                unit_const[name] = then["unit"]["const"]
    # Continuous axes and their units, from the README table.
    continuous = {}
    text = SCHEMA_README.read_text(encoding="utf-8")
    section = re.search(r"\*\*Continuous axes.*?\n(.*?)\n\n", text, re.S)
    if not section:
        raise SystemExit("schema/README.md: continuous-axes table not found")
    for m in re.finditer(r"^\| `([a-z0-9_]+)` \| `([^`]*)`", section.group(1), re.M):
        continuous[m.group(1)] = m.group(2)
    flow_cfg = re.search(r"`flow_configuration` \(([^)]*)\)", text)
    if flow_cfg:
        value_enum.setdefault("flow_configuration", set(re.findall(r"`([a-z]+)`", flow_cfg.group(1))))
    return {"required": required, "props": props, "var_re": var_re, "value_enum": value_enum,
            "unit_const": unit_const, "continuous": continuous,
            "fields": list(props.keys())}


# ---------------------------------------------------------------- text normalization
_TRANS = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-",
                        "—": "-", "−": "-", " ": " ", "­": "", "ﬁ": "fi",
                        "ﬂ": "fl"})


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).translate(_TRANS)
    return re.sub(r"\s+", " ", s).strip()


def norm_loose(s: str) -> str:
    """Also joins words hyphenated across PDF line breaks."""
    return re.sub(r"(\w)- (\w)", r"\1\2", norm(s))


# ---------------------------------------------------------------- source readers
class Sources:
    def __init__(self):
        self.cache = {}
        self.unchecked = Counter()

    def table(self, relpath: str, sheet: str | None):
        key = ("table", relpath, sheet)
        if key not in self.cache:
            self.cache[key] = self._read_table(relpath, sheet)
        return self.cache[key]

    def _read_table(self, relpath, sheet):
        path = RAW / relpath
        if sheet is None:
            raw = path.read_bytes()
            try:
                text = raw.decode("utf-8-sig")
            except UnicodeDecodeError:
                text = raw.decode("cp1252")
            rows = list(csv.reader(io.StringIO(text, newline="")))
            return {"headers": rows[0], "rows": rows[1:], "header_row": 1}
        try:
            import openpyxl  # not standard library: optional
        except ImportError:
            return None
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        rows = [list(r) for r in wb[sheet].iter_rows(values_only=True)]
        wb.close()
        return {"rows_raw": rows}

    def squeezed(self, relpath: str, text: str) -> str:
        key = ("squeezed", relpath)
        if key not in self.cache:
            self.cache[key] = re.sub(r"\s+", "", norm_loose(text))
        return self.cache[key]

    def text(self, relpath: str):
        key = ("text", relpath)
        if key not in self.cache:
            self.cache[key] = self._read_text(relpath)
        return self.cache[key]

    def _read_text(self, relpath):
        path = RAW / relpath
        suffix = path.suffix.lower()
        if suffix == ".json":
            data = json.loads(path.read_text(encoding="utf-8"))
            out = []

            def walk(x):
                if isinstance(x, dict):
                    for v in x.values():
                        walk(v)
                elif isinstance(x, list):
                    for v in x:
                        walk(v)
                elif isinstance(x, str):
                    out.append(x)
            walk(data)
            return "\n".join(out)
        if suffix in (".csv", ".txt", ".md"):
            raw = path.read_bytes()
            try:
                return raw.decode("utf-8-sig")
            except UnicodeDecodeError:
                return raw.decode("cp1252")
        if suffix == ".docx":
            with zipfile.ZipFile(path) as z:
                xml = z.read("word/document.xml")
            ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
            root = ET.fromstring(xml)
            paras = ["".join(t.text or "" for t in p.iter(ns + "t")) for p in root.iter(ns + "p")]
            return "\n".join(paras)
        if suffix == ".pdf":
            try:
                import fitz  # PyMuPDF, optional
                with fitz.open(path) as doc:
                    return "\n".join(page.get_text() for page in doc)
            except ImportError:
                pass
            try:
                import pypdf  # optional
                return "\n".join((p.extract_text() or "") for p in pypdf.PdfReader(str(path)).pages)
            except ImportError:
                return None
        if suffix == ".xlsx":
            try:
                import openpyxl
            except ImportError:
                return None
            wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
            out = []
            for ws in wb.worksheets:
                for r in ws.iter_rows(values_only=True):
                    out.extend(str(c) for c in r if c is not None)
            wb.close()
            return "\n".join(out)
        return None


# ---------------------------------------------------------------- checks
def is_num(s):
    return bool(NUM_RE.match(s))


def check_record(rec, ctx, errors, where):
    def err(msg):
        errors.append(f"{where}: {msg}")

    c = ctx["contract"]
    for f in c["required"]:
        if f not in rec:
            err(f"missing field {f}")
            return
    for f, spec in c["props"].items():
        v = rec.get(f, "")
        if spec.get("minLength") and len(v) < spec["minLength"]:
            err(f"{f} is empty")
        if "pattern" in spec and v and not re.search(spec["pattern"], v):
            err(f"{f}={v!r} does not match {spec['pattern']}")
        if "enum" in spec and v not in spec["enum"]:
            err(f"{f}={v!r} not in {spec['enum']}")

    var, val, unit, status, method = (rec["variable"], rec["value"], rec["unit"],
                                      rec["status"], rec["method"])
    if var in c["value_enum"] and status != "insufficient_evidence" and val not in c["value_enum"][var]:
        err(f"{var}={val!r} not in {sorted(c['value_enum'][var])}")
    if var in c["unit_const"] and unit != c["unit_const"][var]:
        err(f"{var} unit must be {c['unit_const'][var]!r}, got {unit!r}")
    if var in c["continuous"]:
        if unit != c["continuous"][var]:
            err(f"{var} unit must be {c['continuous'][var]!r}, got {unit!r}")
        if status != "insufficient_evidence":
            m = RANGE_RE.match(val)
            nums = [m.group(1), m.group(2)] if m else ([val] if is_num(val) else None)
            if nums is None:
                err(f"{var} value {val!r} is neither a number nor lo..hi")
            else:
                ds = [Decimal(x) for x in nums]
                if m and ds[0] > ds[1]:
                    err(f"range {val!r} is not ascending")
                if var in FRACTIONS and not all(0 <= d <= 1 for d in ds):
                    err(f"{var} value {val!r} outside 0..1")
                if var in NONNEGATIVE and any(d < 0 for d in ds):
                    err(f"{var} value {val!r} is negative")
    if (var not in c["continuous"] and var not in c["value_enum"] and not var.startswith("outcome:")
            and unit):
        err(f"descriptive variable {var} must have an empty unit")
    if rec["value_original"] != rec["value_original"].strip() and method == "document":
        err("value_original has leading/trailing spaces")
    if rec["accession"] != ctx["file_accession"]:
        err(f"accession {rec['accession']} in file of {ctx['file_accession']}")

    # Domain guards (schema README rules 2 and 4; data/README notes).
    if var == "gravity_regime":
        if method != "document":
            err("gravity_regime must come from a document statement (rule 4)")
        if not GRAVITY_WORDS.search(rec["quote"]):
            err("gravity_regime quote does not state a gravity condition (rule 4: the platform is not a gravity value)")
        if val == "partial_gravity":
            err("partial_gravity: no PSI combustion investigation is a partial-gravity test "
                "(E-FIELD is an electric-field analog; 'Reduced Gravity' folders hold flight data)")
    if var == "gravity_level" and method != "document":
        err("gravity_level must come from a document statement")
    if rec["accession"] == "PSI-22" and var in ("gravity_level",) :
        err("PSI-22 (E-FIELD) must not carry a gravity_level: the electric field is an analog, not gravity")
    if rec["accession"] == "PSI-10" and "license not stated" not in rec.get("note", ""):
        err("PSI-10 records must carry 'license not stated' in note")

    if method == "table":
        m = TABLE_LOC_RE.match(rec["source_location"])
        if not m:
            err(f"table source_location {rec['source_location']!r} is not row=<n>;column=<header>")
        else:
            headers = m.group(3).split(";column=")[1:]
            if rec["quote"] != " | ".join(headers):
                err("table quote must be the column header(s) verbatim")
            if ctx["check_source"]:
                check_table_source(rec, m.group(1), int(m.group(2)), headers, ctx, err)
    else:
        if not DOC_LOC_RE.match(rec["source_location"]):
            err(f"document source_location {rec['source_location']!r} must start with page=, section=, paragraph=, sheet=, row= or slide=")
        if len(rec["quote"].strip()) < 12:
            err("document quote is too short to be a verbatim sentence")
        if norm(rec["value_original"]).lower() not in norm(rec["quote"]).lower():
            err(f"value_original {rec['value_original']!r} does not occur in the quote")
        if ctx["check_source"]:
            check_document_source(rec, ctx, err)


def check_table_source(rec, sheet, n, headers, ctx, err):
    path = RAW / rec["source_file"]
    if not path.exists():
        err(f"source file not found: {rec['source_file']}")
        return
    t = ctx["sources"].table(rec["source_file"], sheet)
    if t is None:
        ctx["sources"].unchecked["xlsx table (openpyxl not installed)"] += 1
        return
    if sheet is not None:
        # xlsx: header row = the row whose cells contain all headers; Excel row given in note.
        rows = t["rows_raw"]
        mrow = re.search(r"Excel row (\d+)", rec.get("note", ""))
        if not mrow:
            err("xlsx record must give 'Excel row <r>' in note")
            return
        r = int(mrow.group(1))
        hdr_r = r - n
        header_cells = ["" if h is None else str(h) for h in rows[hdr_r - 1]]
        cells = []
        for h in headers:
            if h not in header_cells:
                err(f"header {h!r} not found in sheet {sheet} row {hdr_r}")
                return
            v = rows[r - 1][header_cells.index(h)]
            cells.append("" if v is None else (repr(v)[:-2] if isinstance(v, float) and repr(v).endswith(".0") else str(v)))
    else:
        for h in headers:
            if h not in t["headers"]:
                err(f"header {h!r} not in {rec['source_file']}")
                return
        if n < 1 or n > len(t["rows"]):
            err(f"row {n} out of range in {rec['source_file']}")
            return
        row = t["rows"][n - 1]
        cells = [row[t["headers"].index(h)] if t["headers"].index(h) < len(row) else "" for h in headers]
    joined = " | ".join(cells)
    vo = rec["value_original"]
    if vo == joined:
        ctx["stats"]["table_exact"] += 1
    elif len(headers) == 1 and vo and vo in cells[0]:
        ctx["stats"]["table_substring"] += 1
    else:
        err(f"value_original {vo!r} != source cell {joined!r}")


def check_document_source(rec, ctx, err):
    path = RAW / rec["source_file"]
    if not path.exists():
        err(f"source file not found: {rec['source_file']}")
        return
    text = ctx["sources"].text(rec["source_file"])
    if text is None:
        ctx["sources"].unchecked[f"{path.suffix.lower()} (reader not available)"] += 1
        return
    q = rec["quote"]
    for part in [p for p in q.split(" [...] ")]:
        if norm(part) in norm(text) or norm_loose(part) in norm_loose(text):
            continue
        if re.sub(r"\s+", "", norm_loose(part)) in ctx["sources"].squeezed(rec["source_file"], text):
            ctx["stats"]["quote_found_ignoring_spaces"] += 1
            continue
        err(f"quote not found in {rec['source_file']}: {part[:90]!r}")
        return
    ctx["stats"]["quote_found"] += 1


# ---------------------------------------------------------------- driver
def validate_file(path: Path, contract, check_source, sources, stats):
    errors = []
    raw = path.read_bytes()
    text = raw.decode("utf-8")
    rows = list(csv.reader(io.StringIO(text, newline="")))
    header = rows[0]
    expected = contract["fields"]
    if header != expected:
        errors.append(f"{path.name}: header {header} != schema field order {expected}")
        return errors, 0
    ctx = {"contract": contract, "file_accession": path.stem, "check_source": check_source,
           "sources": sources, "stats": stats}
    seen = set()
    for i, row in enumerate(rows[1:], start=2):
        where = f"{path.name}:{i}"
        if len(row) != len(header):
            errors.append(f"{where}: {len(row)} fields, expected {len(header)}")
            continue
        rec = dict(zip(header, row))
        key = (rec["test_id"], rec["variable"], rec["value"], rec["source_file"], rec["source_location"])
        if key in seen:
            errors.append(f"{where}: duplicate record {key}")
        seen.add(key)
        check_record(rec, ctx, errors, where)
    return errors, len(rows) - 1


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="*", type=Path)
    ap.add_argument("--no-source", action="store_true", help="do not re-open data/raw sources")
    args = ap.parse_args(argv)
    contract = load_contract()
    files = args.files or sorted(CONDITIONS.glob("PSI-*.csv"))
    if not files:
        print("no condition files found", file=sys.stderr)
        return 1
    check_source = not args.no_source and RAW.exists()
    sources = Sources()
    stats = Counter()
    all_errors, total = [], 0
    for f in files:
        errs, n = validate_file(f, contract, check_source, sources, stats)
        total += n
        all_errors.extend(errs)
        print(f"{f.name}: {n} records, {len(errs)} errors")
    if check_source:
        print(f"source check: {stats['table_exact']} table cells exact, {stats['table_substring']} "
              f"table values found inside their cell, {stats['quote_found']} document quotes found "
              f"({stats['quote_found_ignoring_spaces']} only when PDF spacing is ignored)")
        for what, n in sources.unchecked.items():
            print(f"  not checked: {n} records from {what}")
    else:
        print("source check: skipped (data/raw/ not present or --no-source)")
    if all_errors:
        print(f"\nFAILED: {len(all_errors)} errors in {total} records", file=sys.stderr)
        for e in all_errors[:400]:
            print("  " + e, file=sys.stderr)
        if len(all_errors) > 400:
            print(f"  ... and {len(all_errors) - 400} more", file=sys.stderr)
        return 1
    print(f"OK: {total} records valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())
