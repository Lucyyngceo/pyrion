"""Build data/derived/timeline.json: the evidence timeline.

Per investigation: the dates stated in its PSI record (investigationStartDate, investigationEndDate,
missionStart, as written, MM-DD-YYYY) and the (O2, pressure) points of its tests from data/conditions,
with tests resolved by the engine rule (engine/src/evidence.ts: records with test_id "*" apply to every test
unless the test has its own record for that variable; status insufficient_evidence is never used). A test whose O2 or pressure is a
range contributes both ends. Points are de-duplicated per investigation (same O2 and pressure) with a count.

Placement on the time axis (PYRION convention): the year of investigationEndDate (the evidence exists by
then); if that is empty, missionStart; if both are empty, the investigation is listed as "date not stated
in PSI" and is drawn only in the final frame.

Planned FM2 tests are NOT built here: the page takes them from the engine (PLANNED_SOURCES,
NTRS 20260001966) and draws them dotted as "planned, not in PSI".

Python standard library only. Deterministic output (sorted keys).
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

from collections import defaultdict

ROOT = Path(__file__).resolve().parents[1]
COND = ROOT / "data" / "conditions"
PSI = ROOT / "data" / "raw" / "psi-data"
OUT = ROOT / "data" / "derived" / "timeline.json"
DATE_KEYS = ("investigationStartDate", "investigationEndDate", "missionStart")


def parse_number(s: str) -> float | None:
    s = s.strip()
    if not re.fullmatch(r"[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?", s):
        return None
    return float(s)


def parse_values(s: str) -> list[float] | None:
    parts = s.split("..")
    if len(parts) == 1:
        n = parse_number(s)
        return None if n is None else [n]
    if len(parts) != 2:
        return None
    lo, hi = parse_number(parts[0]), parse_number(parts[1])
    if lo is None or hi is None or lo > hi:
        return None
    return [lo] if lo == hi else [lo, hi]


def acc_key(a: str) -> int:
    return int(a.split("-")[1])


def natural(s: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def load_records() -> list[dict]:
    rows = []
    for p in sorted(COND.glob("PSI-*.csv"), key=lambda p: acc_key(p.stem)):
        with p.open(encoding="utf-8-sig", newline="") as f:
            for i, r in enumerate(csv.DictReader(f), start=2):
                r = dict(r)
                r["_file"] = f"data/conditions/{p.name}"
                r["_line"] = i
                rows.append(r)
    return rows


def usable(r: dict) -> bool:
    return r["status"] != "insufficient_evidence"


def resolve_tests(records: list[dict]) -> list[dict]:
    """[{accession, test_id, vars: {variable: [usable records]}, excluded: {variable: n}}], engine rule."""
    by_acc: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        by_acc[r["accession"]].append(r)
    tests = []
    for acc in sorted(by_acc, key=acc_key):
        recs = by_acc[acc]
        named = sorted({r["test_id"] for r in recs if r["test_id"] != "*"}, key=natural)
        star = [r for r in recs if r["test_id"] == "*"]
        variables = sorted({r["variable"] for r in recs})
        for tid in named or ["*"]:
            own = [] if tid == "*" else [r for r in recs if r["test_id"] == tid]
            vs, ex = {}, {}
            for v in variables:
                o = [r for r in own if r["variable"] == v]
                level = o if o else [r for r in star if r["variable"] == v]
                u = [r for r in level if usable(r)]
                if u:
                    vs[v] = u
                if len(level) - len(u):
                    ex[v] = len(level) - len(u)
            tests.append({"accession": acc, "test_id": tid, "vars": vs, "excluded": ex})
    return tests


def ref(r: dict) -> dict:
    return {
        "file": r["_file"],
        "line": r["_line"],
        "test_id": r["test_id"],
        "variable": r["variable"],
        "value": r["value"],
        "unit": r["unit"],
        "source_file": r["source_file"],
        "source_location": r["source_location"],
        "quote": r["quote"],
        "status": r["status"],
    }



def year(s: str) -> int | None:
    m = re.fullmatch(r"(\d{2})-(\d{2})-(\d{4})", s.strip())
    return int(m.group(3)) if m else None


def main() -> int:
    with (ROOT / "data" / "manifest" / "investigations.csv").open(encoding="utf-8-sig", newline="") as f:
        manifest = {r["accession"]: r for r in csv.DictReader(f)}
    tests = resolve_tests(load_records())
    invs = []
    for acc in sorted(manifest, key=acc_key):
        p = PSI / acc / "_investigation" / f"{acc}.json"
        d = json.loads(p.read_text(encoding="utf-8"))
        d = d[0] if isinstance(d, list) else d
        dates = {k: (d.get(k) or "") for k in DATE_KEYS}
        for k, v in dates.items():
            if v and year(v) is None:
                raise SystemExit(f"build_timeline: {acc} {k}={v!r} is not MM-DD-YYYY")
        placed_by = "investigationEndDate" if dates["investigationEndDate"] else ("missionStart" if dates["missionStart"] else None)
        pts: dict[tuple[float, float], dict] = {}
        for t in tests:
            if t["accession"] != acc:
                continue
            o2r = t["vars"].get("o2_mole_fraction", [])
            pr = t["vars"].get("pressure", [])
            o2v = sorted({x for r in o2r for x in (parse_values(r["value"]) or [])})
            pv = sorted({x for r in pr for x in (parse_values(r["value"]) or [])})
            tg = sorted({r["value"] for r in t["vars"].get("gravity_regime", [])})
            for o in o2v:
                for q in pv:
                    e = pts.setdefault((o, q), {"o2_mole_fraction": o, "pressure_kpa": q, "tests": 0, "example": None, "gravity_regime": []})
                    e["tests"] += 1
                    e["gravity_regime"] = sorted(set(e["gravity_regime"]) | set(tg))
                    if e["example"] is None:
                        e["example"] = {"test_id": t["test_id"], "o2_row": ref(o2r[0]), "pressure_row": ref(pr[0])}
        gravity = sorted({r["value"] for t in tests if t["accession"] == acc for r in t["vars"].get("gravity_regime", [])})
        invs.append({
            "accession": acc,
            "acronym": manifest[acc]["acronym"],
            "title": manifest[acc]["title"],
            "doi": manifest[acc]["doi"],
            "dates": dates,
            "dates_source": f"data/raw/psi-data/{acc}/_investigation/{acc}.json",
            "placed_by": placed_by,
            "year": year(dates[placed_by]) if placed_by else None,
            "gravity_regime": gravity,
            "points": [pts[k] for k in sorted(pts)],
        })
    # Identical start and end dates in two PSI records are flagged, never corrected.
    for i in invs:
        same = [j for j in invs if j is not i and i["dates"]["investigationStartDate"] and (j["dates"]["investigationStartDate"], j["dates"]["investigationEndDate"]) == (i["dates"]["investigationStartDate"], i["dates"]["investigationEndDate"])]
        i["date_note"] = "; ".join(f"identical to {j['acronym'] or j['accession']}'s in PSI; may be a PSI record error" for j in same) or None
    years = sorted({i["year"] for i in invs if i["year"] is not None})
    out = {
        "about": "Evidence timeline: PSI dates per investigation and the (O2, pressure) points of its tests. Built by tools/build_timeline.py.",
        "generated_by": "tools/build_timeline.py",
        "rules": {
            "label": "year as listed by PSI (end date)",
            "date_notes": "When two PSI records list the same start and end dates, both are shown as written with a note; nothing is corrected.",
            "placement": "PYRION convention: placed at the year of investigationEndDate; if empty, missionStart; if both are empty: 'date not stated in PSI', drawn only in the final frame.",
            "points": "Tests resolved by the engine rule; records with status insufficient_evidence are not used; a range gives both ends; identical points are merged with a test count and the gravity regimes of those tests.",
        },
        "counts": {
            "investigations": len(invs),
            "with_points": sum(1 for i in invs if i["points"]),
            "points": sum(len(i["points"]) for i in invs),
            "undated": sum(1 for i in invs if i["year"] is None),
        },
        "years": years,
        "investigations": invs,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    c = out["counts"]
    print(f"build_timeline: {c['investigations']} investigations, {c['with_points']} with (O2, pressure) points, {c['points']} distinct points, {c['undated']} without a stated date; years {years[0]}-{years[-1]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
