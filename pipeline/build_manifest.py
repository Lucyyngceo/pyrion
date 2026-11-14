"""Build the PSI download manifest for PYRION from the live PSI catalog.

Reads catalog metadata only; it downloads no data files.
Selects every investigation whose PSI Research Area is "Combustion Science",
lists the files of its current version and assigns each file a priority:

  P1  needed by the evidence engine: experimental tables, metadata, read-me and
      data descriptions, requirement documents, test matrices, calibration and
      reference data, reports, summary results, analyzed-data CSV files
  P2  supporting analysis: other analyzed data, science documents, simulation,
      representative still images
  P3  context: presentations and engineering documents
  --  excluded (not listed): raw data, video, image sequences, archives
      (except metadata archives)

Usage:  python -I pipeline/build_manifest.py
Output: data/manifest/psi_manifest.json, data/manifest/investigations.csv
"""
import csv
import json
import re
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import psi_client  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "manifest"

VIDEO = re.compile(r"\.(mp4|ts|m2ts|avi|mov|mkv|m4v|mpe?g|wmv|mxf|h264)$", re.I)
IMAGE = re.compile(r"\.(jpe?g|png|tiff?|bmp|gif|dng|nef|cr2|raw)$", re.I)
ARCHIVE = re.compile(r"\.(zip|7z|tar|gz|tgz|rar)$", re.I)
DOCUMENT = re.compile(r"\.(pdf|docx?|pptx?|xlsx?|csv|txt|dat|json|xml|md|rtf|tsv|pxp)$", re.I)


def classify(key):
    """Return (priority, reason) for a PSI file key, or None if excluded."""
    parts = key.split("/")
    folder = parts[2] if len(parts) > 3 else ""
    name = parts[-1].lower()

    if "/Raw Data/" in key or VIDEO.search(key):
        return None
    if IMAGE.search(key):
        return ("P2", "representative image") if folder == "Representative Image(s)" else None
    if folder == "metadata":
        return ("P1", "metadata")
    if ARCHIVE.search(key) or not DOCUMENT.search(key):
        return None
    if folder == "Experimental table":
        return ("P1", "experimental table")
    if re.search(r"read.?me|faq|nomenclature|description|list_of_data", name):
        return ("P1", "read-me / data description")
    if re.search(r"srd|requirement", name):
        return ("P1", "requirements document")
    if re.search(r"test.?matri|as.?run", name):
        return ("P1", "test matrix")
    if folder in ("Calibration", "Reference Data"):
        return ("P1", "calibration / reference data")
    if folder == "Reports":
        return ("P1", "report")
    if re.search(r"mergeresult|data.?summary|retrieved data", name):
        return ("P1", "summary results")
    if folder == "Analyzed Data" and name.endswith(".csv"):
        return ("P1", "analyzed data (csv)")
    if folder in ("Analyzed Data", "Science Documents", "Simulation"):
        return ("P2", "analysis / science document")
    return ("P3", "context (presentation, engineering)")


def file_name(key):
    """PSI's file name: everything after psi-data/<accession>/<folder>/.

    A few PSI file names contain '/', so the last path segment is not enough.
    """
    parts = key.split("/")
    return "/".join(parts[3:]) if len(parts) > 3 else parts[-1]


def process(accession):
    rec = psi_client.investigation(accession)
    version = int(rec["version"])
    leaves = psi_client.list_files(accession, version)
    files, names = [], Counter(file_name(f["key"]) for f in leaves)
    for f in leaves:
        c = classify(f["key"])
        if not c:
            continue
        name = file_name(f["key"])
        files.append({
            "accession": accession,
            "key": f["key"],
            "file": name,
            "file_version": f.get("version"),
            "bytes": int(float(f.get("bytes_size") or 0)),
            "priority": c[0],
            "reason": c[1],
            "name_is_unique": names[name] == 1,
        })
    summary = {
        "accession": accession,
        "acronym": rec.get("investigationAcronym") or "",
        "title": rec.get("title") or "",
        "doi": rec.get("doi") or "",
        "license": rec.get("licenseIdentifier") or "",
        "version": version,
        "project_type": rec.get("projectType") or "",
        "release_date": rec.get("releaseDate") or "",
        "files_in_version": len(leaves),
        "files_selected": len(files),
    }
    return summary, files


def main():
    catalog = psi_client.search_investigations()
    combustion = sorted(
        (s["Accession"] for s in catalog if "Combustion Science" in str(s.get("Research Area"))),
        key=lambda a: int(a.split("-")[1]),
    )
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(process, combustion))

    investigations = [r[0] for r in results]
    files = [f for r in results for f in r[1]]
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": psi_client.API,
        "catalog_size": len(catalog),
        "selection": "PSI Research Area == 'Combustion Science'",
        "investigations": investigations,
        "files": files,
    }
    (OUT / "psi_manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding="utf-8")
    with open(OUT / "investigations.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(investigations[0]))
        w.writeheader()
        w.writerows(investigations)

    totals = Counter()
    for f in files:
        totals[(f["priority"], "n")] += 1
        totals[(f["priority"], "bytes")] += f["bytes"]
    print(f"catalog: {len(catalog)} investigations | combustion: {len(combustion)}")
    for p in ("P1", "P2", "P3"):
        print(f"{p}: {totals[(p, 'n')]} files, {totals[(p, 'bytes')] / 1e6:.1f} MB")
    dup = sum(1 for f in files if not f["name_is_unique"])
    print(f"files whose name repeats inside their investigation: {dup}")


if __name__ == "__main__":
    main()
