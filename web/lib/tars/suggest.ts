// Suggested next questions, from templates and the state of the answer (never free model text). Pure.

export type Suggestion = { id: string; label: string; question: string } | { id: string; label: string; action: "show" };

interface Basis {
  /** The tools the answer used. */
  tools: string[];
  /** Whether the answer has a condition (a target). */
  hasTarget: boolean;
  /** Whether the answer carries a NASA quote. */
  hasNasa: boolean;
  lang?: string;
}

const T = {
  en: {
    gap: ["What would close this gap?", "What would close this gap for this condition?"],
    iss: ["Compare with ISS air", "Compare the oxygen partial pressure and total pressure of this atmosphere with ISS cabin air (21 % oxygen at 14.7 psia)."],
    show: ["Show on the envelope"],
    whatif: ["What if we ran an experiment here?", "What if we ran one experiment at this condition: how would the evidence map change?"],
    simple: ["Explain it in simpler words", "Explain your last answer in simpler words, for someone who is not an engineer."],
    source: ["Where does PSI stop?", "Where does the PSI evidence stop for this condition, and why?"],
  },
  es: {
    gap: ["¿Qué cerraría esta brecha?", "¿Qué cerraría esta brecha para esta condición?"],
    iss: ["Comparar con el aire de la ISS", "Compara la presión parcial de oxígeno y la presión total de esta atmósfera con el aire de la cabina de la ISS (21 % de oxígeno a 14.7 psia)."],
    show: ["Mostrar en el envelope"],
    whatif: ["¿Y si hiciéramos un experimento aquí?", "¿Y si hiciéramos un experimento en esta condición: cómo cambiaría el mapa de evidencia?"],
    simple: ["Explícalo más simple", "Explica tu última respuesta con palabras más simples, para alguien que no es ingeniero."],
    source: ["¿Dónde termina PSI?", "¿Dónde termina la evidencia de PSI para esta condición, y por qué?"],
  },
} as const;

/** Up to three follow-ups that make sense for this answer. A suggestion whose tool already ran is not offered again. */
export function suggestNext(b: Basis): Suggestion[] {
  const t = b.lang === "es" ? T.es : T.en;
  const out: Suggestion[] = [];
  const used = (name: string) => b.tools.includes(name);
  if (b.hasTarget && !used("what_would_close_the_gap")) out.push({ id: "gap", label: t.gap[0], question: t.gap[1] });
  if (b.hasTarget && !used("run_calculator")) out.push({ id: "iss", label: t.iss[0], question: t.iss[1] });
  if (b.hasTarget) out.push({ id: "show", label: t.show[0], action: "show" });
  if (b.hasTarget && !used("what_if_experiment")) out.push({ id: "whatif", label: t.whatif[0], question: t.whatif[1] });
  if (b.hasNasa || !b.hasTarget) out.push({ id: "simple", label: t.simple[0], question: t.simple[1] });
  if (b.hasTarget && used("evaluate_condition")) out.push({ id: "source", label: t.source[0], question: t.source[1] });
  return out.slice(0, 3);
}
