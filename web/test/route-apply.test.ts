import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { KPA_PER_PSI, PRESETS, evaluate, parseConditionCsv, routesToEvidence, type ConditionRecord, type Target } from "../../engine/src/index.ts";
import { applyPreset, stateFromTarget, toTarget, type TargetState } from "../lib/preset-apply.ts";

// Every "Take me there" route, applied the way the app applies it, must end APPLICABLE for its investigation.
const dir = join(import.meta.dirname, "../../data/conditions");
const records: ConditionRecord[] = readdirSync(dir)
  .filter((n) => /^(PSI-\d+)\.csv$/.test(n))
  .flatMap((n) => parseConditionCsv(readFileSync(join(dir, n), "utf8"), n, n.replace(".csv", "")).records);

const blank: TargetState = { presetId: null, regime: {}, o2: 0.21, pressure: 101.325 };
const iss: TargetState = { presetId: "iss-cabin-air", regime: { gravity_regime: "microgravity" }, o2: 0.21, pressure: 14.7 * KPA_PER_PSI };
const lunar = applyPreset(blank, { preset: PRESETS.find((p) => p.id === "challenge-lunar-base")! });

for (const [name, state] of [["ISS cabin air", iss], ["Lunar habitat (challenge)", lunar]] as const) {
  test(`every route from ${name} ends APPLICABLE when applied the app's way`, () => {
    const set = routesToEvidence(records, toTarget(state));
    assert.ok(set.routes.length > 0, "the preset should have routes");
    const failures: string[] = [];
    for (const r of set.routes) {
      const next = stateFromTarget(r.target as Target, state);
      const ev = evaluate(records, toTarget(next));
      const v = ev.investigations.find((i) => i.accession === r.accession)?.verdict;
      if (v !== "APPLICABLE") failures.push(`${r.accession} ends ${v}`);
    }
    assert.deepEqual(failures, [], `${failures.length} of ${set.routes.length} routes do not end APPLICABLE`);
  });
}
