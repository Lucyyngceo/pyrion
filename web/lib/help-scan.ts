// Scans JSX source for interactive elements and for data-help ids. Pure, node-only helpers used by the coverage test.
// An opening tag is read with brace and quote tracking, so attributes that span lines or hold expressions are handled.

export interface Tag {
  name: string;
  /** 1-based line of the "<". */
  line: number;
  text: string;
  help: string | null;
  role: string | null;
  /** The next ~80 characters after the tag, for naming it in a report. */
  after: string;
}

const INTERACTIVE = new Set(["button", "a", "input", "select", "textarea", "Link", "summary"]);
const ROLES = new Set(["button", "radio", "menuitem", "tab", "link", "switch", "checkbox"]);

export function scanTags(source: string): Tag[] {
  const tags: Tag[] = [];
  const re = /<([A-Za-z][A-Za-z0-9]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    // skip type arguments such as Array<string> and generics: a JSX tag is preceded by (, >, }, =>, return, ? or : or whitespace/line start
    const before = source.slice(Math.max(0, m.index - 3), m.index);
    if (/[A-Za-z0-9_\])]$/.test(before.trimEnd().slice(-1) || "") && !/\s$/.test(before)) continue;
    let i = m.index + m[0].length;
    let depth = 0;
    let quote: string | null = null;
    for (; i < source.length; i++) {
      const c = source[i];
      if (quote) {
        if (c === quote && source[i - 1] !== "\\") quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") {
        quote = c;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }
    const text = source.slice(m.index, i + 1);
    const help = /\bdata-help=(?:"([^"]+)"|\{`?"?([^}`"]+)"?`?\})/.exec(text);
    const role = /\brole="([^"]+)"/.exec(text);
    tags.push({
      name: m[1],
      line: source.slice(0, m.index).split("\n").length,
      text,
      help: help ? (help[1] ?? help[2]) : null,
      role: role ? role[1] : null,
      after: source.slice(i + 1, i + 90).replace(/\s+/g, " "),
    });
  }
  return tags;
}

/** Native interactive tags, interactive roles, and plain html/svg tags with a click handler. Components (capitalised) are tagged where they render a native element. */
export const isInteractive = (t: Tag) =>
  INTERACTIVE.has(t.name) || t.name === "dialog" || (t.role !== null && ROLES.has(t.role)) || (/^[a-z]/.test(t.name) && /\bonClick=/.test(t.text));

/** Every topic id a file mentions: data-help="id" and the convention `help: "id"` in data tables. */
export function helpIdsIn(source: string): string[] {
  const ids = new Set<string>();
  for (const m of source.matchAll(/\bdata-help="([a-z0-9-]+)"/g)) ids.add(m[1]);
  for (const m of source.matchAll(/\bhelp: "([a-z0-9-]+)"/g)) ids.add(m[1]);
  return [...ids];
}
