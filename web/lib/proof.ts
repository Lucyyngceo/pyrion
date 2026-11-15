// Server only: the facts of the Proof page, read from the repository's files at build time. Nothing here is typed in.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(/*turbopackIgnore: true*/ process.cwd(), "..");
export const GITHUB = "https://github.com/Lucyyngceo/pyrion/blob/main";

const text = async (...p: string[]): Promise<string | null> => {
  try {
    return await readFile(path.join(ROOT, ...p), "utf8");
  } catch {
    return null;
  }
};
const files = async (...p: string[]): Promise<string[]> => {
  try {
    return await readdir(path.join(ROOT, ...p));
  } catch {
    return [];
  }
};

/** The height of the Bitcoin block an OpenTimestamps proof is attached to, or null while it is still pending. */
export function bitcoinHeight(ots: Uint8Array): number | null {
  const tag = [0x05, 0x88, 0x96, 0x0d, 0x73, 0xd7, 0x19, 0x01];
  for (let i = 0; i + tag.length < ots.length; i++) {
    if (tag.every((b, k) => ots[i + k] === b)) {
      let j = i + tag.length + 1; // skip the length byte of the payload
      let h = 0;
      let shift = 0;
      while (j < ots.length) {
        const c = ots[j++];
        h += (c & 0x7f) * 2 ** shift;
        shift += 7;
        if (!(c & 0x80)) return h;
      }
    }
  }
  return null;
}

const bytes = async (...p: string[]) => {
  try {
    return new Uint8Array(await readFile(path.join(ROOT, ...p)));
  } catch {
    return null;
  }
};

/** GitHub's anchor for a heading. */
export const slug = (h: string) =>
  h
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");

export interface Proof {
  battery: { file: string; startedAt: string | null; questions: number; traps: number; failures: number | null } | null;
  validation: { generatedAt: string; records: number; cells: number; quotes: number; textFiles: number; blocker: number; major: number; minor: number; traceRan: boolean } | null;
  audits: { title: string; anchor: string }[];
  tests: { engine: number; web: number } | null;
  sealed: { height: number | null; hasProof: boolean } | null;
  stamps: { file: string; commit: string | null; utc: string | null; height: number | null }[];
  ai: { heading: string } | null;
}

const countTests = async (dir: string[], suffix: RegExp) => {
  let n = 0;
  for (const f of await files(...dir)) {
    if (!suffix.test(f)) continue;
    const t = await text(...dir, f);
    n += (t?.match(/^\s*(?:test|it)\(/gm) ?? []).length;
  }
  return n;
};

export async function loadProof(): Promise<Proof> {
  // judge battery: the newest result file
  let battery: Proof["battery"] = null;
  const results = (await files("validation", "judge_battery", "results")).filter((f) => f.endsWith(".json")).sort();
  const latest = results.at(-1);
  if (latest) {
    try {
      const j = JSON.parse((await text("validation", "judge_battery", "results", latest)) ?? "null") as { started?: string; groups?: { members?: unknown[] }[]; traps?: unknown[]; failures?: unknown } | null;
      if (j) {
        const q = (j.groups ?? []).reduce((n, g) => n + (g.members?.length ?? 0), 0);
        battery = { file: latest, startedAt: j.started ?? null, questions: q + (j.traps?.length ?? 0), traps: j.traps?.length ?? 0, failures: typeof j.failures === "number" ? j.failures : Array.isArray(j.failures) ? j.failures.length : null };
      }
    } catch {
      battery = null;
    }
  }

  let validation: Proof["validation"] = null;
  try {
    const v = JSON.parse((await text("validation", "reports", "latest.json")) ?? "null") as {
      generated_at_utc: string;
      trace_ran: boolean;
      stats: { records: number; cells_traced?: number; quotes_traced?: number; text_files_scanned: number };
      counts: { BLOCKER: number; MAJOR: number; MINOR: number };
    } | null;
    if (v) validation = { generatedAt: v.generated_at_utc, records: v.stats.records, cells: v.stats.cells_traced ?? 0, quotes: v.stats.quotes_traced ?? 0, textFiles: v.stats.text_files_scanned, blocker: v.counts.BLOCKER, major: v.counts.MAJOR, minor: v.counts.MINOR, traceRan: v.trace_ran };
  } catch {
    validation = null;
  }

  const audit = await text("validation", "reports", "phase1-llm-audit.md");
  const audits = (audit?.match(/^##+ .+$/gm) ?? []).filter((h) => /^## /.test(h)).map((h) => ({ title: h.replace(/^#+\s*/, ""), anchor: slug(h.replace(/^#+\s*/, "")) }));

  const engine = await countTests(["engine", "test"], /\.test\.ts$/);
  const web = await countTests(["web", "test"], /\.test\.ts$/);

  const sealedBytes = await bytes("predictions", "SHA256SUMS.ots");
  const sealed = sealedBytes ? { height: bitcoinHeight(sealedBytes), hasProof: true } : null;

  const stamps: Proof["stamps"] = [];
  for (const f of (await files("provenance")).filter((x) => x.endsWith(".txt")).sort()) {
    const t = (await text("provenance", f)) ?? "";
    const ots = await bytes("provenance", `${f}.ots`);
    stamps.push({ file: f, commit: /^commit (\w+)/m.exec(t)?.[1] ?? null, utc: /^utc (\S+)/m.exec(t)?.[1] ?? null, height: ots ? bitcoinHeight(ots) : null });
  }

  const readme = await text("README.md");
  const ai = readme ? { heading: /^## (Use of AI.*)$/m.exec(readme)?.[1] ?? "Use of AI" } : null;

  return { battery, validation, audits, tests: { engine, web }, sealed, stamps, ai };
}
