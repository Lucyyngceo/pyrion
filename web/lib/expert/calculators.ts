// Deterministic calculators for the expert chat. The model must CALL these instead of doing arithmetic: in the
// benchmark every model put a wrong number in (34 % x 8.2 psia is 2.79 psia, not what two of them said).
// Pure TypeScript. Units and factors come from the engine (the table of validation/run_all.py), so there is one table.

import { KPA_PER_PSI, QUANTITY_FACTORS, parseQuantity, type Quantity } from "../../../engine/src/index.ts";

const TO_KPA = QUANTITY_FACTORS.TO_KPA;
const FACTOR_NOTE = "unit table of validation/run_all.py (1 psia = 6.894757 kPa, 1 atm = 101.325 kPa, 1 mmHg = 0.1333224 kPa)";

export interface Measured {
  value: number;
  unit: string;
}

export interface ToolOk {
  ok: true;
  tool: string;
  /** The headline result; null when the tool states a convention and no number (microgravity). */
  value: number | null;
  unit: string;
  /** Other results of the same call (psia next to kPa, differences, ...), each with its unit. */
  also: Record<string, Measured>;
  /** One plain sentence that restates the result with its numbers; every number the model may quote is in it. */
  display: string;
  /** "computed by code" line shown with the result. */
  provenance: string;
  /** Sources, when the result rests on a document (gravity names). */
  sources: { title: string; locator: string; quote: string; url?: string }[];
  /** Every number a sentence may quote from this result, as written to 4 significant figures. */
  numbers: number[];
}

export interface ToolError {
  ok: false;
  tool: string;
  code: string;
  message: string;
}

export type ToolResult = ToolOk | ToolError;

const sig = (x: number, d = 4) => Number(x.toPrecision(d));
const text = (x: number) => String(sig(x));
const provenance = (extra = "") => `computed by code (PYRION engine, ${FACTOR_NOTE})${extra}`;

function fail(tool: string, code: string, message: string): ToolError {
  return { ok: false, tool, code, message };
}

function collectNumbers(value: number | null, also: Record<string, Measured>): number[] {
  const out = new Set<number>();
  if (value !== null) out.add(sig(value));
  for (const m of Object.values(also)) out.add(sig(m.value));
  return [...out];
}

// ---- parsing the model's arguments with the engine (never by hand) ----

/** An oxygen fraction: "34 %", "0.34", 34 (a bare number above 1 is percent), 0.34. */
function oxygen(tool: string, o2: string | number): { fraction: number } | ToolError {
  const q = parseQuantity(String(o2), "o2_mole_fraction");
  return q.ok ? { fraction: q.value } : fail(tool, q.code, q.message);
}

/** A pressure WITH a unit: "8.2 psia", {value: 8.2, unit: "psia"}. Gauge pressure is refused. */
function pressure(tool: string, p: string | Measured): { kpa: number; q: Quantity } | ToolError {
  const written = typeof p === "string" ? p : `${p.value} ${p.unit}`;
  const q = parseQuantity(written, "pressure");
  return q.ok ? { kpa: q.value, q } : fail(tool, q.code, q.message);
}

const fromKpa = (kpa: number) => ({ kpa, psia: kpa / TO_KPA.psia });

// ---- the tools ----

/** Oxygen partial pressure = oxygen fraction x total pressure. */
export function o2PartialPressure(o2: string | number, total: string | Measured): ToolResult {
  const tool = "o2PartialPressure";
  const f = oxygen(tool, o2);
  if ("ok" in f) return f;
  const p = pressure(tool, total);
  if ("ok" in p) return p;
  const pp = f.fraction * p.kpa;
  const { kpa, psia } = fromKpa(pp);
  const tot = fromKpa(p.kpa);
  const also: Record<string, Measured> = {
    pO2_psia: { value: psia, unit: "psia" },
    total_kpa: { value: tot.kpa, unit: "kPa" },
    total_psia: { value: tot.psia, unit: "psia" },
    o2_percent: { value: f.fraction * 100, unit: "%" },
  };
  return {
    ok: true,
    tool,
    value: kpa,
    unit: "kPa",
    also,
    display: `Oxygen partial pressure = ${text(f.fraction * 100)} % x ${text(tot.kpa)} kPa (${text(tot.psia)} psia) = ${text(kpa)} kPa (${text(psia)} psia).`,
    provenance: provenance(),
    sources: [],
    numbers: collectNumbers(kpa, also),
  };
}

const PRESSURE_UNITS = Object.keys(TO_KPA);

/** Convert a pressure between kPa, Pa, atm, bar, mbar, psi (absolute), psia, mmHg and torr. Gauge units are refused. */
export function convertPressure(value: number, from: string, to: string): ToolResult {
  const tool = "convertPressure";
  const f = from.trim().toLowerCase();
  const t = to.trim().toLowerCase();
  if (/psig|barg|kpag|gauge|psid/.test(f + " " + t)) return fail(tool, "gauge_pressure", "Gauge pressure is relative to the surroundings; give an absolute pressure (psia, kPa, atm, ...).");
  if (!Number.isFinite(value)) return fail(tool, "not_a_number", "The value is not a finite number.");
  if (!PRESSURE_UNITS.includes(f)) return fail(tool, "unknown_unit", `"${from}" is not a pressure unit this tool knows (${PRESSURE_UNITS.join(", ")}).`);
  if (!PRESSURE_UNITS.includes(t)) return fail(tool, "unknown_unit", `"${to}" is not a pressure unit this tool knows (${PRESSURE_UNITS.join(", ")}).`);
  const kpa = value * TO_KPA[f];
  const result = kpa / TO_KPA[t];
  const also: Record<string, Measured> = { kpa: { value: kpa, unit: "kPa" } };
  return {
    ok: true,
    tool,
    value: result,
    unit: to.trim(),
    also,
    display: `${text(value)} ${from.trim()} = ${text(result)} ${to.trim()} (${text(kpa)} kPa).`,
    provenance: provenance(f === "psi" || t === "psi" ? "; psi is taken as absolute" : ""),
    sources: [],
    numbers: collectNumbers(result, also),
  };
}

const TEMPERATURE_UNITS: Record<string, "K" | "C" | "F"> = { k: "K", kelvin: "K", c: "C", "°c": "C", degc: "C", celsius: "C", f: "F", "°f": "F", degf: "F", fahrenheit: "F" };

/** Convert a temperature between K, °C and °F (exact definitions: K = °C + 273.15, °F = °C x 9/5 + 32). */
export function convertTemperature(value: number, from: string, to: string): ToolResult {
  const tool = "convertTemperature";
  const f = TEMPERATURE_UNITS[from.trim().toLowerCase().replace(/^degrees?\s*/, "")];
  const t = TEMPERATURE_UNITS[to.trim().toLowerCase().replace(/^degrees?\s*/, "")];
  if (!f || !t) return fail(tool, "unknown_unit", "Temperature units this tool knows: K, °C, °F.");
  if (!Number.isFinite(value)) return fail(tool, "not_a_number", "The value is not a finite number.");
  const kelvin = f === "K" ? value : f === "C" ? value + 273.15 : ((value - 32) * 5) / 9 + 273.15;
  if (kelvin < 0) return fail(tool, "below_absolute_zero", "That temperature is below absolute zero.");
  const out = t === "K" ? kelvin : t === "C" ? kelvin - 273.15 : ((kelvin - 273.15) * 9) / 5 + 32;
  const label = (u: "K" | "C" | "F") => (u === "K" ? "K" : `°${u}`);
  const also: Record<string, Measured> = { kelvin: { value: kelvin, unit: "K" } };
  return {
    ok: true,
    tool,
    value: out,
    unit: label(t),
    also,
    display: `${text(value)} ${label(f)} = ${text(out)} ${label(t)}.`,
    provenance: "computed by code (exact definitions: K = °C + 273.15; °F = °C x 9/5 + 32)",
    sources: [],
    numbers: collectNumbers(out, also),
  };
}

export interface AtmosphereInput {
  name?: string;
  o2: string | number;
  pressure: string | Measured;
}

const relative = (a: number, b: number) => (a === 0 ? null : (b - a) / a);

/** Two atmospheres side by side: oxygen partial pressure, total pressure, oxygen fraction, and b relative to a. */
export function compareAtmospheres(a: AtmosphereInput, b: AtmosphereInput): ToolResult {
  const tool = "compareAtmospheres";
  const one = (x: AtmosphereInput, which: string): { r: ToolOk; name: string } | ToolError => {
    const r = o2PartialPressure(x.o2, x.pressure);
    return r.ok ? { r, name: x.name ?? which } : { ...r, tool, message: `${which}: ${r.message}` };
  };
  const A = one(a, "A");
  if ("ok" in A) return A;
  const B = one(b, "B");
  if ("ok" in B) return B;
  const get = (r: ToolOk, key: string) => (r.also[key] as Measured).value;
  const pa = { pp: A.r.value as number, total: get(A.r, "total_kpa"), o2: get(A.r, "o2_percent") };
  const pb = { pp: B.r.value as number, total: get(B.r, "total_kpa"), o2: get(B.r, "o2_percent") };
  const dPp = relative(pa.pp, pb.pp);
  const dTotal = relative(pa.total, pb.total);
  const dO2 = relative(pa.o2, pb.o2);
  const pct = (x: number | null) => (x === null ? "not defined" : `${x >= 0 ? "+" : ""}${text(x * 100)} %`);
  const also: Record<string, Measured> = {
    pO2_a_kpa: { value: pa.pp, unit: "kPa" },
    pO2_a_psia: { value: fromKpa(pa.pp).psia, unit: "psia" },
    pO2_b_kpa: { value: pb.pp, unit: "kPa" },
    pO2_b_psia: { value: fromKpa(pb.pp).psia, unit: "psia" },
    total_a_kpa: { value: pa.total, unit: "kPa" },
    total_b_kpa: { value: pb.total, unit: "kPa" },
    o2_a_percent: { value: pa.o2, unit: "%" },
    o2_b_percent: { value: pb.o2, unit: "%" },
    ...(dPp !== null ? { pO2_relative_difference_percent: { value: dPp * 100, unit: "%" } } : {}),
    ...(dTotal !== null ? { total_relative_difference_percent: { value: dTotal * 100, unit: "%" } } : {}),
    ...(dO2 !== null ? { o2_relative_difference_percent: { value: dO2 * 100, unit: "%" } } : {}),
  };
  return {
    ok: true,
    tool,
    value: dPp === null ? null : dPp * 100,
    unit: "% (oxygen partial pressure of B relative to A)",
    also,
    display:
      `${A.name}: ${text(pa.o2)} % oxygen at ${text(pa.total)} kPa gives an oxygen partial pressure of ${text(pa.pp)} kPa (${text(fromKpa(pa.pp).psia)} psia). ` +
      `${B.name}: ${text(pb.o2)} % at ${text(pb.total)} kPa gives ${text(pb.pp)} kPa (${text(fromKpa(pb.pp).psia)} psia). ` +
      `${B.name} relative to ${A.name}: oxygen partial pressure ${pct(dPp)}, total pressure ${pct(dTotal)}, oxygen fraction ${pct(dO2)}.`,
    provenance: provenance(),
    sources: [],
    numbers: collectNumbers(dPp === null ? null : dPp * 100, also),
  };
}

/** The gravity of a named body or regime, with its source. Moon: 0.16 g and 0.165 g; Mars: 0.38 g; Earth: 1 g; microgravity: a regime, no level. */
export function gravityValue(name: string): ToolResult {
  const tool = "gravityValue";
  const q = parseQuantity(name, "gravity_level");
  if (!q.ok) return fail(tool, q.code, q.message);
  const sources: ToolOk["sources"] = [];
  const also: Record<string, Measured> = {};
  const lower = name.toLowerCase();
  const isMoon = q.value === 0.165 && q.gravity_regime === "partial_gravity";
  if (isMoon) {
    also.lunar_presentation_g = { value: 0.16, unit: "g" };
    sources.push({ title: "Ruff, Impact of Lunar Gravity on Material Flammability (NTRS 20210020446)", locator: "page 3", quote: "glunar = 0.16 gearth" });
    sources.push({ title: "Ferkul et al., LPSC 2026 (NTRS 20260001966)", locator: "PDF p. 13 (slide 12)", quote: "Lunar-g = 0.165 gE" });
  } else if (q.source.document) {
    sources.push({ title: q.source.document.file, locator: q.source.document.locator ?? `page ${q.source.document.page}`, quote: q.source.document.quote, ...(q.source.document.url ? { url: q.source.document.url } : {}) });
  }
  const regimeText = q.gravity_regime === "microgravity" ? "microgravity (a regime; the engine asserts no level)" : q.gravity_regime ? q.gravity_regime.replace("_", " ") : "no regime";
  const value = q.gravity_regime === "microgravity" && q.unit_original === "" ? null : q.value;
  return {
    ok: true,
    tool,
    value,
    unit: "g",
    also,
    display: value === null ? `${name.trim()}: ${regimeText}. ${q.notes[q.notes.length - 1] ?? ""}`.trim() : `${name.trim()}: ${text(value)} g (${regimeText})${isMoon ? "; 0.16 g is the figure of the lunar-gravity presentation, 0.165 g that of the FM2 centrifuge" : ""}.`,
    provenance: `computed by code (PYRION engine gravity table; ${lower === "earth" || value === 1 ? "1 g is the unit of the gravity level" : "see sources"})`,
    sources,
    numbers: collectNumbers(value, also),
  };
}

// ---- dispatch for the chat (the model names a tool and gives arguments; everything else is code) ----

export const CALCULATORS = {
  o2PartialPressure: (a: Record<string, unknown>) => o2PartialPressure(a.o2 as string | number, a.pressure as string | Measured),
  convertPressure: (a: Record<string, unknown>) => convertPressure(Number(a.value), String(a.from), String(a.to)),
  convertTemperature: (a: Record<string, unknown>) => convertTemperature(Number(a.value), String(a.from), String(a.to)),
  compareAtmospheres: (a: Record<string, unknown>) => compareAtmospheres(a.a as AtmosphereInput, a.b as AtmosphereInput),
  gravityValue: (a: Record<string, unknown>) => gravityValue(String(a.name)),
} as const;

export type CalculatorName = keyof typeof CALCULATORS;

export const CALCULATOR_SPECS: Record<CalculatorName, string> = {
  o2PartialPressure: 'o2PartialPressure({ o2: "34 %", pressure: "8.2 psia" }): oxygen partial pressure in kPa and psia. Pressure needs a unit; gauge pressure is refused.',
  convertPressure: 'convertPressure({ value: 8.2, from: "psia", to: "kPa" }): units kPa, Pa, atm, bar, mbar, psi, psia, mmHg, torr.',
  convertTemperature: 'convertTemperature({ value: 22, from: "C", to: "K" }): units K, C, F.',
  compareAtmospheres: 'compareAtmospheres({ a: { name, o2, pressure }, b: { name, o2, pressure } }): partial pressure, total pressure and oxygen fraction of each, and b relative to a.',
  gravityValue: 'gravityValue({ name: "Moon" }): gravity with its source (Moon 0.16 / 0.165 g, Mars 0.38 g, Earth 1 g, microgravity is a regime).',
};

/** Run a tool by name; an unknown name or a throw is a typed error, never an exception. */
export function runCalculator(name: string, args: Record<string, unknown>): ToolResult {
  if (!Object.hasOwn(CALCULATORS, name)) return fail(name, "unknown_tool", `Unknown tool "${name}". Tools: ${Object.keys(CALCULATORS).join(", ")}.`);
  try {
    return CALCULATORS[name as CalculatorName](args ?? {});
  } catch (e) {
    return fail(name, "bad_arguments", `The arguments do not fit this tool: ${(e as Error).message}`);
  }
}

/** psia per kPa and kPa per psia as the engine states them (for display next to results). */
export const PSI_FACTORS = { kpaPerPsiaTable: TO_KPA.psia, kpaPerPsiExact: KPA_PER_PSI };
