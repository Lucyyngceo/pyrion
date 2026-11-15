// Which language a message is written in, by code (no model), so TARS can answer in it and the interface can label the answer in it.
// Pure, relative imports only.

export type Lang = "en" | "es" | "pt" | "fr" | "de" | "it";

export const LANG_NAMES: Record<Lang, string> = { en: "English", es: "Spanish", pt: "Portuguese", fr: "French", de: "German", it: "Italian" };

const WORDS: Record<Exclude<Lang, "en">, string[]> = {
  es: "que qué como cómo cual cuál el la los las de del en y es son un una por para con sin se si no más muy cuando donde dónde porque por qué hay puede pueden sería quema arde oxígeno presión gravedad luna llama material materiales".split(" "),
  pt: "que como qual o a os as de do da em e é são um uma por para com sem se não mais muito quando onde porque pode seria queima oxigênio pressão gravidade lua chama".split(" "),
  fr: "que quel quelle comment le la les de du des en et est sont un une pour avec sans si ne pas plus très quand où parce peut serait brûle oxygène pression gravité lune flamme".split(" "),
  de: "was wie welche der die das den dem von im und ist sind ein eine für mit ohne wenn nicht mehr sehr wann wo weil kann würde brennt sauerstoff druck schwerkraft mond flamme".split(" "),
  it: "che come quale il lo la i gli le di del in e è sono un una per con senza se non più molto quando dove perché può sarebbe brucia ossigeno pressione gravità luna fiamma".split(" "),
};
const EN = "the what how which is are of to in and for with without if not more very when where because can would burns oxygen pressure gravity moon flame material materials do does".split(" ");

/** The language of a message: a mark of Spanish punctuation or accents settles it; otherwise word counts decide, and English is the default. */
export function detectLang(text: string): Lang {
  if (/[¿¡]/.test(text)) return "es";
  const words = text.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  if (words.length === 0) return "en";
  const score = (list: string[]) => words.filter((w) => list.includes(w)).length;
  const en = score(EN);
  let best: Lang = "en";
  let bestScore = en;
  for (const [lang, list] of Object.entries(WORDS) as [Exclude<Lang, "en">, string[]][]) {
    let s = score(list);
    // accents typical of the language
    if (lang === "es" && /[ñáéíóú]/i.test(text)) s += 1;
    if (lang === "pt" && /[ãõç]/i.test(text)) s += 1;
    if (lang === "fr" && /[àèêçœ]/i.test(text)) s += 1;
    if (lang === "de" && /[äöüß]/i.test(text)) s += 1;
    if (s > bestScore) {
      best = lang;
      bestScore = s;
    }
  }
  return best;
}

/** The instruction to the model: answer in the visitor's language; names, quotes and units stay as written. */
export function languageInstruction(lang: Lang): string {
  if (lang === "en") return "";
  return `The visitor writes in ${LANG_NAMES[lang]}. Write every explanation in ${LANG_NAMES[lang]}. Keep as written, never translated: investigation names and ids, units, numbers, and quotes from NASA documents (quote them verbatim in their original language, and you may add a short translation after the quote in the block text).`;
}

/** The labels the interface puts on an answer, in the answer's language (English for the rest). */
export interface Labels {
  engine: string;
  nasa: string;
  expert: string;
  engineSub: string;
  nasaSub: string;
  expertSub: string;
  answeredBy: string;
  steps: string;
  showOnEnvelope: string;
}
const ES: Labels = {
  engine: "Motor",
  nasa: "NASA lo dijo",
  expert: "Razonamiento propio de TARS",
  engineSub: "PYRION engine — calculado por código",
  nasaSub: "Fuente NASA — cita comprobada en la página citada",
  expertSub: "no verificado contra una fuente",
  answeredBy: "Respondido por",
  steps: "Cómo llegó TARS a esto",
  showOnEnvelope: "Mostrar en el envelope",
};
const EN_LABELS: Labels = {
  engine: "Engine",
  nasa: "NASA said it",
  expert: "TARS own reasoning",
  engineSub: "PYRION engine — computed by code",
  nasaSub: "NASA source — quote checked on the cited page",
  expertSub: "not verified against a source",
  answeredBy: "Answered by",
  steps: "How TARS got this",
  showOnEnvelope: "Show on the envelope",
};
export const labelsFor = (lang: Lang | undefined): Labels => (lang === "es" ? ES : EN_LABELS);
