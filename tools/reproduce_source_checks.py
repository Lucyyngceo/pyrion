"""Reproduce the source-dependent checks that CI skips.

CI runs `validation/run_all.py --no-trace` and a clean clone skips the web tests that need
the NASA source files. This script makes those checks reproducible on any machine:

  1. (optional, --fetch) download the public NASA files listed in the manifests into data/raw/
     with pipeline/fetch.py (PSI files through the PSI API, NTRS / NASA web documents directly);
  2. verify every file marked `ok` in data/manifest/checksums_*.csv: present, same size, same SHA-256;
  3. run the full validation, including the `trace` check (cells and quotes against the files);
  4. (optional, --corpus) rebuild the TARS library (needs PyMuPDF) so the corpus test can run;
  5. report which source-dependent web tests will still skip, and why.

It never reports a skipped check as passed. Exit code: 0 only if every requested step passed.

Usage:
  python -I tools/reproduce_source_checks.py --fetch P1 --fetch P2 --fetch P3 --fetch P4
  python -I tools/reproduce_source_checks.py                (verify what is already in data/raw/)
  python -I tools/reproduce_source_checks.py --corpus       (also rebuild web/.data/corpus/)
Standard library only, except --corpus (PyMuPDF, openpyxl, as tools/build_corpus.py).
"""
import argparse
import csv
import hashlib
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
from fetch import local_path  # noqa: E402  (same Windows-safe mapping the downloader uses)

MANIFEST = ROOT / "data" / "manifest"


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def rows(path):
    with open(path, encoding="utf-8", newline="") as fh:
        lines = [ln for ln in fh if not ln.startswith("#")]
    return list(csv.DictReader(lines))


def snapshot_manifests():
    """The committed checksum rows, read BEFORE any download: fetch.py rewrites these files with the hashes
    of what it just downloaded, so verifying against them afterwards could never find a mismatch."""
    return {f.name: rows(f) for f in sorted(MANIFEST.glob("checksums_P*.csv"))}


def verify_checksums(snapshot):
    """Every `ok` row of the committed manifests: present, same bytes, same SHA-256."""
    seen, ok, missing, mismatch = set(), 0, [], []
    for name in sorted(snapshot):
        for r in snapshot[name]:
            if r.get("status") != "ok" or not r.get("path") or r["path"] in seen:
                continue
            seen.add(r["path"])
            p = local_path(r["path"])
            if not os.path.exists(p):
                missing.append(r["path"])
                continue
            size = os.path.getsize(p)
            if str(size) != r["bytes"] or sha256_of(p) != r["sha256"]:
                mismatch.append(f"{r['path']} (bytes {size} vs {r['bytes']})")
            else:
                ok += 1
    return len(seen), ok, missing, mismatch


def run(cmd):
    print("$ " + " ".join(cmd), flush=True)
    return subprocess.run(cmd, cwd=ROOT).returncode


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fetch", action="append", default=[], choices=["P1", "P2", "P3", "P4"], help="download this priority first (repeatable)")
    ap.add_argument("--corpus", action="store_true", help="rebuild web/.data/corpus/ (needs PyMuPDF)")
    ap.add_argument("--no-validate", action="store_true", help="skip validation/run_all.py")
    args = ap.parse_args()
    failed = []
    snapshot = snapshot_manifests()

    for p in args.fetch:
        if run([sys.executable, "-I", "pipeline/fetch.py", "--priority", p]) != 0:
            failed.append(f"fetch {p}")

    if args.fetch:
        print("note: pipeline/fetch.py rewrote data/manifest/checksums_*.csv; the check below uses the committed copies read before the download (git diff shows any change).")
    total, ok, missing, mismatch = verify_checksums(snapshot)
    print(f"\nchecksums: {ok} of {total} files verified (size and SHA-256), {len(missing)} missing, {len(mismatch)} mismatched")
    for m in mismatch:
        print(f"  MISMATCH {m}")
    if missing:
        print(f"  missing (first 10): {', '.join(missing[:10])}")
        print("  -> run with --fetch P1 (and P2..P4); a file the source no longer serves stays missing and its trace check fails.")
    if mismatch:
        failed.append("checksums")
    if missing:
        failed.append("checksums (missing files)")

    if not args.no_validate:
        if run([sys.executable, "-I", "validation/run_all.py"]) != 0:
            failed.append("validation (with trace)")
        print("  report: validation/reports/latest.md (trace_ran, cells_traced, quotes_traced)")

    if args.corpus:
        if run([sys.executable, "-I", "tools/build_corpus.py"]) != 0:
            failed.append("corpus build")

    # Which web tests will still skip, and why (they are reported as skipped by node:test, never as passed).
    corpus = ROOT / "web" / ".data" / "corpus" / "pages.jsonl"
    challenge = os.environ.get("PYRION_CHALLENGE")
    print("\nsource-dependent web tests (cd web && npm test):")
    print(f"  expert-claims  'real corpus: FM2 chamber quote' : {'will run' if corpus.exists() else 'will SKIP: web/.data/corpus/pages.jsonl missing (use --corpus)'}")
    print(f"  lenses-data    'PSI quote word for word', 'timeline dates' : {'will run' if not missing else 'will SKIP or fail: data/raw incomplete'}")
    print(f"  lenses-data, more-equipment  'challenge quote word for word' : {'will run' if challenge and Path(challenge).exists() else 'will SKIP: set PYRION_CHALLENGE to a text copy of the challenge statement (manual step, see README)'}")

    print("\nresult: " + ("all requested steps passed" if not failed else "FAILED: " + "; ".join(failed)))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
