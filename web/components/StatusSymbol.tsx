// Status symbols after the Astro Space UX Design System status set (shapes and colors).
// Astro UXDS: Copyright © 2024 Rocket Communications, Inc. Public domain in the United States; used under its license.
// https://github.com/RocketCommunicationsInc/astro
//
// PYRION uses only four of the six Astro levels, and never serious or critical: a verdict is not an alarm.
//   APPLICABLE            -> normal  (filled circle)
//   EXTRAPOLATION         -> caution (square)
//   INSUFFICIENT_EVIDENCE -> standby (ring)
//   REGIME_BARRIER        -> off     (small circle): not comparable, not a score

export type StatusLevel = "normal" | "caution" | "standby" | "off";

export const VERDICT_STATUS: Record<string, StatusLevel> = {
  APPLICABLE: "normal",
  EXTRAPOLATION: "caution",
  INSUFFICIENT_EVIDENCE: "standby",
  REGIME_BARRIER: "off",
};

export const TONE_STATUS: Record<string, StatusLevel> = { inside: "normal", outside: "caution", unknown: "standby" };

export default function StatusSymbol({ level, size = 12 }: { level: StatusLevel; size?: number }) {
  return (
    <svg className={`st st-${level}`} width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      {level === "normal" && <circle cx="6" cy="6" r="4" />}
      {level === "caution" && <rect x="2" y="2" width="8" height="8" />}
      {level === "standby" && (
        <path
          fillRule="evenodd"
          d="M6 10A4 4 0 1 0 6 2a4 4 0 0 0 0 8Zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
        />
      )}
      {level === "off" && <circle cx="6" cy="6" r="3" />}
    </svg>
  );
}
