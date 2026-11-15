import Link from "next/link";

/** One small line under the scenario strip that points at the three big tools. */
export default function ToolsLine() {
  return (
    <p data-help="home-tools-line" className="tools-line small">
      <Link data-help="home-tools-line" href="/planner">Mission Planner — what would close the Moon gap</Link>
      {" · "}
      <Link data-help="home-tools-line" href="/investigations">Investigations — the 24 PSI studies</Link>
      {" · "}
      <Link data-help="home-tools-line" href="/tars">✦ TARS SI — ask the expert</Link>
    </p>
  );
}
