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
  evaluate,
  locateTarget,
  parseConditionCsv,
  parseCsv,
  validateTarget,
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
} from "../../engine/src/index.ts";
