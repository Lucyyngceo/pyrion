// Node only (tests and scripts): the help topics read synchronously from web/content/help/**/*.md.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseTopic, type Topic } from "./help.ts";

export function loadTopicsSync(dir = join(import.meta.dirname, "../../content/help")): Topic[] {
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((n) => n.endsWith(".md"))
    .sort()
    .map((n) => parseTopic(n.split(/[\/]/).pop()!.replace(/\.md$/, ""), readFileSync(join(dir, n), "utf8")));
}
