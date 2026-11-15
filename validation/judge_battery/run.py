"""Judge battery: ask the running app the questions a judge might type and check invariants that need no opinion.

Usage:  python validation/judge_battery/run.py [base_url]     (default http://localhost:3000)

Checks per question
  R  repeat:      the same question parsed twice gives the same target
  E  expected:    the target matches the group's expected values (conversions from engine/src/quantity.ts)
  G  group:       every phrasing of one physical condition gives the same verdict counts
  S  suggestions: no regime axis enters the target unless the question states it
  C  context:     the model's context has no investigation id, verdict, risk or safety word, and no number
                  that is not in the question or in the target
Traps must be refused (HTTP 4xx), or answered with no claim and no invented quantity.
Results are written to validation/judge_battery/results/<UTC timestamp>.json. It spends a few cents of model credit.
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000").rstrip("/")
sys.stdout.reconfigure(encoding="utf-8")

CLAIM_WORDS = re.compile(
    r"\b(PSI-\d+|applicable|applies|apply|extrapolat\w*|barrier|insufficient|comparable|safe\w*|risk\w*|danger\w*|"
    r"approved|confirm\w*|prove\w*|validated|spread\w*|ignit\w*|extinguish\w*|flammab\w*)\b",
    re.I,
)
NUM = re.compile(r"(?<![\w.])-?\d+(?:\.\d+)?(?:e-?\d+)?", re.I)


def post(body: dict) -> tuple[int, dict]:
    req = urllib.request.Request(f"{BASE}/api/ask", data=json.dumps(body).encode(), headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, {"error": raw[:200].decode("utf-8", "replace")}


def counts(lines: list[str] | None) -> dict | None:
    if not lines:
        return None
    m = re.search(r"(\d+) applicable, (\d+) extrapolation, (\d+) insufficient evidence, (\d+) not comparable", lines[0])
    return dict(zip(["APPLICABLE", "EXTRAPOLATION", "INSUFFICIENT_EVIDENCE", "REGIME_BARRIER"], map(int, m.groups()))) if m else None


def ask(question: str) -> dict:
    s1, p1 = post({"step": "parse", "question": question})
    out: dict = {"question": question, "parse_status": s1, "error": p1.get("error"), "model": (p1.get("meta") or {}).get("model")}
    if s1 != 200:
        return out
    parsed = p1["parsed"]
    out.update(target=parsed["target"], suggestions=parsed.get("suggestions"), unstated=parsed.get("unstated"))
    s2, p2 = post({"step": "parse", "question": question})
    out["repeat_target"] = p2.get("parsed", {}).get("target") if s2 == 200 else {"status": s2}
    s3, n = post({"step": "narrate", "target": parsed["target"]})
    out.update(narrate_status=s3, verdict_counts=counts(n.get("verdicts")), context=n.get("context"), narrate_model=(n.get("meta") or {}).get("model"))
    return out


def close(a: float | None, b: float, rel: float) -> bool:
    return a is not None and abs(a - b) <= rel * abs(b)


def allowed_numbers(question: str, target: dict) -> set[float]:
    vals = {float(x) for x in NUM.findall(question.replace(",", "."))}
    c, i = target.get("continuous", {}), target.get("informational", {})
    if "o2_mole_fraction" in c:
        vals |= {c["o2_mole_fraction"], round(c["o2_mole_fraction"] * 100, 2)}
    if "pressure" in c:
        p = c["pressure"]
        vals |= {round(p, 2), round(p, 1), round(p / 6.894757, 1), round(p / 6.894757, 2), round(p / 101.325, 2)}
    if "gravity_level" in i:
        vals.add(i["gravity_level"])
    return vals


def context_problems(r: dict) -> list[str]:
    ctx = r.get("context") or ""
    probs = []
    if m := CLAIM_WORDS.search(ctx):
        probs.append(f"C: context has the word '{m.group(0)}'")
    allowed = allowed_numbers(r["question"], r.get("target", {}))
    for x in NUM.findall(ctx):
        if not any(abs(float(x) - a) <= 0.011 * max(1.0, abs(a)) for a in allowed):
            probs.append(f"C: context number {x} is not in the question or the target")
    return probs


def check_member(r: dict, expect: dict) -> list[str]:
    if r["parse_status"] != 200:
        return [f"parse failed ({r['parse_status']}): {r.get('error')}"]
    t = r["target"]
    probs = []
    if r.get("repeat_target") != t:
        probs.append(f"R: second parse differs: {json.dumps(r.get('repeat_target'))}")
    reg, c = t.get("regime", {}), t.get("continuous", {})
    if "gravity_regime" in expect and reg.get("gravity_regime") != expect["gravity_regime"]:
        probs.append(f"E: gravity_regime {reg.get('gravity_regime')} != {expect['gravity_regime']}")
    if "o2_mole_fraction" in expect and not close(c.get("o2_mole_fraction"), expect["o2_mole_fraction"], 0.005):
        probs.append(f"E: o2 {c.get('o2_mole_fraction')} != {expect['o2_mole_fraction']}")
    if "pressure_kpa" in expect and not close(c.get("pressure"), expect["pressure_kpa"], 0.005):
        probs.append(f"E: pressure {c.get('pressure')} != {expect['pressure_kpa']}")
    for k in expect.get("unstated", []):
        if k in c:
            probs.append(f"E: {k} should be unstated, got {c[k]}")
    extra = set(reg) - {"gravity_regime"}
    if extra:
        probs.append(f"S: regime axes the question does not state entered the target: {sorted(extra)}")
    if r.get("narrate_status") != 200:
        probs.append(f"narrate failed ({r.get('narrate_status')})")
    probs += context_problems(r)
    return probs


def main() -> int:
    spec = json.loads((HERE / "questions.json").read_text(encoding="utf-8"))
    results: dict = {"base": BASE, "started": datetime.now(timezone.utc).isoformat(), "groups": [], "traps": []}
    failures = 0
    group_counts: dict[str, dict] = {}
    for g in spec["groups"]:
        print(f"\n== {g['id']}")
        members = []
        for q in g["questions"]:
            r = ask(q)
            r["problems"] = check_member(r, g["expect"])
            members.append(r)
            print(f"  {'ok ' if not r['problems'] else 'BAD'} {q}\n      {r.get('verdict_counts')} | {r.get('context')}")
            for p in r["problems"]:
                print(f"      - {p}")
        seen = {json.dumps(m.get("verdict_counts"), sort_keys=True) for m in members if m.get("verdict_counts")}
        group_problem = None if len(seen) <= 1 else f"G: phrasings give different verdict counts: {sorted(seen)}"
        if group_problem:
            print(f"  BAD {group_problem}")
        group_counts[g["id"]] = json.loads(next(iter(seen))) if len(seen) == 1 else None
        failures += sum(bool(m["problems"]) for m in members) + bool(group_problem)
        results["groups"].append({"id": g["id"], "expect": g["expect"], "group_problem": group_problem, "members": members})

    print("\n== traps")
    expect_by_id = {g["id"]: g["expect"] for g in spec["groups"]}
    for t in spec["traps"]:
        r = ask(t["question"])
        e, probs = t["expect"], []
        if e == "refused":
            if r["parse_status"] == 200:
                probs.append(f"should be refused, got target {json.dumps(r.get('target'))}")
        elif e == "no-claim":
            if r["parse_status"] == 200:
                probs += context_problems(r)
                if set(r["target"].get("regime", {})) - {"gravity_regime"}:
                    probs.append("S: unstated regime axes entered the target")
        elif e == "no-invented-pressure":
            if r["parse_status"] == 200 and "pressure" in r["target"].get("continuous", {}):
                probs.append(f"pressure {r['target']['continuous']['pressure']} came from text inside the question that is not a stated condition")
        elif e.startswith("values-as:"):
            # Same o2, pressure and gravity as the group; other stated axes (e.g. a thickness) may legitimately change verdicts.
            gid = e.split(":", 1)[1]
            probs += check_member(r, expect_by_id[gid]) if r["parse_status"] == 200 else [f"should parse, got {r['parse_status']}: {r.get('error')}"]
        elif e.startswith("same-as:"):
            gid = e.split(":", 1)[1].replace("-or-refused", "")
            if r["parse_status"] == 200:
                probs += check_member(r, expect_by_id[gid])
                if gid in group_counts and group_counts[gid] and r.get("verdict_counts") != group_counts[gid]:
                    probs.append(f"G: verdicts {r.get('verdict_counts')} differ from group {gid} {group_counts[gid]}")
            elif not e.endswith("-or-refused"):
                probs.append(f"should parse like {gid}, got {r['parse_status']}: {r.get('error')}")
        r["expect"], r["problems"] = e, probs
        failures += bool(probs)
        results["traps"].append(r)
        print(f"  {'ok ' if not probs else 'BAD'} [{t['id']}] {r['parse_status']} {r.get('error') or json.dumps(r.get('target'))}")
        for p in probs:
            print(f"      - {p}")

    results["failures"] = failures
    out = HERE / "results" / f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n{failures} failing item(s). Results: {out.relative_to(HERE.parent.parent)}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
