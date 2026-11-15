"use client";

/** The finding in one sentence, with a button that sets the lunar-habitat preset and jumps to the result. */
export default function Lede({ investigations }: { investigations: number }) {
  const go = () => {
    window.dispatchEvent(new CustomEvent("pyrion:preset", { detail: "challenge-lunar-base" }));
    window.setTimeout(() => document.getElementById("envelope-h")?.scrollIntoView({ block: "start", behavior: "smooth" }), 80);
  };
  return (
    <p className="lede">
      A lunar habitat at 30 % O₂ and 10.2 psi in 1/6 g lies outside every measured test in PSI: none of the {investigations}{" "}
      investigations was run in partial gravity.{" "}
      <button type="button" className="linklike lede-go" onClick={go}>
        See the lunar habitat →
      </button>
    </p>
  );
}
