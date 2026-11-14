"""Reproducible review sample for a milestone (VALIDATION.md, layer 2).

Every `document` record, plus a stratified random sample of `table` records:
10 % per investigation, at least 3, at most 20. The seed is printed and written,
so anyone can regenerate the exact same sample.

Usage:  python -I validation/sample.py M1 [--seed 20261114] [--only PSI-69,PSI-68]
Output: validation/reports/<milestone>-sample.csv
"""
import argparse
import csv
import random
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONDITIONS = ROOT / "data" / "conditions"
REPORTS = ROOT / "validation" / "reports"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("milestone", choices=["M1", "M2", "M3", "M4"])
    ap.add_argument("--seed", type=int, default=20261114)
    ap.add_argument("--only", default="", help="comma-separated accessions")
    args = ap.parse_args()
    only = {a.strip() for a in args.only.split(",") if a.strip()}

    docs, tables = [], defaultdict(list)
    for f in sorted(CONDITIONS.glob("PSI-*.csv")):
        with open(f, encoding="utf-8", newline="") as fh:
            for i, r in enumerate(csv.DictReader(fh), start=2):
                if only and r["accession"] not in only:
                    continue
                r["record_ref"] = f"{f.relative_to(ROOT).as_posix()}:{i}"
                (docs.append(r) if r["method"] == "document" else tables[r["accession"]].append(r))

    rng = random.Random(args.seed)
    sample = list(docs)
    for acc in sorted(tables):
        recs = tables[acc]
        k = min(len(recs), max(3, min(20, round(len(recs) * 0.10))))
        sample += rng.sample(recs, k)

    REPORTS.mkdir(parents=True, exist_ok=True)
    out = REPORTS / f"{args.milestone}-sample.csv"
    fields = ["record_ref"] + [k for k in (sample[0].keys() if sample else []) if k != "record_ref"]
    with open(out, "w", newline="", encoding="utf-8") as fh:
        fh.write(f"# milestone={args.milestone} seed={args.seed} documents={len(docs)} "
                 f"table_records_sampled={len(sample) - len(docs)}\n")
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(sample)
    print(f"{args.milestone}: {len(sample)} records ({len(docs)} document, {len(sample) - len(docs)} table), seed {args.seed} -> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
