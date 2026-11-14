"""Build data/conditions/<accession>.csv from the PSI tables and the reviewed document records.

    python -I extraction/build_conditions.py

1. Every adapter in extraction/tables/ reads one PSI experimental table (method=table).
2. Every extraction/documents/<accession>.csv holds document records (method=document),
   each with its verbatim quote, produced by the extractor agent and audited by the
   verificador agent (see extraction/README.md).
3. Records are written per investigation, then data/conditions/SUMMARY.md and REVIEW.md
   are regenerated and extraction/validate.py runs on the result.

Needs data/raw/ (see data/README.md). openpyxl is needed for the .xlsx sources.
"""
from __future__ import annotations

import csv
import sys
from collections import defaultdict
from pathlib import Path

sys.dont_write_bytecode = True  # keep __pycache__ out of the repo
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))  # this directory only; -I keeps the rest of the environment out

from common import FIELDS, OUT_DIR, Skips  # noqa: E402
import report  # noqa: E402
import validate  # noqa: E402
from tables import adapters  # noqa: E402

DOC_DIR = HERE / "documents"
SKIPS_FILE = HERE / "skipped_cells.csv"


def load_document_records():
    out = defaultdict(list)
    for f in sorted(DOC_DIR.glob("PSI-*.csv")):
        with f.open(encoding="utf-8", newline="") as fh:
            rows = list(csv.DictReader(fh))
        for r in rows:
            if r.get("method") != "document":
                raise SystemExit(f"{f}: only method=document records belong in extraction/documents/")
            out[r["accession"]].append({k: r.get(k, "") for k in FIELDS})
    return out


def main():
    skips = Skips()
    by_acc = defaultdict(list)
    sources = {}
    for mod in adapters():
        recs = mod.build(skips)
        by_acc[mod.ACCESSION].extend(recs)
        sources[mod.ACCESSION] = mod.SOURCES
    docs = load_document_records()
    for acc, recs in docs.items():
        by_acc[acc].extend(recs)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    written = set()
    for acc in sorted(by_acc, key=lambda a: int(a.split("-")[1])):
        recs = by_acc[acc]
        if not recs:
            continue
        path = OUT_DIR / f"{acc}.csv"
        with path.open("w", encoding="utf-8", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=FIELDS, lineterminator="\n")
            w.writeheader()
            w.writerows(recs)
        written.add(path.name)
        print(f"{acc}: {len(recs)} records")
    for stale in OUT_DIR.glob("PSI-*.csv"):
        if stale.name not in written:
            stale.unlink()

    with SKIPS_FILE.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["accession", "source_file", "row", "column", "cell", "reason"],
                           lineterminator="\n")
        w.writeheader()
        w.writerows(skips.items)
    print(f"{len(skips.items)} cells not turned into records -> {SKIPS_FILE.relative_to(HERE.parent)}")

    report.write(by_acc, skips.items, sources)
    return validate.main([])


if __name__ == "__main__":
    sys.exit(main())
