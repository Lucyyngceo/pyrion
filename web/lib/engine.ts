// The single entry point to the PYRION applicability engine (../engine).
// The engine core is pure TypeScript with no Node built-ins, so the verdict runs in the
// browser every time the target changes. The web app never decides a verdict itself.

export {
  AXIS_UNITS,
  CONTINUOUS_AXES,
  ENGINE_NAME,
  ENGINE_VERSION,
  KPA_PER_PSI,
  PRESETS,
  REGIME_AXES,
  REGIME_VALUES,
  SOURCES,
  buildEnvelopes,
  canonicalJson,
  evaluate,
  locateTarget,
  parseConditionCsv,
  parseCsv,
  validateTarget,
  HABITAT_WINDOWS,
  routesToEvidence,
  evidenceMap,
  // transfer hypothesis (docs/TRANSFER.md) and FM2 instrument balance
  DENSITY_FACTOR_PMMA_AIR,
  FM2_SOURCES,
  GRAVITY_TARGETS,
  PMMA_STOICH,
  TRANSFER_LIMITS,
  buoyantStretch,
  fm2Balance,
  fm2Chamber,
  fm2FinalO2,
  transferHypotheses,
  transferTestsFromFlowSteps,
  withGravity,
} from "../../engine/src/index.ts";

export type {
  AxisCheck,
  Citation,
  ClusterVerdict,
  ConditionRecord,
  ContinuousAxis,
  EngineOptions,
  EnvelopePoint,
  EnvelopeSet,
  Evaluation,
  InvestigationVerdict,
  Preset,
  PresetValue,
  Reason,
  RegimeAxis,
  RegimeEnvelope,
  RegimeState,
  SourceRef,
  Target,
  TargetLocation,
  Verdict,
  Route,
  RouteSet,
  Blocker,
  EvidenceMap,
  Band,
  Fm2Balance,
  Fm2Inputs,
  GravityTargetId,
  Sourced,
  SourceCitation,
  StretchResult,
  TransferHypothesis,
  TransferReport,
  TransferTest,
} from "../../engine/src/index.ts";

// Verdict names live in the engine (labels.ts); not yet re-exported by its index.
export { verdictLabel } from "../../engine/src/labels.ts";
export { EXTRAPOLATION_LEVEL_SENTENCES, levelSentence } from "../../engine/src/labels.ts";
export { EXTRAPOLATION_LEVEL_NOTE, EXTRAPOLATION_LEVEL_ORDER, type ExtrapolationLevel } from "../../engine/src/levels.ts";
export { humanGap, humanValue } from "../../engine/src/labels.ts";
export { experimentsNeeded, EXPERIMENT_LABEL, type ExperimentsNeeded } from "../../engine/src/index.ts";
