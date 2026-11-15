// Server only. Everything the Mission Planner page shows, computed by the engine from the extracted records (no model, no clock).
// The page, the designer API and the report download all read from here.

import {
  ERL_NOTE,
  ERL_SCALE,
  KPA_PER_PSI,
  MOON_BASE_BAND,
  PLANNER_LABEL,
  candidateFromPoints,
  coverage,
  coverageGained,
  erlBoard,
  fm2Hypothetical,
  gapReport,
  luciHypothetical,
  minimumTestSet,
  presetTarget,
  rankExperiments,
  type FuelPhase,
  type Habitat,
} from "../../../engine/src/index.ts";
import { ISS_PRESET } from "@/lib/presets";
import { serverData } from "@/lib/server-eval";

export const PHASES: readonly FuelPhase[] = ["solid", "liquid", "gas"];
const band = MOON_BASE_BAND;
type Cell = [o2: number, pressure: number, covered: 0 | 1];
const compact = (cells: { o2_mole_fraction: number; pressure_kpa: number; covered: boolean }[]): Cell[] => cells.map((c) => [c.o2_mole_fraction, c.pressure_kpa, c.covered ? 1 : 0]);

const catalogOf = (inv: { accession: string; acronym: string; title: string; doi: string }[]) => Object.fromEntries(inv.map((i) => [i.accession, { acronym: i.acronym, title: i.title, doi: i.doi }]));

function habitats(): Habitat[] {
  const iss = { regime: { gravity_regime: "microgravity" }, continuous: { o2_mole_fraction: ISS_PRESET.continuous.o2_mole_fraction!.value, pressure: ISS_PRESET.continuous.pressure!.value } };
  const base: { id: string; label: string; target: Habitat["target"] }[] = [
    { id: "iss", label: "ISS cabin air", target: iss },
    { id: "moon", label: "Moon Base / pressurized rover (challenge)", target: presetTarget("challenge-lunar-base") },
    { id: "nesc-a", label: "NASA exploration atmosphere, 10.2 psia / 26.5 % O2", target: presetTarget("nesc-10.2psia-26.5o2-lunar") },
    { id: "nesc-b", label: "NASA exploration atmosphere, 8.2 psia / 34 % O2", target: presetTarget("nesc-8.2psia-34o2-lunar") },
  ];
  return base.flatMap((h) => PHASES.map((p) => ({ id: `${h.id}|${p}`, label: h.label, target: { ...h.target, regime: { ...h.target.regime, fuel_phase: p } } })));
}

let cache: Promise<PlannerData> | null = null;
export function loadPlanner(): Promise<PlannerData> {
  cache ??= build();
  return cache;
}

async function build() {
  const { records, investigations } = await serverData();
  const catalog = catalogOf(investigations);
  const fm2 = fm2Hypothetical();
  const fm2o = fm2Hypothetical({ withToleranceBounds: true });
  const luci = luciHypothetical();
  const base = coverage(records, band);
  const withFm2 = coverage(records, band, { fuelPhase: "solid", extraRecords: fm2.records });
  const withFm2o = coverage(records, band, { fuelPhase: "solid", extraRecords: fm2o.records });
  const rep = gapReport(records, band, catalog);
  const mts = minimumTestSet(records, band);
  const rank = rankExperiments(records, band, [fm2, fm2o, luci]);
  const habs = habitats();
  return {
    label: PLANNER_LABEL,
    band: {
      id: band.id,
      label: band.label,
      gravity: band.gravity.regime,
      gravityLevel: band.gravity.level,
      closure: band.closure,
      convention: band.convention,
      vertices: [...band.vertices, ...band.edgePoints].map((v) => ({
        label: v.label,
        o2: v.o2_mole_fraction,
        kpa: v.pressure_kpa,
        psia: v.pressure_kpa / KPA_PER_PSI,
        sourced: v.sourced,
        asWritten: v.as_written,
        source: v.source ? { title: (v.source as { title?: string }).title ?? v.source.id, quote: v.source.quote } : null,
        edge: band.edgePoints.includes(v),
      })),
    },
    coverage: { fraction: base.fraction, covered: base.covered, total: base.total, cells: compact(base.cells), note: base.note, byPhase: rep.data.coverage.byPhase },
    layers: {
      fm2: { cells: compact(withFm2.cells), fraction: withFm2.fraction, covered: withFm2.covered, total: withFm2.total },
      fm2o: { cells: compact(withFm2o.cells), fraction: withFm2o.fraction, covered: withFm2o.covered, total: withFm2o.total },
    },
    experiments: [fm2, fm2o, luci].map((e) => ({ id: e.id, name: e.name, placeable: e.placeable, reason: e.reason, shape: e.shape, tests: e.tests, points: e.points, flag: e.flag })),
    rank,
    minimumTest: mts,
    erl: { atCentre: rep.data.erl.atCentre, scale: ERL_SCALE, note: ERL_NOTE, board: erlBoard(records, habs, []) },
    habitats: habs.map((h) => ({ id: h.id, label: h.label })),
    fingerprint: rep.fingerprint,
    engine: rep.data.engine,
  };
}
export type PlannerData = Awaited<ReturnType<typeof build>>;

/** The designer: hypothetical points in, live coverage out. Never written anywhere. */
export async function design(points: { o2: number; pressure: number }[], fuelPhase: FuelPhase) {
  const { records } = await serverData();
  const exp = candidateFromPoints("mine", "My experiment", points.map((p) => ({ o2_mole_fraction: p.o2, pressure_kpa: p.pressure })), { fuelPhase });
  const gain = coverageGained(records, band, exp, { fuelPhase });
  const withMine = coverage(records, band, { fuelPhase, extraRecords: exp.records });
  return { gain, cells: compact(withMine.cells), fraction: withMine.fraction, flag: exp.flag, shape: exp.shape };
}

export async function report() {
  const { records, investigations } = await serverData();
  return gapReport(records, band, catalogOf(investigations));
}
