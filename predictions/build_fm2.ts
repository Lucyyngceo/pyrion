// Builds the pre-registered FM2 reading table from the engine's closed-chamber balance.
// Deterministic: same engine, same output. Run: node predictions/build_fm2.ts
import { writeFileSync } from 'node:fs';
import { fm2Balance, fm2Chamber, FM2_SOURCES, PMMA_STOICH, canonicalJson, ENGINE_NAME, ENGINE_VERSION } from '../engine/src/index.ts';

const STARTS = [0.37, 0.33, 0.29, 0.25];
const LIMITS = Array.from({ length: 13 }, (_, i) => (20 + i) / 100); // 20 % .. 32 %
const T_BAND_K = [288.15, 295.15, 308.15]; // 15, 22, 35 degC: assumed, not in the source
const EXPECTED_CONSUMPTION = 0.08; // NTRS 20260001966 p. 5

const note = (value: number, text: string) => ({ value, origin: { note: text } });
const rows = [];
for (const L of LIMITS) {
  const tests = STARTS.map((x0) => {
    const mol = T_BAND_K.map((T) =>
      fm2Balance(fm2Chamber({
        temperatureK: note(T, 'assumed chamber temperature'),
        startO2Fraction: note(x0, 'FM2 planned start'),
        limitO2Fraction: note(L, 'hypothesised limiting oxygen fraction'),
        stoichGO2PerGFuel: PMMA_STOICH, // not used for the oxygen columns
      })).o2ConsumableMol);
    const ignites = x0 > L;
    return {
      start_o2: x0,
      ignition_expected_under_hypothesis: ignites,
      o2_consumable_mmol_at_35C_22C_15C: [mol[2], mol[1], mol[0]].map((m) => Math.round(m * 1e5) / 100),
      final_o2_if_fuel_not_limiting: ignites ? L : x0,
      final_o2_if_consumption_capped_at_0_08: ignites ? Math.max(L, Math.round((x0 - EXPECTED_CONSUMPTION) * 100) / 100) : x0,
    };
  });
  rows.push({ hypothesised_limit_o2: L, pattern: tests.map((t) => (t.ignition_expected_under_hypothesis ? 'burn' : 'no ignition')).join(' / '), tests });
}
const out = {
  title: 'FM2 reading table, pre-registered',
  engine: `${ENGINE_NAME} ${ENGINE_VERSION}`,
  model: 'closed-chamber oxygen balance (ideal gas, fixed temperature, mole change from products ignored); not a flame model',
  inputs: {
    chamber_volume_L: 14.4, pressure_psia: 8.2, start_o2_fractions: STARTS,
    expected_consumption_mol_fraction: EXPECTED_CONSUMPTION, nasa_expected_lunar_limit: [0.24, 0.26],
    assumed_temperature_K: T_BAND_K, sources: FM2_SOURCES,
  },
  rows,
};
writeFileSync(new URL('./fm2_reading_table.json', import.meta.url), canonicalJson(out) + '\n');
console.log(`rows ${rows.length}`);
for (const r of rows) console.log((r.hypothesised_limit_o2 * 100).toFixed(0) + ' %', '|', r.pattern, '|', r.tests.map((t) => (t.final_o2_if_consumption_capped_at_0_08 * 100).toFixed(0)).join(' / '));
