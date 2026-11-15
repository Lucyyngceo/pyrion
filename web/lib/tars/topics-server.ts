// Server only: the help topics in web/content/help/*.md, read once.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseTopic, type Topic } from "./help";

let cache: Promise<Topic[]> | null = null;

export function helpTopics(): Promise<Topic[]> {
  cache ??= (async () => {
    const dir = join(process.cwd(), "content", "help");
    const names = (await readdir(dir)).filter((n) => n.endsWith(".md")).sort();
    return Promise.all(names.map(async (n) => parseTopic(n.replace(/\.md$/, ""), await readFile(join(dir, n), "utf8"))));
  })();
  return cache;
}
