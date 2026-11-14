import type { Metadata } from "next";
import "../why.css";

export const metadata: Metadata = {
  title: "Why this exists · PYRION Ω",
  description: "A personal note from the author.",
};

export default function WhyPage() {
  return (
    <main className="why">
      <h1>Why this exists</h1>

      <p>
        This project reached me at a very hard moment in my life, a moment in which I am fighting adversity on every front:
        in my family, in my personal life, and in my company, the startup I am trying to keep alive.
      </p>
      <p>
        The opportunity to create this fills me with hope. I say it as I write, a few minutes after watching Starship&apos;s
        fifteenth flight, when a ship was caught vertically by its tower for the first time in human history. A machine
        capable of carrying humans to space, and soon to other planets, came back intact. I am writing this with tears in my
        eyes, moved and happy.
      </p>
      <p>
        Even if this is only a project, it motivates me. It tells me that I truly am, and that we truly are, moving forward as
        a species. It fills me with a happiness so pure: the simple fact that something which once seemed impossible to me,
        something I was called crazy for in the small mountain town I come from, is happening. Today I am writing this next to
        a project more ambitious than anything I ever imagined I could create in my life.
      </p>
      <p>
        I know that dreams come true, and this project is faithful, real proof of it. I will carry it for the rest of my
        career, close to my heart, forever, until the day I die.
      </p>
      <p>
        Thank you. Thank you, NASA, for this opportunity, and thank you to everyone who made this project possible. I will
        not let you down in the mission of my life, which is MAKING LIFE MULTIPLANETARY. Thank you.
      </p>

      <h2>Thank you, Costa Rica</h2>

      <p>
        Thank you all. To Universidad Fidélitas, which opened its doors to host NASA Space Apps San José. To the NASA Space
        Apps Costa Rica organizers and volunteers who gave their weekend so that we could build. To the jury and partner
        organizations: Asociación Costarricense de Cohetería, World Wide Technology, ACACIE, the Colegio Federado de
        Ingenieros y de Arquitectos, and IA Developers. I thank you truly, from the heart.
      </p>
      <p>
        I have been able to prove to myself that the frontiers of what I once imagined and dreamed are possible. I will never
        forget this. And I will repay it as I always have, by dedicating myself, until my last breath, to helping people and
        our human race.
      </p>

      <div className="sig">
        <p>Luis Johan Elizondo Arias</p>
        <p>La Paz, Piedades Norte, San Ramón, Alajuela, Costa Rica · San Ramón, land of poets</p>
        <p>From a family of farmers, sugarcane growers who make dulce, the traditional cane sugar, and small entrepreneurs.</p>
      </div>
    </main>
  );
}
