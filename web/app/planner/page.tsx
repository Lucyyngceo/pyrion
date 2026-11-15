import type { Metadata } from "next";
import PlannerView from "@/components/planner/PlannerView";
import { loadPlanner } from "@/lib/planner/data";
import "../navigator.css";

export const metadata: Metadata = {
  title: "Mission Planner · PYRION Ω",
  description: "How much of the Moon Base oxygen-pressure band lies inside the region spanned by PSI test points, what planned experiments would add, and how many tests the band needs. Evidence coverage, not a prediction or a safety assessment.",
};

export default async function PlannerPage() {
  const data = await loadPlanner();
  return (
    <main className="page planner">
      <header className="hero hero-compact">
        <h1 data-help="page-planner" className="h1-small">
          Mission Planner <span className="muted small">evidence coverage of the Moon Base band</span>
        </h1>
        <p className="small muted">Test points from NASA&apos;s Physical Sciences Informatics (PSI) database; planned tests are marked as planned, not in PSI.</p>
      </header>
      <PlannerView data={JSON.parse(JSON.stringify(data))} />
    </main>
  );
}
