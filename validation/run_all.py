"""Layer 1 of VALIDATION.md: deterministic gates over condition records and public text.

Usage:  python -I validation/run_all.py            (all checks; `trace` needs data/raw/)
        python -I validation/run_all.py --no-trace (what CI runs)
Output: validation/reports/latest.md and latest.json. Exit code 1 if any BLOCKER.

Independent of extraction/validate.py on purpose: a second implementation of the
schema rules, written separately, catches mistakes the first one shares with
the code that produced the records.
"""
import argparse
import csv
import json
import re
import sys
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
CONDITIONS = ROOT / "data" / "conditions"
MANIFEST = ROOT / "data" / "manifest"
REPORTS = ROOT / "validation" / "reports"
SCHEMA = json.loads((ROOT / "schema" / "condition_record.schema.json").read_text(encoding="utf-8"))

REQUIRED = SCHEMA["required"]
VARIABLE_RE = re.compile(SCHEMA["properties"]["variable"]["pattern"])
REGIME_VALUES = {
    "gravity_regime": {"microgravity", "partial_gravity", "normal_gravity"},
    "fuel_phase": {"solid", "liquid", "gas"},
    "diluent": {"N2", "He", "CO2", "Ar", "mixed"},
    "flame_type": {"normal", "inverse"},
}
FIXED_UNITS = {
    "o2_mole_fraction": "1", "burner_o2_mole_fraction": "1", "pressure": "kPa",
    "flow_velocity": "cm/s", "sample_thickness": "mm", "droplet_diameter_initial": "mm",
    "ambient_temperature": "K", "gravity_level": "g",
}
# Physical plausibility, inclusive. Wide on purpose: they catch unit errors, not science.
BOUNDS = {
    "o2_mole_fraction": (0.0, 1.0), "burner_o2_mole_fraction": (0.0, 1.0),
    "pressure": (0.1, 2000.0), "flow_velocity": (0.0, 1000.0), "sample_thickness": (0.0, 200.0),
    "droplet_diameter_initial": (0.01, 50.0), "ambient_temperature": (100.0, 4000.0),
    "gravity_level": (0.0, 3.0),
}
# Conversions to the schema unit: target unit -> {source unit (lower case): factor or callable}
TO_KPA = {"kpa": 1.0, "pa": 0.001, "atm": 101.325, "bar": 100.0, "mbar": 0.1, "psi": 6.894757,
          "psia": 6.894757, "mmhg": 0.1333224, "torr": 0.1333224}
CONVERSIONS = {
    "kPa": TO_KPA,
    "1": {"": 1.0, "1": 1.0, "mole fraction": 1.0, "fraction": 1.0, "%": 0.01, "percent": 0.01,
          "% by vol": 0.01, "% by volume": 0.01, "percent by volume": 0.01, "vol%": 0.01, "vol %": 0.01,
          # "21/79 oxygen/nitrogen mixture (on a volume basis)": parts of a ratio summing to 100, by volume (PSI-22).
          "on a volume basis": 0.01},
    "cm/s": {"cm/s": 1.0, "mm/s": 0.1, "m/s": 100.0},
    "mm": {"mm": 1.0, "cm": 10.0, "um": 0.001, "µm": 0.001, "micron": 0.001, "microns": 0.001, "in": 25.4, "m": 1000.0},
    "K": {"k": 1.0, "c": lambda v: v + 273.15, "°c": lambda v: v + 273.15, "degc": lambda v: v + 273.15},
    "g": {"g": 1.0},
}
BANNED = [
    (r"\bfirst (?:ever|in the world)\b|\bworld'?s first\b", "BLOCKER"),
    (r"\bvalidated by NASA\b|\bNASA[- ]validated\b|\bNASA[- ]approved\b|\bendorsed by NASA\b", "BLOCKER"),
    (r"\bperfect accuracy\b|\b100 ?% accura", "BLOCKER"),
    (r"\bno data exists?\b|\bnever been tested\b|\bnever tested\b", "BLOCKER"),
    (r"\bautonomous end[- ]to[- ]end\b", "BLOCKER"),
    (r"\bguarantee[sd]?\b|\bproven safe\b", "BLOCKER"),
    (r"\bdiscover(?:y|ed|ies)\b", "MAJOR"),
    (r"\bsafe\b", "MINOR"),
]
PUBLIC_TEXT = ["README.md", "VALIDATION.md", "data/README.md", "schema/README.md",
               "engine/README.md", "web/README.md"]
PUBLIC_GLOBS = ["web/app/**/*.tsx", "web/components/**/*.tsx", "web/lib/**/*.ts"]


class Report:
    def __init__(self):
        self.findings = []
        self.stats = defaultdict(int)

    def add(self, severity, check, where, what):
        self.findings.append({"severity": severity, "check": check, "where": where, "what": what})


def load_records(folder=None):
    records = []
    # default: data/conditions/PSI-*.csv; an explicit folder (self-test, external sources) is read whole
    files = sorted(folder.glob("*.csv")) if folder else sorted(CONDITIONS.glob("PSI-*.csv"))
    for f in files:
        with open(f, encoding="utf-8", newline="") as fh:
            for i, r in enumerate(csv.DictReader(fh), start=2):
                rel = f.relative_to(ROOT).as_posix() if f.is_relative_to(ROOT) else f.name
                r["_file"] = f"{rel}:{i}"
                records.append(r)
    return records


NUM = r"[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?"


def number(text):
    """The number in a value as written in the source: '1 atm', '~ 21.5', '757.7' -> float."""
    t = text.strip().replace(",", "")
    m = re.fullmatch(rf"~?\s*({NUM})(?:\s*[A-Za-z%°µ/(].*)?", t)
    if not m:
        raise ValueError(text)
    return float(m.group(1))


def interval(text):
    """'lo..hi' (normalized) or a source range '0.1 - 5', '22.1 to 22.0' -> (lo, hi) ascending."""
    t = text.strip().replace(",", "")
    m = re.fullmatch(rf"~?\s*({NUM})\s*(?:\.\.|-|–|to)\s*~?\s*({NUM})\s*[^\d]*", t)
    if m:
        a, b = float(m.group(1)), float(m.group(2))
        return min(a, b), max(a, b)
    v = number(t)
    return v, v


def check_schema(recs, rep):
    for r in recs:
        missing = [k for k in REQUIRED if not (r.get(k) or "").strip() and k not in ("unit", "unit_original")]
        if missing:
            rep.add("BLOCKER", "schema", r["_file"], f"empty required field(s): {', '.join(missing)}")
            continue
        var, val = r["variable"], r["value"].strip()
        if not VARIABLE_RE.match(var):
            rep.add("BLOCKER", "schema", r["_file"], f"variable not in schema: {var}")
        if r["method"] not in ("table", "document"):
            rep.add("BLOCKER", "schema", r["_file"], f"method must be table or document: {r['method']}")
        if r["status"] not in ("extracted", "verified", "insufficient_evidence"):
            rep.add("BLOCKER", "schema", r["_file"], f"invalid status: {r['status']}")
        if r["status"] == "insufficient_evidence":
            continue
        if var in REGIME_VALUES and val not in REGIME_VALUES[var]:
            rep.add("BLOCKER", "schema", r["_file"], f"{var} has value '{val}', allowed {sorted(REGIME_VALUES[var])}")
        if var in FIXED_UNITS and r["unit"] != FIXED_UNITS[var]:
            rep.add("BLOCKER", "schema", r["_file"], f"{var} must be in '{FIXED_UNITS[var]}', got '{r['unit']}'")


def check_provenance(recs, rep):
    ok = set()
    for f in MANIFEST.glob("checksums_*.csv"):
        with open(f, encoding="utf-8") as fh:
            for row in csv.DictReader(l for l in fh if not l.startswith("#")):
                if row["status"] == "ok":
                    ok.add(row["path"])
    for r in recs:
        if r.get("source_file") and r["source_file"] not in ok:
            rep.add("BLOCKER", "provenance", r["_file"], f"source_file not among verified downloads: {r['source_file']}")


def check_units(recs, rep):
    for r in recs:
        var, unit = r.get("variable", ""), r.get("unit", "")
        if r.get("status") == "insufficient_evidence" or var not in FIXED_UNITS:
            continue
        table = CONVERSIONS.get(unit)
        src_unit = (r.get("unit_original") or "").strip().lower()
        if not src_unit and r.get("method") == "table":
            # unit stated in the column header, e.g. "Air Flow (cm/s)"
            m = re.search(r"\(([^()]+)\)\s*$", r.get("quote") or "")
            src_unit = m.group(1).strip().lower() if m else ""
        try:
            lo_o, hi_o = interval(r["value_original"])
            lo, hi = interval(r["value"])
        except ValueError:
            rep.add("MAJOR", "units", r["_file"], f"non-numeric value '{r['value']}' / original '{r['value_original']}'")
            continue
        note = r.get("note") or ""
        if table is None or src_unit not in table:
            if not (r.get("unit_original") or "").strip() and abs(lo - lo_o) <= 1e-12 and abs(hi - hi_o) <= 1e-12:
                rep.stats["units_identity_no_unit_in_source"] += 1  # number copied unchanged
                continue
            rep.add("MAJOR", "units", r["_file"], f"cannot recompute {var}: no known conversion '{r.get('unit_original')}' -> '{unit}'")
            continue
        conv = table[src_unit]
        f = conv if callable(conv) else (lambda v, k=conv: v * k)
        for got, orig in ((lo, lo_o), (hi, hi_o)):
            want = f(orig)
            if abs(got - want) > max(abs(want) * 0.005, 1e-9):
                if "unit-label-mismatch:" in note:
                    # documented: the source's unit label contradicts its numbers; reviewed at M1
                    rep.add("MINOR", "units", r["_file"], f"documented unit-label mismatch ({var}): {note[:100]}")
                else:
                    rep.add("BLOCKER", "units", r["_file"], f"{var}: {r['value_original']} {r['unit_original']} -> expected {want:.6g} {unit}, record says {r['value']}")
                break
        rep.stats["units_rechecked"] += 1


def check_bounds(recs, rep):
    for r in recs:
        var = r.get("variable", "")
        if r.get("status") == "insufficient_evidence" or var not in BOUNDS:
            continue
        try:
            lo, hi = interval(r["value"])
        except ValueError:
            continue
        bmin, bmax = BOUNDS[var]
        if lo > hi:
            rep.add("BLOCKER", "bounds", r["_file"], f"range not ascending: {r['value']}")
        if lo < bmin or hi > bmax:
            rep.add("BLOCKER", "bounds", r["_file"], f"{var}={r['value']} {r['unit']} outside physical bounds [{bmin}, {bmax}]")


def check_consistency(recs, rep):
    """A regime axis with two values for one test is a conflict only if the values come
    from different places. One cell listing several values (schema convention) is a
    summary row covering several conditions: reported as MINOR so consumers know."""
    seen = defaultdict(lambda: defaultdict(set))
    for r in recs:
        if r.get("variable") in REGIME_VALUES and r.get("status") != "insufficient_evidence":
            key = (r["accession"], r["test_id"], r["variable"])
            seen[key][(r["source_file"], r["source_location"])].add(r["value"])
    for (acc, test, var), by_src in seen.items():
        vals = set().union(*by_src.values())
        if len(vals) < 2:
            continue
        if len(by_src) == 1:
            rep.add("MINOR", "consistency", f"{acc} test {test}", f"{var} lists {sorted(vals)} in one source cell: summary row covering several conditions")
        else:
            rep.add("BLOCKER", "consistency", f"{acc} test {test}", f"{var} has conflicting values {sorted(vals)} from different sources")


def check_citation(recs, rep):
    with open(MANIFEST / "investigations.csv", encoding="utf-8") as fh:
        inv = {r["accession"]: r for r in csv.DictReader(fh)}
    with open(MANIFEST / "external_sources.json", encoding="utf-8") as fh:
        external = {s["id"]: s for s in json.load(fh)["sources"]}
    for acc in sorted({r.get("accession") for r in recs if r.get("accession")}):
        if acc.startswith("NTRS-"):
            # External evidence (not PSI): it must be a registered external source with a URL.
            src = external.get("ntrs-" + acc[len("NTRS-"):])
            if not src:
                rep.add("BLOCKER", "citation", acc, "external source not in data/manifest/external_sources.json")
            elif not src.get("url"):
                rep.add("BLOCKER", "citation", acc, "external source has no URL")
            continue
        if acc not in inv:
            rep.add("BLOCKER", "citation", acc, "investigation not in investigations.csv")
        elif not inv[acc]["doi"]:
            rep.add("BLOCKER", "citation", acc, "investigation has no DOI")
        elif not inv[acc]["license"]:
            notes = [r for r in recs if r.get("accession") == acc and "license not stated" not in (r.get("note") or "")]
            if notes:
                rep.add("MAJOR", "citation", acc, f"license not stated by PSI, but {len(notes)} record(s) lack the 'license not stated' note")


# ---- trace (needs data/raw) -------------------------------------------------

_text_cache = {}


def document_text(path):
    if path in _text_cache:
        return _text_cache[path]
    p = RAW.joinpath(*path.split("/"))
    suffix = p.suffix.lower()
    text = ""
    if suffix == ".pdf":
        import fitz  # PyMuPDF; local only
        with fitz.open(p) as doc:
            text = "\n".join(page.get_text() for page in doc)
    elif suffix == ".docx":
        with zipfile.ZipFile(p) as z:
            xml = z.read("word/document.xml").decode("utf-8", "replace")
        text = re.sub(r"<[^>]+>", " ", xml)
    else:
        raw = p.read_bytes()
        text = raw.decode("utf-8-sig", "replace")
    _text_cache[path] = text
    return text


def normalize(s):
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = s.replace("–", "-").replace("—", "-").replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip().lower()


def _letters(s):
    import unicodedata
    s = unicodedata.normalize("NFKC", s)          # ligatures (ﬁ → fi), full-width forms
    s = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", s)   # words hyphenated across a PDF line break
    return re.sub(r"[^a-z0-9]+", "", s.lower())   # spacing and punctuation differ in extracted PDF text


_NUM = re.compile(r"(?<![\w.])[-−]?(?:\d+(?:[.,]\d+)?|\.\d+)(?![\w])")


def numbers_in(s):
    """Numeric tokens exactly as written (decimal point kept, so 1.5 != 15 and .15 != 15)."""
    import unicodedata
    s = unicodedata.normalize("NFKC", s).replace("−", "-")
    # The sign is dropped: documents split words like "FLEX-2" into "FLEX -2", which would read as a negative number.
    toks = [t.lstrip("-") for t in _NUM.findall(s)]
    return [t.replace(",", ".") if re.fullmatch(r"\d+,\d{1,2}", t) else t for t in toks]


def numbers_found(quote, text):
    """Every elision fragment's numbers must appear, in the same order and contiguously, among the
    document's numeric tokens. Catches '1.5' quoted from a text that says '15'."""
    doc = numbers_in(text)
    for frag in re.split(r"\[\s*(?:\.\.\.|…)\s*\]|…|\.\.\.", quote):
        q = numbers_in(frag)
        if not q:
            continue
        n = len(q)
        if not any(doc[i:i + n] == q for i in range(len(doc) - n + 1)):
            return False
    return True


def quote_found(quote, text):
    """Verbatim up to spacing/punctuation. An elision marker ([...] or …) splits the quote:
    every fragment must appear, in order."""
    hay = _letters(text)
    pos = 0
    for frag in re.split(r"\[\s*(?:\.\.\.|…)\s*\]|…|\.\.\.", quote):
        f = _letters(frag)
        if not f:
            continue
        i = hay.find(f, pos)
        if i < 0:
            return False
        pos = i + len(f)
    return True


_table_cache = {}


def xlsx_rows(path, sheet, columns):
    """Header and data rows of one Excel sheet. The header is the first row (within the first 10) that holds every
    column the record names; data row 1 is the row right below it. Cells are read as values, never as formulas."""
    key = (path, sheet, tuple(columns))
    if key not in _table_cache:
        import openpyxl
        wb = openpyxl.load_workbook(RAW.joinpath(*path.split("/")), read_only=True, data_only=True)
        rows = [["" if v is None else str(v) for v in row] for row in wb[sheet].iter_rows(values_only=True)]
        wb.close()
        hi = next((i for i, row in enumerate(rows[:10]) if all(c.strip() in [h.strip() for h in row] for c in columns)), None)
        _table_cache[key] = ([h.strip() for h in rows[hi]], rows[hi + 1:]) if hi is not None else (None, [])
    return _table_cache[key]


def table_rows(path):
    if path not in _table_cache:
        raw = RAW.joinpath(*path.split("/")).read_bytes()
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = raw.decode("cp1252")
        import io
        rows = list(csv.reader(io.StringIO(text)))
        _table_cache[path] = ([h.strip() for h in rows[0]], rows[1:]) if rows else ([], [])
    return _table_cache[path]


def check_trace(recs, rep):
    for r in recs:
        if not r.get("source_file") or r.get("status") == "insufficient_evidence":
            continue
        p = RAW.joinpath(*r["source_file"].split("/"))
        if not p.exists():
            rep.add("BLOCKER", "trace", r["_file"], f"source file missing locally: {r['source_file']}")
            continue
        try:
            if r["method"] == "document":
                text = document_text(r["source_file"])
                if not quote_found(r["quote"], text):
                    rep.add("BLOCKER", "trace", r["_file"], f"quote not found verbatim in {r['source_file']}: \"{r['quote'][:80]}\"")
                elif not numbers_found(r["quote"], text):
                    rep.add("BLOCKER", "trace", r["_file"], f"the numbers of the quote do not appear as written in {r['source_file']}: \"{r['quote'][:80]}\"")
                vo = numbers_in(r.get("value_original") or "")
                if vo and not all(v in numbers_in(r["quote"]) for v in vo):
                    rep.add("BLOCKER", "trace", r["_file"], f"value_original '{r.get('value_original')}' is not written in the quote")
                rep.stats["quotes_traced"] += 1
            elif r["method"] == "table" and p.suffix.lower() in (".csv", ".xlsx"):
                # Headers may contain ';' (e.g. "Ambient pressure; mmHg"): split only before sheet=/row=/column=.
                parts = re.split(r";(?=(?:sheet|row|column)=)", r["source_location"])
                loc = dict(p.split("=", 1) for p in parts if p.startswith(("row=", "sheet=")))
                cols = [p.split("=", 1)[1] for p in parts if p.startswith("column=")]
                if p.suffix.lower() == ".xlsx":
                    if "sheet" not in loc:
                        rep.add("BLOCKER", "trace", r["_file"], "Excel source without sheet= in source_location")
                        continue
                    header, rows = xlsx_rows(r["source_file"], loc["sheet"], cols)
                    if header is None:
                        rep.add("BLOCKER", "trace", r["_file"], f"no header row with {cols} in sheet '{loc['sheet']}'")
                        continue
                else:
                    header, rows = table_rows(r["source_file"])
                n = int(loc.get("row", "0"))
                if not (1 <= n <= len(rows)):
                    rep.add("BLOCKER", "trace", r["_file"], f"row {n} not in table ({len(rows)} data rows)")
                    continue
                cells = []
                for c in cols:
                    if c.strip() not in header:
                        rep.add("BLOCKER", "trace", r["_file"], f"column '{c}' not in table header")
                        break
                    idx = header.index(c.strip())
                    cells.append(rows[n - 1][idx] if idx < len(rows[n - 1]) else "")
                else:
                    if len(cols) == 1:
                        cell = normalize(cells[0])
                        orig = normalize(r["value_original"])
                        if orig not in cell:
                            rep.add("BLOCKER", "trace", r["_file"], f"cell row {n} '{cols[0]}' is '{cells[0]}', record says '{r['value_original']}'")
                    rep.stats["cells_traced"] += 1
        except Exception as exc:  # a check that cannot run is a finding, never a silent pass
            rep.add("MAJOR", "trace", r["_file"], f"trace check could not run: {type(exc).__name__}: {exc}")


def check_language(rep):
    files = [ROOT / p for p in PUBLIC_TEXT if (ROOT / p).exists()]
    for g in PUBLIC_GLOBS:
        files += [p for p in ROOT.glob(g) if "node_modules" not in p.parts]
    for f in files:
        for n, line in enumerate(f.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            if "lang-ok" in line:  # explicit, reviewed exception on that line
                continue
            for pattern, sev in BANNED:
                m = re.search(pattern, line, re.I)
                # A banned phrase quoted in order to forbid it ('never say "no data exists"') is not a claim.
                if m and re.search(r"\b(?:never|do not|don't|must not|not)\b[^.]{0,40}" + re.escape(m.group(0)), line, re.I):
                    continue
                if m:
                    rep.add(sev, "language", f"{f.relative_to(ROOT).as_posix()}:{n}", f"'{re.search(pattern, line, re.I).group(0)}' in: {line.strip()[:120]}")
        rep.stats["text_files_scanned"] += 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-trace", action="store_true", help="skip checks that need data/raw/ (CI)")
    ap.add_argument("--conditions", type=Path, help="read records from this folder (self-test)")
    ap.add_argument("--reports", type=Path, help="write reports to this folder (self-test)")
    args = ap.parse_args()
    global REPORTS
    if args.reports:
        REPORTS = args.reports

    rep = Report()
    recs = load_records(args.conditions.resolve() if args.conditions else None)
    rep.stats["records"] = len(recs)
    for check in (check_schema, check_provenance, check_units, check_bounds, check_consistency, check_citation):
        check(recs, rep)
    trace = not args.no_trace and RAW.exists()
    if trace:
        check_trace(recs, rep)
    check_language(rep)

    order = {"BLOCKER": 0, "MAJOR": 1, "MINOR": 2}
    rep.findings.sort(key=lambda f: (order[f["severity"]], f["check"], f["where"]))
    counts = {s: sum(1 for f in rep.findings if f["severity"] == s) for s in order}
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    REPORTS.mkdir(parents=True, exist_ok=True)
    payload = {"generated_at_utc": now, "trace_ran": trace, "stats": dict(rep.stats), "counts": counts,
               "findings": rep.findings}
    (REPORTS / "latest.json").write_text(json.dumps(payload, indent=1, ensure_ascii=False), encoding="utf-8")
    lines = [f"# Validation report — {now}", "",
             f"Records: {rep.stats['records']} · trace check: {'ran' if trace else 'skipped (no data/raw)'} · "
             + " · ".join(f"{k}: {v}" for k, v in sorted(rep.stats.items()) if k != "records"), "",
             f"**BLOCKER {counts['BLOCKER']} · MAJOR {counts['MAJOR']} · MINOR {counts['MINOR']}**", ""]
    if rep.findings:
        lines += ["| severity | check | where | what |", "|---|---|---|---|"]
        lines += [f"| {f['severity']} | {f['check']} | `{f['where']}` | {f['what'].replace('|', '/')} |" for f in rep.findings[:500]]
        if len(rep.findings) > 500:
            lines.append(f"\n… {len(rep.findings) - 500} more in latest.json")
    (REPORTS / "latest.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"records={rep.stats['records']} trace={'yes' if trace else 'no'} "
          f"BLOCKER={counts['BLOCKER']} MAJOR={counts['MAJOR']} MINOR={counts['MINOR']}")
    sys.exit(1 if counts["BLOCKER"] else 0)


if __name__ == "__main__":
    main()
