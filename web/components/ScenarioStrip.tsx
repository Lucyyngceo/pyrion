"use client";

import type { Evaluation } from "@/lib/engine";
import { levelPhrase } from "@/lib/plain";
import { PRESET_VIEWS, sourcesOf } from "@/lib/presets";
import { fuelSplit, type ScenarioFacts } from "@/lib/scenarios";
import type { EnvelopeStatus } from "@/lib/summary";
import type { Investigation } from "@/lib/types";
import { fmt, kpaToPsi, valueLabel } from "@/lib/units";
import type { TargetState } from "@/lib/preset-apply";

export const FM2_URL = "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/flammability-of-materials-on-the-moon-fm2/";
export const FM2_QUOTE = "materials may burn at lower oxygen concentrations in lunar gravity compared to Earth";
const CHALLENGE_QUOTE = "there is currently no partial-gravity combustion data available in PSI";

export interface Computed {
  facts: ScenarioFacts;
  status: EnvelopeStatus;
  evaluation: Evaluation;
}

interface Props {
  state: TargetState;
  /** Live results for tiles 1-3 and for the current controls, all computed by the engine. */
  iss: Computed | null;
  lunar: Computed | null;
  nesc: Computed | null;
  /** The NESC atmosphere with microgravity swapped in, for tile 3's second line. */
  nescMicro: Computed | null;
  mine: Computed | null;
  investigations: Investigation[];
  onPick: (presetId: string) => void;
  onCustom: () => void;
}

const TILE_PRESETS = { iss: "iss-cabin-air", lunar: "challenge-lunar-base", nesc: "nesc-8.2psia-34o2-lunar", nescA: "nesc-10.2psia-26.5o2-lunar" } as const;

/** "21 % O₂ · 14.7 psia · microgravity", from the preset's own source values (a source that says "psi" is quoted as written). */
function conditionOf(presetId: string) {
  const v = PRESET_VIEWS.find((p) => p.preset.id === presetId);
  if (!v) return null;
  const p = v.preset;
  const o2 = p.continuous.o2_mole_fraction;
  const pr = p.continuous.pressure;
  const gl = p.continuous.gravity_level?.value;
  const g = p.regime.gravity_regime?.value;
  const unit = pr?.unit_original ?? "";
  return {
    o2: o2 ? `${fmt(o2.value * 100, 1)} % O₂` : "",
    pressure: pr ? `${pr.value_original ?? fmt(kpaToPsi(pr.value), 1)} ${unit || "psia"}` : "",
    absoluteNote: unit === "psi" ? "Absolute pressure per the source (the source writes “psi”)." : undefined,
    gravity: gl !== undefined ? `${fmt(gl, 2)} g` : g ? valueLabel(g) : "",
    sources: sourcesOf(p)
      .map((s) => `${s.identifier.split(" (")[0]}, ${s.locator}: “${s.quote}”`)
      .join("\n"),
  };
}

/** The solid-fuel sentence: computed from the closest solid-fuel investigation, never typed. */
function solidLine(f: ScenarioFacts, name: (accession: string) => string, lead = "Solid fuel"): string {
  if (f.solid.applicable.length > 0) return `${lead}: ${f.solid.applicable.map(name).join(", ")} applies.`;
  if (f.solid.closest) {
    const lvl = f.solid.closest.level;
    return `${lead}: none applies (closest: ${name(f.solid.closest.accession)}${lvl ? `, ${levelPhrase(lvl)}` : ""}).`;
  }
  if (f.untested) return `${lead}: no PSI test in this gravity regime.`;
  return `${lead}: none applies${f.solid.undecided ? `; ${f.solid.undecided} lack the stated values to compare` : ""}.`;
}

const nameFor = (investigations: Investigation[]) => (accession: string) => investigations.find((i) => i.accession === accession)?.acronym || accession;

function Tile({
  active,
  title,
  cond,
  onPick,
  children,
  hover,
  className = "",
}: {
  active: boolean;
  title: string;
  cond: React.ReactNode;
  onPick: () => void;
  children: React.ReactNode;
  hover?: string;
  className?: string;
}) {
  return (
    <div className={`tile ${active ? "tile-on" : ""} ${className}`} title={hover}>
      <button type="button" className="tile-pick" aria-pressed={active} onClick={onPick}>
        <span className="tile-title">{title}</span>
        <span className="tile-cond">{cond}</span>
      </button>
      <div className="tile-body">{children}</div>
    </div>
  );
}

export default function ScenarioStrip({ state, iss, lunar, nesc, nescMicro, mine, investigations, onPick, onCustom }: Props) {
  const name = nameFor(investigations);
  const total = investigations.length;
  const preset = state.presetId;
  const isTile = preset === TILE_PRESETS.iss || preset === TILE_PRESETS.lunar || preset === TILE_PRESETS.nesc || preset === TILE_PRESETS.nescA;
  const cIss = conditionOf(TILE_PRESETS.iss);
  const cLunar = conditionOf(TILE_PRESETS.lunar);
  const cNesc = conditionOf(TILE_PRESETS.nesc);

  const cond = (c: NonNullable<ReturnType<typeof conditionOf>>) => (
    <>
      {c.o2} · <span title={c.absoluteNote}>{c.pressure}</span> · {c.gravity}
    </>
  );
  const summary = (c: Computed | null) => {
    if (!c) return "Computing…";
    const f = c.facts;
    if (f.applicable > 0) {
      const split = fuelSplit(f.applicableByFuel);
      return `${f.applicable} applicable${split ? ` (${split})` : ""}${f.extrapolation ? ` · ${f.extrapolation} need extrapolation` : ""}`;
    }
    return `0 applicable · ${c.status.headline}`;
  };

  const myCond = `${fmt(state.o2 * 100, 1)} % O₂ · ${fmt(kpaToPsi(state.pressure), 1)} psia · ${state.gravityLevel !== undefined ? `${fmt(state.gravityLevel, 2)} g` : state.regime.gravity_regime ? valueLabel(state.regime.gravity_regime) : "gravity open"}`;

  return (
    <section className="scenario-strip" aria-label="Scenarios">
      <Tile active={preset === TILE_PRESETS.iss} title="ISS cabin air" cond={cIss ? cond(cIss) : ""} hover={cIss?.sources} onPick={() => onPick(TILE_PRESETS.iss)}>
        <p className="tile-head">{summary(iss)}</p>
        {iss && <p className="tile-line">{solidLine(iss.facts, name)}</p>}
      </Tile>

      <Tile active={preset === TILE_PRESETS.lunar} title="Lunar habitat (challenge)" cond={cLunar ? cond(cLunar) : ""} hover={cLunar?.sources} onPick={() => onPick(TILE_PRESETS.lunar)}>
        <p
          className="tile-head"
          title={`NASA's challenge statement: “${CHALLENGE_QUOTE}”. That count is NASA's text, not our extraction${lunar ? `; in the records PYRION extracted, ${lunar.facts.partialGravity} of ${total} investigations state partial gravity` : ""}.`}
        >
          {lunar ? `${lunar.facts.partialGravity} of ${total}` : `– of ${total}`} PSI investigations ran in partial gravity
        </p>
        <p className="tile-line" title="Challenge statement (spaceappschallenge.org, Flame in Freefall)">
          NASA expects such data from LUCI and FM2.
        </p>
        <p className="tile-line tile-quote">
          Why it matters: “{FM2_QUOTE}”{" "}
          <a href={FM2_URL} target="_blank" rel="noreferrer">
            NASA, FM2 page
          </a>
        </p>
        {lunar && <p className="tile-line tile-status">{summary(lunar)}</p>}
      </Tile>

      <Tile
        active={preset === TILE_PRESETS.nesc || preset === TILE_PRESETS.nescA}
        title="NASA exploration atmosphere"
        cond={cNesc ? cond(cNesc) : ""}
        hover={cNesc?.sources}
        onPick={() => onPick(TILE_PRESETS.nesc)}
      >
        <p className="tile-head">{summary(nesc)}</p>
        {nescMicro && (
          <p className="tile-line">
            In microgravity the same atmosphere gives {nescMicro.facts.applicable} applicable.{" "}
            {nescMicro.facts.solid.applicable.length === 0 && nescMicro.facts.solid.closest?.level
              ? `Even in microgravity, solid fuel is ${levelPhrase(nescMicro.facts.solid.closest.level)}.`
              : solidLine(nescMicro.facts, name, "Solid fuel in microgravity")}
          </p>
        )}
        <p className="tile-line tile-alt">
          <button type="button" className="linklike small" onClick={() => onPick(TILE_PRESETS.nescA)}>
            Or atmosphere A: 26.5 % O₂ · 10.2 psia
          </button>
        </p>
      </Tile>

      <Tile active={!isTile} className="tile-mine" title="Your condition" cond={myCond} onPick={onCustom} hover="The controls on the left. Every number is computed by the engine for exactly these values.">
        <p className="tile-head">{summary(mine)}</p>
        {mine && <p className="tile-line">{solidLine(mine.facts, name)}</p>}
      </Tile>
    </section>
  );
}

