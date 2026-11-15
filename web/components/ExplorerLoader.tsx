"use client";

import { useEffect, useState } from "react";
import Explorer from "@/components/Explorer";
import type { Dataset } from "@/lib/types";

/** The Envelope page sends the dataset without the CSV text (3 MB); the files arrive right after the first paint. */
export default function ExplorerLoader({ dataset }: { dataset: Dataset }) {
  const [files, setFiles] = useState<Dataset["files"] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setFailed(false);
    fetch("/api/dataset")
      .then((r) => (r.ok ? (r.json() as Promise<{ files: Dataset["files"] }>) : Promise.reject(new Error(String(r.status)))))
      .then((j) => live && setFiles(j.files))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [attempt]);
  if (!files) {
    return (
      <div className="card" role="status" aria-live="polite">
        {failed ? (
          <p>
            The evidence could not be loaded.{" "}
            <button data-help="explorer-retry" type="button" className="linklike" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>
          </p>
        ) : (
          <p className="muted">Loading the evidence envelope…</p>
        )}
      </div>
    );
  }
  return <Explorer dataset={{ ...dataset, files }} />;
}
