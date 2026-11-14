"use client";

import { useMemo, useState } from "react";
import EnvelopeChart from "./EnvelopeChart";
import Results from "./Results";
import TargetPanel from "./TargetPanel";
import { buildEnvelope, engineInfo, evaluate } from "@/lib/engine-adapter";
import { sortLayers } from "@/lib/layers";
import { DEFAULT_PRESET, PRESETS } from "@/lib/presets";
import { envelopeStatus } from "@/lib/summary";
import type { Dataset, Target } from "@/lib/types";

export default function Explorer({ dataset }: { dataset: Dataset }) {
  const [target, setTarget] = useState<Target>(DEFAULT_PRESET.target);
  const [presetId, setPresetId] = useState<string>(DEFAULT_PRESET.id);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [openAccession, setOpenAccession] = useState<string | null>(null);

  const layers = useMemo(() => sortLayers(buildEnvelope(dataset.records)), [dataset.records]);
  const results = useMemo(
    () => evaluate(target, dataset.records, dataset.investigations),
    [target, dataset.records, dataset.investigations],
  );
  const status = envelopeStatus(results, target);
  const preset = PRESETS.find((p) => p.id === presetId);

  return (
    <>
      <div className="workbench">
        <section className="card chart-card" aria-labelledby="envelope-h">
          <div className="card-head">
            <h2 id="envelope-h">The evidence envelope</h2>
            <p className="muted small">
              Measured test points by O₂ and pressure. One layer per regime: gravity regime · fuel phase · diluent.
            </p>
          </div>
          <EnvelopeChart
            layers={layers}
            target={target}
            targetLabel={preset ? preset.label : "Custom target"}
            status={status}
            highlight={highlight}
            onPointSelect={(a) => setOpenAccession(a)}
          />
        </section>
        <aside className="card panel-card">
          <TargetPanel
            target={target}
            presetId={presetId}
            onPreset={(p) => {
              setPresetId(p.id);
              setTarget(p.target);
            }}
            onChange={(t) => {
              setPresetId("custom");
              setTarget(t);
            }}
          />
          <dl className="tally" aria-label="Verdict counts">
            <div className="t-app">
              <dt>Applicable</dt>
              <dd>{status.counts.APPLICABLE}</dd>
            </div>
            <div className="t-ext">
              <dt>Extrapolation</dt>
              <dd>{status.counts.EXTRAPOLATION}</dd>
            </div>
            <div className="t-ins">
              <dt>Insufficient evidence</dt>
              <dd>{status.counts.INSUFFICIENT_EVIDENCE}</dd>
            </div>
            <div className="t-bar">
              <dt>Not comparable</dt>
              <dd>{status.counts.REGIME_BARRIER}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <Results
        results={results}
        dataset={dataset}
        openAccession={openAccession}
        onOpenAccession={setOpenAccession}
        onHover={setHighlight}
        engineLabel={engineInfo.label}
      />

      <section className="card planned" aria-labelledby="planned-h">
        <h2 id="planned-h">
          Ranked by text similarity vs. ranked by physics <span className="tag">planned, not built yet</span>
        </h2>
        <p className="muted">
          A side-by-side of the same question ranked two ways: by text similarity of the documents, and by the physical
          applicability verdicts above.
        </p>
      </section>
    </>
  );
}
