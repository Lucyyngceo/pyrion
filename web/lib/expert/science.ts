// Science regression guard for model-written text.
//
// Two transport misconceptions TARS must never state (SYSTEM_PROMPT rule 7 asks the model not to; this code checks it):
//   A. forced ventilation is the only way oxygen reaches a flame in microgravity;
//   B. stopping ventilation necessarily extinguishes a fire.
// Molecular diffusion still transports oxygen to a flame when there is no buoyant or forced flow, so a quiescent
// microgravity flame can keep burning, more slowly (NASA, A Researcher's Guide to Combustion Science, pp. 11 and 35).
//
// A block that states either one is dropped by checkAnswer (reason "science_misconception"), whatever its layer.
// The patterns are deliberately narrow: they look for a ventilation term asserted as the only oxygen path, or for
// switching ventilation off asserted to extinguish with certainty. Hedged ("may", "can"), negated ("not necessarily",
// "not the only") and refuting ("a common misconception is…") sentences pass.

export type Misconception = "ventilation_only_oxygen_path" | "ventilation_off_always_extinguishes";

const VENT = String.raw`(?:forced[\s-]+)?(?:ventilation|air[\s-]?flow|forced[\s-]+(?:convection|flow)|fans?|blowers?)`;
const VENT_ES = String.raw`(?:la\s+)?(?:ventilaci[oó]n|flujo\s+de\s+aire|corriente\s+de\s+aire|ventiladores?)(?:\s+forzad[oa])?`;
const OXY = String.raw`(?:oxygen|o2|o₂|oxidi[sz]er|ox[ií]geno)`;
const PATH_NOUN = String.raw`(?:way|means|mechanism|source|supply|path|pathway|route|transport|process)`;
const CERTAIN = String.raw`(?:always|necessarily|inevitably|automatically|certainly|guarantees?|ensures?|will(?:\s+always)?|is\s+(?:enough|sufficient)\s+to)`;
const KILL = String.raw`(?:extinguish(?:es|ed)?|put(?:s|ting)?\s+(?:it\s+|the\s+(?:fire|flame)\s+)?out|kills?|smothers?|snuffs?|starves?|stops?)`;
const STOP_VENT = String.raw`(?:turn(?:s|ed|ing)?\s+off|switch(?:es|ed|ing)?\s+off|shut(?:s|ting)?\s+(?:off|down)|stop(?:s|ped|ping)?|cut(?:s|ting)?|remov(?:e|es|ed|ing)|(?:shutdown|loss|removal|absence)\s+of)\s+(?:the\s+)?${VENT}`;

const A: RegExp[] = [
  // "ventilation is the only way/source/mechanism …"
  new RegExp(String.raw`\b${VENT}\b[^.;!?]{0,40}\b(?:is|are|remains|provides|offers|gives)\s+(?:the\s+)?(?:only|sole|single)\s+${PATH_NOUN}`, "i"),
  // "the only way oxygen reaches the flame is (forced) ventilation"
  new RegExp(String.raw`\b(?:only|sole|single)\s+${PATH_NOUN}\b[^.;!?]{0,50}\b${OXY}\b[^.;!?]{0,50}\b${VENT}\b`, "i"),
  // "oxygen can only reach the flame through ventilation"
  new RegExp(String.raw`\b${OXY}\b[^.;!?]{0,30}\bonly\s+(?:reach(?:es)?|get(?:s)?|arrive(?:s)?|flow(?:s)?|be\s+(?:supplied|delivered|transported|brought|carried))\b[^.;!?]{0,60}\b${VENT}\b`, "i"),
  // "only forced airflow supplies oxygen" / "only ventilation can feed the flame"
  new RegExp(String.raw`\bonly\s+${VENT}\s+(?:can\s+)?(?:supplies|supply|brings|bring|delivers|deliver|provides|provide|feeds|feed|transports|transport|carries|carry)\b`, "i"),
  // "without ventilation no oxygen reaches the flame"
  new RegExp(String.raw`\bwithout\s+(?:any\s+)?${VENT}\b[^.;!?]{0,40}\b(?:no|zero)\s+${OXY}\s+(?:reaches|can\s+reach|gets|arrives|is\s+(?:supplied|delivered))`, "i"),
  // Spanish: "la ventilación es la única forma…", "la única vía de oxígeno es la ventilación", "sin ventilación no llega oxígeno"
  new RegExp(String.raw`\b${VENT_ES}\s+es\s+(?:la\s+|el\s+)?[uú]nic[oa]\s+(?:forma|manera|v[ií]a|fuente|mecanismo|camino|medio)`, "i"),
  new RegExp(String.raw`\b(?:[uú]nic[oa])\s+(?:forma|manera|v[ií]a|fuente|mecanismo|camino|medio)\b[^.;!?]{0,50}\b${OXY}\b[^.;!?]{0,50}\b${VENT_ES}\b`, "i"),
  new RegExp(String.raw`\bsin\s+${VENT_ES}\b[^.;!?]{0,40}\bno\s+(?:llega|hay|entra)\s+(?:nada\s+de\s+)?${OXY}`, "i"),
];

const B: RegExp[] = [
  // "turning off the ventilation always / necessarily / will extinguish the fire"
  new RegExp(String.raw`\b${STOP_VENT}\b[^.;!?]{0,60}\b${CERTAIN}\b[^.;!?]{0,25}\b${KILL}`, "i"),
  // "the fire will always go out / is necessarily extinguished when the ventilation is turned off"
  new RegExp(String.raw`\b(?:fires?|flames?)\b[^.;!?]{0,30}\b(?:always|necessarily|inevitably|automatically|will)\s+(?:(?:go(?:es)?|goes)\s+out|die|be\s+extinguished|extinguish|self-extinguish)\b[^.;!?]{0,40}\b(?:when|if|once|after|without)\b[^.;!?]{0,30}\b${VENT}\b`, "i"),
  // "a fire without ventilation is always / necessarily extinguished"
  new RegExp(String.raw`\b(?:fires?|flames?)\s+without\s+${VENT}\b[^.;!?]{0,30}\b(?:always|necessarily|inevitably)\b`, "i"),
  // Spanish: "apagar la ventilación apaga siempre / necesariamente el fuego", "basta con apagar la ventilación"
  new RegExp(String.raw`\b(?:apagar|cortar|detener|quitar|parar)\s+${VENT_ES}\b[^.;!?]{0,60}\b(?:siempre|necesariamente|garantiza|asegura)\b`, "i"),
  new RegExp(String.raw`\bbasta\s+con\s+(?:apagar|cortar|detener)\s+${VENT_ES}\b`, "i"),
  new RegExp(String.raw`\bsin\s+${VENT_ES}\b[^.;!?]{0,40}\b(?:se\s+apaga|se\s+extingue)\s+(?:siempre|necesariamente)\b`, "i"),
];

// A sentence that negates, hedges or refutes the claim is a correct statement, not the misconception.
const NEGATED = /\b(?:not|never|n['’]t)\b[^.;!?]{0,20}\b(?:necessarily|always|the\s+only|only|sole|guarantee[sd]?|enough|sufficient)\b|\bno\s+(?:es\s+)?(?:necesariamente|siempre|la\s+[uú]nica|el\s+[uú]nico|basta)\b|\bnunca\b/i;
const REFUTED = /\b(?:misconception|myth|common\s+mistake|wrong(?:ly)?|incorrect(?:ly)?|is\s+false|not\s+true|mito|err[oó]ne[oa]|equivocad[oa]|falso)\b/i;

/** Sentences of a text (split on . ! ? ; and line breaks, keeping decimals like 8.2 together). */
function sentences(text: string): string[] {
  return text.split(/(?<!\d)[.!?;](?!\d)|\n+/).map((s) => s.trim()).filter(Boolean);
}

/** The first transport misconception stated in the text, with the sentence; null when there is none. */
export function transportMisconception(text: string): { kind: Misconception; sentence: string } | null {
  for (const s of sentences(text)) {
    if (NEGATED.test(s) || REFUTED.test(s)) continue;
    if (A.some((re) => re.test(s))) return { kind: "ventilation_only_oxygen_path", sentence: s };
    if (B.some((re) => re.test(s))) return { kind: "ventilation_off_always_extinguishes", sentence: s };
  }
  return null;
}
