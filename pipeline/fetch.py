"""Download the files listed in the PYRION manifests into data/raw/.

For PSI files it asks the PSI API for a pre-signed S3 URL, downloads the file,
checks its size against the PSI catalog and records its SHA-256.
It also saves each investigation's full PSI record (DOI, license, publications)
and the NASA documents listed in data/manifest/external_sources.json.

Re-running is safe: files already on disk with the expected size are verified,
not downloaded again.

Usage:  python -I pipeline/fetch.py --priority P1
Output: data/raw/...                         (not committed; CC0 / U.S. Government works)
        data/manifest/checksums_<P>.csv     (committed: path, bytes, sha256, source, status)
"""
import argparse
import csv
import hashlib
import json
import os
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import psi_client  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
MANIFEST = ROOT / "data" / "manifest"
WINDOWS_UNSAFE = re.compile(r'[<>:"|?*]')


def local_path(relative):
    """data/raw/<relative>, safe for Windows file names and long paths."""
    parts = [WINDOWS_UNSAFE.sub("_", p) for p in relative.split("/")]
    p = RAW.joinpath(*parts)
    if os.name == "nt":
        return Path("\\\\?\\" + str(p.resolve()))
    return p


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url, dest, timeout=300, retries=3):
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".part")
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": psi_client.USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as r, open(tmp, "wb") as out:
                for chunk in iter(lambda: r.read(1 << 20), b""):
                    out.write(chunk)
            os.replace(tmp, dest)
            return
        except Exception:
            if tmp.exists():
                tmp.unlink()
            if attempt == retries - 1:
                raise


def task_psi_file(entry):
    rel = entry["key"]
    dest = local_path(rel)
    expected = entry["bytes"]
    source = f"PSI {entry['accession']} v{entry['file_version']}: {entry['file']}"
    if not entry.get("name_is_unique", True):
        return {"path": rel, "bytes": "", "sha256": "", "source": source,
                "status": "skipped: file name not unique in investigation"}
    if not (dest.exists() and dest.stat().st_size == expected):
        url = psi_client.presigned_url(entry["accession"], entry["file"], entry["file_version"])
        download(url, dest)
    size = dest.stat().st_size
    status = "ok" if size == expected else f"size mismatch: catalog {expected}, got {size}"
    return {"path": rel, "bytes": size, "sha256": sha256_of(dest), "source": source, "status": status}


def task_record(accession):
    rel = f"psi-data/{accession}/_investigation/{accession}.json"
    dest = local_path(rel)
    dest.parent.mkdir(parents=True, exist_ok=True)
    rec = psi_client.investigation(accession)
    dest.write_text(json.dumps(rec, indent=1, ensure_ascii=False), encoding="utf-8")
    return {"path": rel, "bytes": dest.stat().st_size, "sha256": sha256_of(dest),
            "source": f"{psi_client.API}/repo/investigations/{accession}", "status": "ok"}


def task_external(src):
    name = src.get("filename") or urllib.request.unquote(src["url"].split("/")[-1])
    rel = f"nasa/{src['id']}/{name}"
    dest = local_path(rel)
    if not dest.exists():
        download(src["url"], dest)
    return {"path": rel, "bytes": dest.stat().st_size, "sha256": sha256_of(dest),
            "source": src["url"], "status": "ok"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--priority", default="P1", choices=["P1", "P2", "P3", "P4"])
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()

    manifest = json.loads((MANIFEST / "psi_manifest.json").read_text(encoding="utf-8"))
    external = json.loads((MANIFEST / "external_sources.json").read_text(encoding="utf-8"))["sources"]

    jobs = [(task_psi_file, e) for e in manifest["files"] if e["priority"] == args.priority]
    if args.priority == "P1":
        jobs += [(task_record, i["accession"]) for i in manifest["investigations"]]
    jobs += [(task_external, s) for s in external if s["priority"] == args.priority]

    rows, failures = [], 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(fn, arg): (fn.__name__, arg) for fn, arg in jobs}
        for n, fut in enumerate(as_completed(futures), 1):
            kind, arg = futures[fut]
            try:
                rows.append(fut.result())
            except Exception as exc:  # recorded, never hidden
                failures += 1
                label = arg["key"] if isinstance(arg, dict) and "key" in arg else (
                    arg.get("url") if isinstance(arg, dict) else arg)
                rows.append({"path": "", "bytes": "", "sha256": "", "source": str(label),
                             "status": f"failed: {type(exc).__name__}: {exc}"[:300]})
            if n % 25 == 0 or n == len(jobs):
                print(f"{n}/{len(jobs)} done, {failures} failed", flush=True)

    rows.sort(key=lambda r: (r["path"] == "", r["path"]))
    out = MANIFEST / f"checksums_{args.priority}.csv"
    with open(out, "w", newline="", encoding="utf-8") as fh:
        fh.write(f"# generated_at_utc={datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}\n")
        w = csv.DictWriter(fh, fieldnames=["path", "bytes", "sha256", "source", "status"])
        w.writeheader()
        w.writerows(rows)

    ok = sum(1 for r in rows if r["status"] == "ok")
    total = sum(int(r["bytes"]) for r in rows if r["status"] == "ok")
    print(f"{args.priority}: {ok} ok, {len(rows) - ok} not ok, {total / 1e6:.1f} MB -> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
