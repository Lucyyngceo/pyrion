"""Build citation and coverage tables from the downloaded PSI investigation records.

Inputs:  data/raw/psi-data/<accession>/_investigation/<accession>.json  (written by fetch.py)
         data/manifest/psi_manifest.json
         the live PSI file listing (for coverage only)

Outputs (data/manifest/):
  publications.csv        every publication PSI lists for each investigation:
                          title, authors, DOI, DOI link, status
  hardware.csv            experiment hardware and flight platform per investigation
  experimental_tables.csv the experimental-table files PSI attaches to each investigation
  coverage.csv            per investigation and top-level folder: what PSI holds
                          and what PYRION selected (P1/P2/P3) or excluded

Usage:  python -I pipeline/build_catalog_tables.py
"""
import csv
import json
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import psi_client  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "psi-data"
OUT = ROOT / "data" / "manifest"


def write_csv(name, rows, fields):
    with open(OUT / name, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


def folder_of(key):
    parts = key.split("/")
    return parts[2] if len(parts) > 3 else "(root)"


def main():
    manifest = json.loads((OUT / "psi_manifest.json").read_text(encoding="utf-8"))
    accessions = [i["accession"] for i in manifest["investigations"]]
    records = {a: json.loads((RAW / a / "_investigation" / f"{a}.json").read_text(encoding="utf-8"))
               for a in accessions}

    pubs, hardware, tables = [], [], []
    for a in accessions:
        r = records[a]
        acronym = r.get("investigationAcronym") or ""
        for p in r.get("publications") or []:
            doi = (p.get("doi") or "").strip()
            pubs.append({
                "accession": a, "acronym": acronym,
                "title": (p.get("title") or "").strip(),
                "authors": (p.get("authorList") or "").strip(),
                "doi": doi,
                "doi_url": f"https://doi.org/{doi}" if doi else "",
                "status": ((p.get("status") or {}).get("annotationValue") or "").strip(),
            })
        hardware.append({
            "accession": a, "acronym": acronym,
            "hardware": (r.get("experimentHardware") or "").strip(),
            "hardware_link": (r.get("experimentHardwareLink") or "").strip(),
            "project_type": r.get("projectType") or "",
            "flight_program": r.get("flightProgram") or "",
            "mission": r.get("missionName") or "",
        })
        for t in r.get("experimentalTable") or []:
            tables.append({"accession": a, "acronym": acronym,
                           "file": t.get("file_name") or "", "bytes": t.get("file_size") or ""})

    write_csv("publications.csv", pubs, list(pubs[0]))
    write_csv("hardware.csv", hardware, list(hardware[0]))
    write_csv("experimental_tables.csv", tables, list(tables[0]))

    # Coverage: everything PSI holds per folder vs what the manifest selected.
    selected = {f["key"]: f["priority"] for f in manifest["files"]}
    versions = {i["accession"]: i["version"] for i in manifest["investigations"]}
    with ThreadPoolExecutor(max_workers=6) as pool:
        listings = dict(zip(accessions, pool.map(lambda a: psi_client.list_files(a, versions[a]), accessions)))
    cov = defaultdict(lambda: defaultdict(int))
    for a, leaves in listings.items():
        for f in leaves:
            c = cov[(a, folder_of(f["key"]))]
            size = int(float(f.get("bytes_size") or 0))
            p = selected.get(f["key"], "excluded")
            c["files_in_psi"] += 1
            c["bytes_in_psi"] += size
            c[f"files_{p}"] += 1
            c[f"bytes_{p}"] += size
    fields = ["accession", "folder", "files_in_psi", "bytes_in_psi",
              "files_P1", "files_P2", "files_P3", "files_excluded", "bytes_selected", "bytes_excluded"]
    rows = []
    for (a, folder), c in sorted(cov.items(), key=lambda kv: (int(kv[0][0].split("-")[1]), kv[0][1])):
        rows.append({"accession": a, "folder": folder,
                     "files_in_psi": c["files_in_psi"], "bytes_in_psi": c["bytes_in_psi"],
                     "files_P1": c["files_P1"], "files_P2": c["files_P2"], "files_P3": c["files_P3"],
                     "files_excluded": c["files_excluded"],
                     "bytes_selected": c["bytes_P1"] + c["bytes_P2"] + c["bytes_P3"],
                     "bytes_excluded": c["bytes_excluded"]})
    write_csv("coverage.csv", rows, fields)

    with_doi = sum(1 for p in pubs if p["doi"])
    total_files = sum(r["files_in_psi"] for r in rows)
    total_bytes = sum(r["bytes_in_psi"] for r in rows)
    sel_bytes = sum(r["bytes_selected"] for r in rows)
    print(f"publications: {len(pubs)} ({with_doi} with DOI) | hardware rows: {len(hardware)} "
          f"| experimental tables: {len(tables)}")
    print(f"PSI holds {total_files} files, {total_bytes / 1e12:.2f} TB; "
          f"selected {sel_bytes / 1e9:.2f} GB; excluded {(total_bytes - sel_bytes) / 1e12:.2f} TB")


if __name__ == "__main__":
    main()
