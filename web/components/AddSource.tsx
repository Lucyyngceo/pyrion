"use client";

import { useRef, useState } from "react";
import { ALLOWED_EXTENSIONS, MAX_FILE_BYTES, NASA_ONLY_SENTENCE, UPLOAD_NOTE, addSource, checkNtrsInput, checkSourceFile } from "@/lib/add-source";

const STEPS = [
  "Read",
  "Extract with quotes",
  "Located in the source by code",
  "Classified only if stated",
  "Every scenario recalculated (before/after)",
];

/** "+ Add a source": the entry point and the dialog shell. Processing arrives in the next build (see addSource in lib/add-source.ts). */
export default function AddSource() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [ntrs, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const onUrl = (v: string) => {
    setUrl(v);
    const c = v.trim() ? checkNtrsInput(v) : ({ ok: true } as const);
    setProblem(c.ok ? null : c.reason);
  };
  const onFile = (f: File | null) => {
    setFile(f);
    if (!f) return setProblem(null);
    const c = checkSourceFile(f);
    setProblem(c.ok ? null : c.reason);
  };

  return (
    <>
      <button data-help="add-source-button" type="button" className="add-source-btn" onClick={() => dialog.current?.showModal()}>
        + Add a source
      </button>
      <dialog data-help="add-source-dialog" ref={dialog} className="add-source" aria-labelledby="as-title" onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            // Disabled tonight. When the pipeline exists: void addSource(file ? { kind: "file", file } : { kind: "ntrs", id: <digits from checkNtrsInput> });
            void addSource;
          }}
        >
          <div className="as-head">
            <h2 id="as-title">Add NASA evidence</h2>
            <button data-help="add-source-close" type="button" className="as-close" aria-label="Close" onClick={() => dialog.current?.close()}>
              ×
            </button>
          </div>
          <p className="as-only">{NASA_ONLY_SENTENCE}</p>

          <label className="as-field">
            <span>NTRS document number</span>
            <input data-help="add-source-ntrs" type="text" inputMode="numeric" autoComplete="off" placeholder="20250010653" value={ntrs} onChange={(e) => onUrl(e.target.value)} disabled={!!file} />
          </label>
          <label className="as-field">
            <span>or upload a table (CSV or XLSX, max {MAX_FILE_BYTES / 1024 / 1024} MB)</span>
            <input data-help="add-source-file" type="file" accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",")} onChange={(e) => onFile(e.target.files?.[0] ?? null)} disabled={!!ntrs.trim()} />
          </label>
          <p className="small muted">{UPLOAD_NOTE}</p>
          {problem && (
            <p className="as-problem" role="alert">
              {problem}
            </p>
          )}

          <ol className="as-steps" aria-label="What will happen">
            {STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="small muted">Added evidence is shown as external, only in your view, and can be switched off or exported.</p>

          <div className="as-actions">
            <a data-help="add-source-submit" href="/data" className="chip">
              See how every value is checked
            </a>
            <span className="small muted">Today this dialog checks your input; it does not process the source.</span>
          </div>
        </form>
      </dialog>
    </>
  );
}
