"""Build data/conditions/<accession>.csv from the PSI tables and the reviewed document records.

    python -I extraction/build_conditions.py

1. Every adapter in extraction/tables/ reads one PSI experimental table (method=table).
2. extraction/documents.py turns each reviewed extraction in extraction/documents/review/
   (<ACC>.extractor.json audited by <ACC>.verificador.json) into document records
   (method=document), each with its verbatim quote (see extraction/README.md).
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
import documents  # noqa: E402
import report  # noqa: E402
import validate  # noqa: E402
from tables import adapters  # noqa: E402

SKIPS_FILE = HERE / "skipped_cells.csv"


def main():
    skips = Skips()
    by_acc = defaultdict(list)
    sources = {}
    for mod in adapters():
        recs = mod.build(skips)
        by_acc[mod.ACCESSION].extend(recs)
        sources[mod.ACCESSION] = mod.SOURCES
    table_ids = {acc: sorted({r["test_id"] for r in recs if r["test_id"] != "*"}) for acc, recs in by_acc.items()}
    docs, doc_stats = documents.load(table_ids)
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

    report.write(by_acc, skips.items, sources, doc_stats)
    return validate.main([])


if __name__ == "__main__":
    sys.exit(main())
