import type { Metadata } from "next";
import TarsChat from "@/components/tars/TarsChat";

export const metadata: Metadata = {
  title: "TARS SI · PYRION Ω",
  description: "TARS, the Traceable Applicability Reasoning System: answers about a condition in three parts (known, unknown, next), and about this site.",
};

export default function TarsPage() {
  return (
    <main className="page tars-page">
      <header className="hero hero-compact">
        <h1 data-help="page-tars" className="h1-small">TARS SI <span className="muted small">Traceable Applicability Reasoning System</span></h1>
      </header>
      <TarsChat autoFocus sidebar />
    </main>
  );
}
