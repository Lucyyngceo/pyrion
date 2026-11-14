import { ENGINE_NAME, ENGINE_VERSION } from "@/lib/engine";
import { loadDataset, loadLineage } from "@/lib/data";

/** Console-style system line: engine, data, last committed validation report. Server-rendered, static. */
export default async function StatusBar() {
  const [ds, lin] = await Promise.all([loadDataset(), loadLineage()]);
  const v = lin.validation;
  const cells: { k: string; v: string; tone?: string }[] = [
    { k: "Engine", v: `${ENGINE_NAME} ${ENGINE_VERSION}` },
    { k: "Mode", v: "deterministic · no LLM in the verdict" },
    { k: "Data", v: ds.mode === "psi" ? `NASA PSI · ${ds.stats.records.toLocaleString("en-US")} values` : "synthetic fixtures (not NASA data)", tone: ds.mode === "psi" ? undefined : "caution" },
  ];
  if (v) {
    cells.push({ k: "Validation", v: v.generatedAt.replace("T", " ").replace(/:\d\dZ$/, " UTC") });
    cells.push({ k: "Blockers", v: String(v.blocker), tone: v.blocker === 0 ? "normal" : "caution" });
  }
  return (
    <div className="statusbar" role="note" aria-label="System status">
      {cells.map((c) => (
        <span key={c.k} className={`sb-cell${c.tone ? ` sb-${c.tone}` : ""}`}>
          <span className="sb-k">{c.k}</span>
          <span className="sb-v">{c.v}</span>
        </span>
      ))}
    </div>
  );
}
