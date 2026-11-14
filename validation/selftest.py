"""Self-test for validation/run_all.py: seeded errors must be caught, clean records must pass.

Builds SYNTHETIC test records (never used as evidence) that point at real downloaded
files, so the trace check runs against real cells and real text.
Needs data/raw/ (the FLEX table and the PSI-69 record).

Usage: python -I validation/selftest.py

centinela:off — this file contains banned phrases on purpose, as test input for the language gate.
"""
import csv
import io
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
TABLE = "psi-data/PSI-69/Experimental table/PSI-69_Experimental table_FLEX.csv"
RECORD = "psi-data/PSI-69/_investigation/PSI-69.json"
FIELDS = ["accession", "test_id", "variable", "value", "unit", "value_original", "unit_original",
          "method", "source_file", "source_location", "quote", "status", "note"]


def flex_pressure_cell():
    raw = RAW.joinpath(*TABLE.split("/")).read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1252")
    rows = list(csv.reader(io.StringIO(text)))
    header = [h.strip() for h in rows[0]]
    for row_n, row in enumerate(rows[1:], 1):
        for i, h in enumerate(header):
            if re.search(r"pressure", h, re.I) and i < len(row) and re.fullmatch(r"\d+(\.\d+)?", row[i].strip()):
                return row_n, h, row[i].strip()
    raise SystemExit("no numeric pressure cell found in the FLEX table")


def rec(**kw):
    base = dict(accession="PSI-69", test_id="selftest-1", unit="", unit_original="", status="extracted", note="SYNTHETIC selftest record")
    base.update(kw)
    return base


def main():
    n, col, cell = flex_pressure_cell()
    record = json.loads(RAW.joinpath(*RECORD.split("/")).read_text(encoding="utf-8"))
    field = next(k for k in ("description", "objective", "approach", "hypothesis") if (record.get(k) or "").strip())
    quote = " ".join(record[field].split()[:12])
    kpa = float(cell) * 0.1333224
    loc = f"row={n};column={col}"
    T = dict(method="table", source_file=TABLE, source_location=loc, quote=col)
    D = dict(method="document", source_file=RECORD, source_location=f"section={field}")

    cases = [  # (expected check or None, record)
        (None, rec(variable="pressure", value=f"{kpa:.6g}", unit="kPa", value_original=cell, unit_original="mmHg", **T)),
        (None, rec(variable="gravity_regime", value="microgravity", value_original="microgravity", quote=quote, **D)),
        ("units", rec(test_id="selftest-2", variable="pressure", value=f"{float(cell) * 0.2:.6g}", unit="kPa", value_original=cell, unit_original="mmHg", **T)),
        ("bounds", rec(test_id="selftest-3", variable="o2_mole_fraction", value="1.7", unit="1", value_original="170", unit_original="%", **T)),
        ("trace", rec(test_id="selftest-4", variable="pressure", value=f"{(float(cell) + 1) * 0.1333224:.6g}", unit="kPa", value_original=str(float(cell) + 1), unit_original="mmHg", **T)),
        ("trace", rec(test_id="selftest-5", variable="fuel_phase", value="liquid", value_original="liquid", quote="this sentence is not in the source at all", **D)),
        ("schema", rec(test_id="selftest-6", variable="gravity_regime", value="lunar", value_original="lunar", quote=quote, **D)),
        ("provenance", rec(test_id="selftest-7", variable="fuel", value="heptane", value_original="heptane", method="document", source_file="psi-data/PSI-69/not-downloaded.pdf", source_location="page=1", quote="heptane")),
        ("consistency", rec(test_id="selftest-8", variable="diluent", value="N2", value_original="N2", quote=quote, **D)),
        ("consistency", rec(test_id="selftest-8", variable="diluent", value="He", value_original="He", quote=quote, **D)),
    ]
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        with open(tmp / "PSI-69.csv", "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=FIELDS)
            w.writeheader()
            w.writerows(c[1] for c in cases)
        subprocess.run([sys.executable, "-I", str(ROOT / "validation" / "run_all.py"),
                        "--conditions", str(tmp), "--reports", str(tmp)], capture_output=True)
        findings = json.loads((tmp / "latest.json").read_text(encoding="utf-8"))["findings"]

    by_line = {}
    for f in findings:
        if f["where"].startswith("PSI-69.csv:"):
            by_line.setdefault(int(f["where"].split(":")[1]), set()).add(f["check"])
    failures = 0
    for i, (expected, r) in enumerate(cases, start=2):
        got = by_line.get(i, set())
        ok = (not got) if expected is None else (expected in got)
        if expected == "consistency":
            ok = any(f["check"] == "consistency" and "selftest-8" in f["where"] for f in findings)
        failures += not ok
        print(f"{'PASS' if ok else 'FAIL'}  line {i}: expected {expected or 'clean'}, got {sorted(got) or 'clean'}")

    banned = ["the world's first lunar fire model", "validated by NASA", "no data exists for this",
              "this is a discovery"]
    from run_all import BANNED  # noqa: E402
    for s in banned:
        hit = any(re.search(p, s, re.I) for p, _ in BANNED)
        failures += not hit
        print(f"{'PASS' if hit else 'FAIL'}  language gate flags: \"{s}\"")
    clean = "Inside the measured range in PSI, the verdict is APPLICABLE."
    hit = any(re.search(p, clean, re.I) for p, sev in BANNED if sev != "MINOR")
    failures += hit
    print(f"{'PASS' if not hit else 'FAIL'}  language gate leaves clean text alone")

    print(f"\n{'ALL PASS' if not failures else f'{failures} FAILURE(S)'}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    main()
