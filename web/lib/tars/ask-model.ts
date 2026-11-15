// Server only. An `AskModel` for the expert modules (claim checker, skeptic) over the provider router.
// Tries the preferred models in order (the reviewer order when none is given), skips the families it must avoid, and never throws a key or a URL.

import { askLlm, providers } from "@/lib/llm";
import type { Visitor } from "@/lib/llm/budget";
import { allModels, displayName } from "@/lib/llm/config";
import { modelFamily, REVIEWER_ORDER, type AskModel } from "@/lib/expert/model";

export function makeAskModel(visitor: Visitor, deadlineMs = 45_000): AskModel {
  return async (req) => {
    const have = allModels(providers());
    const order = (req.prefer.length > 0 ? req.prefer : [...REVIEWER_ORDER]).filter((m) => have.includes(m) && !req.avoidFamilies.includes(modelFamily(m)));
    let last: unknown = null;
    for (const m of order) {
      try {
        const c = await askLlm({ messages: req.messages, model: m, pin: true, effort: "low", maxTokens: 2000, maxTokensByProvider: { openrouter: 2000, nim: 2000 }, deadlineMs }, visitor);
        const text = c.json?.choices?.[0]?.message?.content;
        if (typeof text === "string") return { text, model: c.meta.model, name: displayName(c.meta.model), provider: c.meta.provider };
      } catch (e) {
        last = e;
      }
    }
    throw last instanceof Error ? last : new Error("no model answered");
  };
}
