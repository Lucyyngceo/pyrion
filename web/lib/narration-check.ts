// Shared bits of the language-model guard rails. Pure, no imports.
// The model's context is judged by lib/context-check.ts (an allowlist). This file keeps the banned-phrase list that
// the parse step uses for model-written assumptions, and the helper that quotes model text safely.

/** Mirror of BANNED in validation/run_all.py (keep the two in step). */
export const BANNED_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\bfirst (?:ever|in the world)\b|\bworld'?s first\b/i, label: "superlative claim" },
  { pattern: /\bvalidated by NASA\b|\bNASA[- ]validated\b|\bNASA[- ]approved\b|\bendorsed by NASA\b/i, label: "claim of NASA endorsement" },
  { pattern: /\bperfect accuracy\b|\b100 ?% accura/i, label: "accuracy claim" },
  { pattern: /\bno data exists?\b|\bnever been tested\b|\bnever tested\b/i, label: "absence claim" },
  { pattern: /\bautonomous end[- ]to[- ]end\b/i, label: "autonomy claim" },
  { pattern: /\bguarantee[sd]?\b|\bproven safe\b/i, label: "guarantee claim" }, // lang-ok: banned-phrase pattern, not a claim
  { pattern: /\bdiscover(?:y|ed|ies)\b/i, label: "discovery claim" }, // lang-ok: banned-phrase pattern, not a claim
  { pattern: /\bsafe\b/i, label: "safety claim" }, // lang-ok: banned-phrase pattern, not a claim
];

/** Model text quoted in a message: short, and labelled as unused. */
export const modelText = (s: string, n = 80) => `model text (not used): "${s.length > n ? `${s.slice(0, n)}…` : s}"`;
