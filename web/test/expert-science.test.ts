// Science regression: TARS must never claim that forced ventilation is the only way oxygen reaches a flame in
// microgravity, nor that stopping ventilation necessarily extinguishes a fire. Diffusion still transports oxygen
// (NASA, A Researcher's Guide to Combustion Science, pp. 11 and 35). The system prompt asks for it (rule 7);
// these tests check that the code enforces it on whatever a model writes.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SYSTEM_PROMPT } from "../lib/expert/agent.ts";
import { checkAnswer, corpusFromPages } from "../lib/expert/claims.ts";
import { transportMisconception } from "../lib/expert/science.ts";

const ONLY_PATH = [
  "In microgravity, forced ventilation is the only way oxygen reaches the flame.",
  "Without buoyancy, the ventilation fan is the only source of oxygen for a fire on the ISS.",
  "Airflow is the sole mechanism that supplies oxygen to the flame in orbit.",
  "The only way oxygen gets to the flame in microgravity is forced convection.",
  "Oxygen can only reach the flame through ventilation, since there is no buoyant flow.",
  "Only forced airflow supplies oxygen to a flame in microgravity.",
  "Without ventilation, no oxygen reaches the flame.",
  "En microgravedad, la ventilación forzada es la única forma de que el oxígeno llegue a la llama.",
  "Sin ventilación no llega oxígeno a la llama.",
];

const ALWAYS_OUT = [
  "Turning off the ventilation will always extinguish the fire.",
  "Switching off the fans necessarily puts the fire out in microgravity.",
  "Stopping the airflow guarantees the flame is extinguished.",
  "Shutting down ventilation is enough to extinguish a fire on the station.",
  "The fire will go out when the ventilation is turned off.",
  "A flame without ventilation is always extinguished in microgravity.",
  "Apagar la ventilación apaga siempre el fuego en microgravedad.",
  "Basta con apagar la ventilación para extinguir el incendio.",
];

const CORRECT = [
  // the rule itself
  "Transport physics: molecular diffusion can supply oxygen to flames in microgravity without forced ventilation.",
  "Switching off ventilation does not necessarily extinguish a fire; never describe forced ventilation as the only oxygen transport mechanism.",
  "Ventilation is not the only way oxygen reaches a flame: diffusion still transports it.",
  "Turning off the ventilation may slow the flame, and a small flame can go out, but diffusion keeps supplying oxygen.",
  "A common misconception is that ventilation is the only source of oxygen in microgravity.",
  "Without ventilation, oxygen reaches the flame only by diffusion, which is slower.",
  "In quiescent microgravity the only transport left is diffusion.",
  "Ventilation is the only control the crew has over the cabin airflow.",
  "Cutting the ventilation is part of the ISS fire response; it reduces the oxygen supply to the fire.",
  "La ventilación no es la única vía: la difusión sigue llevando oxígeno a la llama.",
  "Apagar la ventilación no necesariamente apaga el fuego.",
  "FM2 tests run at 8.2 psia with 37% oxygen.",
];

test("misconception A (ventilation is the only oxygen path) is detected in every phrasing", () => {
  for (const s of ONLY_PATH) assert.equal(transportMisconception(s)?.kind, "ventilation_only_oxygen_path", s);
});

test("misconception B (stopping ventilation necessarily extinguishes) is detected in every phrasing", () => {
  for (const s of ALWAYS_OUT) assert.equal(transportMisconception(s)?.kind, "ventilation_off_always_extinguishes", s);
});

test("correct, hedged, negated and refuting statements are not flagged", () => {
  for (const s of CORRECT) assert.equal(transportMisconception(s), null, s);
});

test("the misconception is found inside a longer answer, sentence by sentence", () => {
  const text = "PSI-25 BASS-II burned solids in microgravity at 21% oxygen. Turning off the ventilation will always extinguish the fire. FM2 starts at 8.2 psia.";
  assert.equal(transportMisconception(text)?.kind, "ventilation_off_always_extinguishes");
});

test("checkAnswer drops a model block that states either misconception, and keeps a correct one", () => {
  const corpus = corpusFromPages([]);
  const r = checkAnswer(
    [
      { layer: "expert", text: "In microgravity, forced ventilation is the only way oxygen reaches the flame." },
      { layer: "expert", text: "Diffusion still brings oxygen to the flame when the ventilation is off, so the fire may keep burning more slowly." },
      { layer: "expert", text: "Switching off the fans necessarily puts the fire out." },
    ],
    { corpus },
  );
  assert.equal(r.kept.length, 1);
  assert.match(r.kept[0].text, /Diffusion still brings oxygen/);
  const reasons = r.report.dropped.map((d) => `${d.index}:${d.reason}`);
  assert.deepEqual(reasons, ["0:science_misconception", "2:science_misconception"]);
  assert.match(r.report.dropped[0].detail ?? "", /ventilation_only_oxygen_path/);
  assert.match(r.report.dropped[1].detail ?? "", /ventilation_off_always_extinguishes/);
});

test("the guard applies to every layer, including the TARS wording around a NASA quote", () => {
  const DOC = "nasa/test/doc.pdf";
  const QUOTE = "the flame burned for 30 s";
  const corpus = corpusFromPages([{ doc_id: DOC, page: 1, text: `In the test the flame burned for 30 s before the end.` }]);
  const r = checkAnswer([{ layer: "nasa", text: "Ventilation is the only way oxygen reaches the flame, as NASA shows.", citations: [{ doc_id: DOC, page: 1, quote: QUOTE }] }], { corpus });
  assert.equal(r.kept.length, 0);
  assert.equal(r.report.dropped[0].reason, "science_misconception");
});

test("the system prompt keeps rule 7 and its NASA source", () => {
  assert.match(SYSTEM_PROMPT, /molecular diffusion can supply oxygen to flames in microgravity without forced ventilation/);
  assert.match(SYSTEM_PROMPT, /does not necessarily extinguish a fire/);
  assert.match(SYSTEM_PROMPT, /never describe forced ventilation as the only oxygen transport mechanism/);
  assert.match(SYSTEM_PROMPT, /A Researcher's Guide to Combustion Science, pp\. 11 and 35/);
});
