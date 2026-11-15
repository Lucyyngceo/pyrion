"use client";

import { useEffect, useRef, useState } from "react";
import type { ExperimentsNeeded, Target } from "@/lib/engine";
import ExperimentsView from "./ExperimentsView";

/** "What would close this gap" for a scenario, in a dialog. The plan is built by the engine on the server. */
export default function GapDialog({ title, target, onClose }: { title: string; target: Target; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<{ experiments: ExperimentsNeeded; fingerprint: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.showModal();
    let live = true;
    fetch("/api/tars", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "experiments", target }) })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!live) return;
        if (!r.ok) setError(d.error ?? `The plan could not be built (HTTP ${r.status}).`);
        else setData(d);
      })
      .catch(() => live && setError("The plan could not be built right now."));
    return () => {
      live = false;
    };
  }, [target]);

  return (
    <dialog ref={ref} className="add-source gap-dialog" aria-labelledby="gap-title" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <div className="as-head">
        <h2 id="gap-title">What would close this gap: {title}</h2>
        <button type="button" className="as-close" aria-label="Close" onClick={() => ref.current?.close()}>
          ×
        </button>
      </div>
      {!data && !error && <p className="muted">Building the plan with the engine…</p>}
      {error && (
        <p className="as-problem" role="alert">
          {error}
        </p>
      )}
      {data && <ExperimentsView ex={data.experiments} fingerprint={data.fingerprint} />}
    </dialog>
  );
}
