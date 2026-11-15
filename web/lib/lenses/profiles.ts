// Server only: GPT's investigation profiles (data/derived/investigation_profiles.json, tools/build_profiles.py), read, never written.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ProfileLike } from "./model.ts";

export function loadProfiles(): ProfileLike[] {
  return JSON.parse(readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), "..", "data", "derived", "investigation_profiles.json"), "utf8")) as ProfileLike[];
}
