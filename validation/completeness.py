"""Completeness audit: is everything PSI holds for the combustion investigations accounted for?

Against the live PSI catalog, without trusting the manifest:
 1. the catalog search returns every investigation (total hits == records returned)
 2. every file of the current version of each investigation is in the manifest or under Raw Data
 3. every manifest file is downloaded with status ok (known PSI-side failures listed)
 4. files flagged restricted or not visible
 5. related investigations outside the selection
 6. files present in older versions and absent from the current one (informational)

Usage:  python -I validation/completeness.py
Output: validation/reports/completeness.md
"""
import csv
import json
import sys
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import psi_client  # noqa: E402

MANIFEST = ROOT / "data" / "manifest"


def main():
    out = []
    raw = psi_client.get_json(f"{psi_client.API}/repo/search?term=&source=psi&type=investigation&from=0&size=500")
    total = raw["hits"]["total"]
    total = total.get("value", total) if isinstance(total, dict) else total
    hits = [h["_source"] for h in raw["hits"]["hits"]]
    out.append(f"1. Catalog: total hits {total}, returned {len(hits)} -> {'complete' if total == len(hits) else 'INCOMPLETE'}")

    manifest = json.loads((MANIFEST / "psi_manifest.json").read_text(encoding="utf-8"))
    selected = {f["key"]: f for f in manifest["files"]}
    accs = [i["accession"] for i in manifest["investigations"]]
    versions = {i["accession"]: int(i["version"]) for i in manifest["investigations"]}
    combustion = sorted((h["Accession"] for h in hits if "Combustion Science" in str(h.get("Research Area"))),
                        key=lambda a: int(a.split("-")[1]))
    out.append(f"   Combustion Science investigations in catalog: {len(combustion)}; in manifest: {len(accs)}; "
               f"difference: {sorted(set(combustion) ^ set(accs)) or 'none'}")

    def listing(a):
        rec = psi_client.investigation(a)
        v = int(rec["version"])
        return a, rec, v, psi_client.list_files(a, v)

    with ThreadPoolExecutor(max_workers=4) as pool:
        live = list(pool.map(listing, accs))

    missing, restricted, version_moved, raw_n, raw_b = [], [], [], 0, 0
    per_inv = []
    for a, rec, v, leaves in live:
        if v != versions[a]:
            version_moved.append(f"{a}: manifest v{versions[a]}, live v{v}")
        n_sel = n_raw = 0
        for f in leaves:
            k = f["key"]
            if f.get("restricted") or f.get("restrictedAccess") or f.get("visible") is False:
                restricted.append(k)
            if "/Raw Data/" in k:
                n_raw += 1
                raw_n += 1
                raw_b += int(float(f.get("bytes_size") or 0))
            elif k in selected:
                n_sel += 1
            else:
                missing.append(k)
        per_inv.append((a, v, len(leaves), n_sel, n_raw))
    out.append(f"2. Live files: {sum(p[2] for p in per_inv)}; selected (P1-P4): {sum(p[3] for p in per_inv)}; "
               f"Raw Data: {raw_n} ({raw_b / 1e12:.2f} TB); NOT accounted for: {len(missing)}")
    out += [f"   MISSING {k}" for k in missing[:50]]
    out.append(f"   Version changed since manifest: {version_moved or 'none'}")

    ok, bad = {}, []
    for f in sorted(MANIFEST.glob("checksums_P*.csv")):
        with open(f, encoding="utf-8") as fh:
            for r in csv.DictReader(l for l in fh if not l.startswith("#")):
                if r["status"] == "ok":
                    ok[r["path"]] = int(r["bytes"])
                elif r["source"].startswith(("PSI ", "psi-data")) or "psi-data" in r["source"]:
                    bad.append((r["path"] or r["source"], r["status"][:80]))
    not_dl = [k for k in selected if k not in ok]
    size_diff = [k for k, f in selected.items() if k in ok and ok[k] != f["bytes"]]
    out.append(f"3. Manifest PSI files: {len(selected)}; downloaded ok: {len(selected) - len(not_dl)}; "
               f"not downloaded: {len(not_dl)}; size differs from catalog: {len(size_diff)}")
    out += [f"   not downloaded: {k}" for k in not_dl]
    out += [f"   size differs: {k}" for k in size_diff]

    out.append(f"4. Files flagged restricted / not visible: {len(restricted)}")
    out += [f"   {k}" for k in restricted[:20]]

    related = set()
    for a, rec, v, _ in live:
        for h in hits:
            if h["Accession"] == a:
                import re
                for r in re.findall(r"PSI-\d+", str(h.get("Related Investigations") or "")):
                    if r not in accs:
                        related.add(f"{r} (related to {a})")
    out.append(f"5. Related investigations outside the selection: {sorted(related) or 'none'}")

    # Older versions: a file absent from the current version counts as "renamed" when a current
    # file of the same investigation has the same size (and, when both have one, the same ETag).
    gone, renamed, unmatched = Counter(), Counter(), defaultdict(list)
    for a, rec, v, leaves in live:
        current = {f["key"] for f in leaves}
        cur_sizes = Counter(int(float(f.get("bytes_size") or 0)) for f in leaves)
        cur_etags = {f.get("ETag") for f in leaves if f.get("ETag")}
        seen = set()
        for old in range(1, v):
            try:
                old_leaves = psi_client.list_files(a, old)
            except Exception:
                continue
            for f in old_leaves:
                k = f["key"]
                if k in current or k in seen or "/Raw Data/" in k:
                    continue
                seen.add(k)
                gone[a] += 1
                size = int(float(f.get("bytes_size") or 0))
                if (f.get("ETag") and f["ETag"] in cur_etags) or (size and cur_sizes[size]):
                    renamed[a] += 1
                else:
                    unmatched[a].append((old, k, size))
    out.append(f"6. Non-raw files in older versions, absent from the current one: {sum(gone.values())} "
               f"({dict(gone) or 'none'})")
    out.append(f"   same size/ETag as a current file (renamed or re-filed): {sum(renamed.values())}")
    out.append(f"   no current counterpart: {sum(len(x) for x in unmatched.values())}")
    for a in sorted(unmatched, key=lambda s: int(s.split('-')[1])):
        for old, k, size in unmatched[a][:15]:
            out.append(f"     {a} v{old} {size:>12} {k}")
        if len(unmatched[a]) > 15:
            out.append(f"     {a}: … {len(unmatched[a]) - 15} more")

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    text = f"# Completeness audit — {now}\n\n```\n" + "\n".join(out) + "\n```\n"
    (ROOT / "validation" / "reports").mkdir(parents=True, exist_ok=True)
    (ROOT / "validation" / "reports" / "completeness.md").write_text(text, encoding="utf-8")
    print("\n".join(out))


if __name__ == "__main__":
    main()
