// The chapters of the manual at /help, in reading order, and where each data-help id lives. Pure (no imports).
// Topic files carry `chapter: <slug>` in their front matter; web/content/help/<chapter-folder>/<topic>.md.

export interface Chapter {
  slug: string;
  n: number;
  title: string;
  intro: string;
}

export const CHAPTERS: readonly Chapter[] = [
  { slug: "what-is-pyrion", n: 1, title: "What PYRION is", intro: "A plain introduction: what the project does, who made it and why." },
  { slug: "envelope", n: 2, title: "The Envelope page", intro: "Every tile, line, control and chart element of the home page." },
  { slug: "navigator", n: 3, title: "NAVIGATOR: where the evidence is", intro: "The right-hand column, Take me there, regimes and no route found." },
  { slug: "verdicts", n: 4, title: "Verdicts and extrapolation levels", intro: "The four verdicts, how far outside the tested data, and how to read a result card." },
  { slug: "close-the-gap", n: 5, title: "What would close this gap", intro: "The engine's plan of experiments that would add evidence." },
  { slug: "add-a-source", n: 6, title: "Add a source", intro: "What the Add NASA evidence dialog does today and what is not built yet." },
  { slug: "tars", n: 7, title: "TARS SI", intro: "The chat: bubble, tab, three layers, modes, skills, history, and its limits." },
  { slug: "bridge", n: 8, title: "The Bridge and sealed predictions", intro: "The flame-stretch-rate hypothesis, the FM2 balance and the sealed statements." },
  { slug: "data", n: 9, title: "Data, sources and how values are located", intro: "Where each value comes from and how code checks it against the NASA source." },
  { slug: "method", n: 10, title: "Method", intro: "How the engine decides." },
  { slug: "glossary", n: 11, title: "Glossary", intro: "Every term used on the site." },
  { slug: "limits", n: 12, title: "Limits and honesty", intro: "What PYRION does not claim." },
  { slug: "planner", n: 13, title: "Mission Planner", intro: "How much of the Moon Base band the PSI measurements cover, and what tests would close the rest." },
];

export const chapterBySlug = (slug: string) => CHAPTERS.find((c) => c.slug === slug);

const starts = (id: string, ...prefixes: string[]) => prefixes.some((p) => id.startsWith(p));

/** The route a data-help id is rendered on ("Show me" goes there). */
export function pageOf(id: string): string {
  if (starts(id, "bridge", "fm2-") || id === "page-bridge") return "/bridge";
  if (id.startsWith("data-") || id === "page-data") return "/data";
  if (id.startsWith("planner") || id === "page-planner" || id === "nav-planner" || id === "chart-planner") return id === "nav-planner" ? "/" : "/planner";
  if (id.startsWith("method") || id === "page-method") return "/method";
  if (id.startsWith("why") || id === "page-why") return "/why";
  if (id.startsWith("help-reader")) return "/help";
  if (id.startsWith("proof-") || id === "page-proof" || id === "data-proof-link") return id === "data-proof-link" ? "/data" : "/proof";
  if (id === "page-tars" || starts(id, "tars-history", "tars-conversation", "tars-new", "tars-rename", "tars-delete", "tars-input", "tars-send", "tars-log")) return "/tars";
  if (id.startsWith("tars-") && !["tars-bubble", "tars-close", "tars-panel"].includes(id)) return "/tars";
  return "/";
}
