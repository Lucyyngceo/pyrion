"use client";

import { SOURCES, type Evaluation } from "@/lib/engine";
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
  /** Investigations that have extracted records (the 24 of the catalogue is NASA's count; this one is ours). */
  withData: number;
  mine: Computed | null;
  investigations: Investigation[];
  onPick: (presetId: string) => void;
  onCustom: () => void;
  /** Open "What would close this gap" for a tile. */
  onGap: (which: "lunar" | "nesc" | "mine") => void;
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
    // The NTRS id of the source of the oxygen and pressure values (not of the gravity level).
    ntrs: /NTRS \d+/.exec((o2 ?? pr)?.source.identifier ?? "")?.[0],
    sources: sourcesOf(p)
      .map((s) => `${s.identifier.split(" (")[0]}, ${s.locator}: “${s.quote}”`)
      .join("\n"),
  };
}

/** The solid-fuel sentence: from the closest solid-fuel investigation that can be compared, and how many others lack the values. */
function solidLine(f: ScenarioFacts, name: (accession: string) => string): string {
  const others = f.solid.undecided > 0 ? `; ${f.solid.undecided} other${f.solid.undecided === 1 ? " lacks" : "s lack"} the values to compare` : "";
  if (f.solid.applicable.length > 0) return `Solid fuel: ${f.solid.applicable.map(name).join(", ")} applies${others}.`;
  if (f.solid.closest) {
    const lvl = f.solid.closest.level;
    return `Closest solid-fuel investigation that can be compared: ${name(f.solid.closest.accession)}${lvl ? `, ${levelPhrase(lvl)}` : ""}${others}.`;
  }
  if (f.untested) return "Solid fuel: no PSI test in this gravity regime.";
  return `Solid fuel: none can be compared here${f.solid.undecided ? `; ${f.solid.undecided} lack the values to compare` : ""}.`;
}

const nameFor = (investigations: Investigation[]) => (accession: string) => investigations.find((i) => i.accession === accession)?.acronym || accession;

function GapButton({ onClick }: { onClick: () => void }) {
  return (
    <button data-help="tile-gap-button" type="button" className="gap-btn" onClick={onClick}>
      What would close this gap
    </button>
  );
}

function Tile({
  active,
  title,
  subtitle,
  cond,
  onPick,
  children,
  hover,
  className = "",
}: {
  active: boolean;
  title: string;
  subtitle?: string;
  cond: React.ReactNode;
  onPick: () => void;
  children: React.ReactNode;
  hover?: string;
  className?: string;
}) {
  return (
    <div className={`tile ${active ? "tile-on" : ""} ${className}`} title={hover}>
      <button data-help="tile-pick" type="button" className="tile-pick" aria-pressed={active} onClick={onPick}>
        <span data-help="tile-title" className="tile-title">{title}</span>
        {subtitle && <span data-help="tile-subtitle" className="tile-sub">{subtitle}</span>}
        <span data-help="tile-condition" className="tile-cond">{cond}</span>
      </button>
      <div className="tile-body">{children}</div>
    </div>
  );
}

export default function ScenarioStrip({ state, iss, lunar, nesc, nescMicro, withData, mine, investigations, onPick, onCustom, onGap }: Props) {
  const name = nameFor(investigations);
    const preset = state.presetId;
  const isTile = preset === TILE_PRESETS.iss || preset === TILE_PRESETS.lunar || preset === TILE_PRESETS.nesc || preset === TILE_PRESETS.nescA;
  const cIss = conditionOf(TILE_PRESETS.iss);
  const cLunar = conditionOf(TILE_PRESETS.lunar);
  const cNesc = conditionOf(TILE_PRESETS.nesc);
  const cNescA = conditionOf(TILE_PRESETS.nescA);

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
    <section data-help="tile-strip" className="scenario-strip" aria-label="Scenarios">
      <Tile active={preset === TILE_PRESETS.iss} title="ISS cabin air" cond={cIss ? cond(cIss) : ""} hover={cIss?.sources} onPick={() => onPick(TILE_PRESETS.iss)}>
        <p data-help="tile-summary" className="tile-head">{summary(iss)}</p>
        {iss && <p data-help="tile-line" className="tile-line">{solidLine(iss.facts, name)}</p>}
      </Tile>

      <Tile active={preset === TILE_PRESETS.lunar} title="NASA's Moon Base" subtitle="as stated in the Flame in Freefall challenge: 30 % O₂ or more at 10.2 psi or less" cond={cLunar ? cond(cLunar) : ""} hover={cLunar?.sources} onPick={() => onPick(TILE_PRESETS.lunar)}>
        <p data-help="tile-summary" className="tile-head" title={`From the challenge statement (${SOURCES.challenge.url}). It is NASA's text, not our extraction.`}>
          NASA: “{CHALLENGE_QUOTE}”.
        </p>
        <p data-help="tile-line" className="tile-line" title="Counted in the condition records PYRION extracted, not from NASA's statement.">
          {lunar ? lunar.facts.partialGravity : "–"} of {withData} investigations with extracted records state partial gravity.
        </p>
        <p data-help="tile-line" className="tile-line" title="Challenge statement (spaceappschallenge.org, Flame in Freefall)">
          NASA expects such data from LUCI and FM2.
        </p>
        <p data-help="tile-nasa-quote" className="tile-line tile-quote">
          Why it matters: “{FM2_QUOTE}”{" "}
          <a data-help="tile-fm2-link" href={FM2_URL} target="_blank" rel="noreferrer">
            NASA, FM2 page
          </a>
        </p>
        {lunar && <p data-help="tile-summary" className="tile-line tile-status">{summary(lunar)}</p>}
        <GapButton onClick={() => onGap("lunar")} />
      </Tile>

      <Tile
        active={preset === TILE_PRESETS.nesc || preset === TILE_PRESETS.nescA}
        title="NASA exploration atmosphere"
        subtitle={cNesc?.ntrs ? `proposed for lunar habitats (${cNesc.ntrs})` : "proposed for lunar habitats"}
        cond={cNesc ? cond(cNesc) : ""}
        hover={cNesc?.sources}
        onPick={() => onPick(TILE_PRESETS.nesc)}
      >
        <p data-help="tile-summary" className="tile-head">{summary(nesc)}</p>
        {nescMicro && (
          <p data-help="tile-line" className="tile-line">
            In microgravity the same atmosphere gives {nescMicro.facts.applicable} applicable.{" "}
            {solidLine(nescMicro.facts, name)}
          </p>
        )}
        <GapButton onClick={() => onGap("nesc")} />
        <p className="tile-line tile-alt">
          <button data-help="tile-atmosphere-a" type="button" className="linklike small" onClick={() => onPick(TILE_PRESETS.nescA)}>
            Or atmosphere A: {cNescA ? `${cNescA.o2} · ${cNescA.pressure}` : ""}
          </button>
        </p>
      </Tile>

      <Tile active={!isTile} className="tile-mine" title="Your condition" cond={myCond} onPick={onCustom} hover="The controls on the left. Every number is computed by the engine for exactly these values.">
        <p data-help="tile-summary" className="tile-head">{summary(mine)}</p>
        {mine && <p data-help="tile-line" className="tile-line">{solidLine(mine.facts, name)}</p>}
        {mine && mine.facts.applicable === 0 && <GapButton onClick={() => onGap("mine")} />}
      </Tile>
    </section>
  );
}

