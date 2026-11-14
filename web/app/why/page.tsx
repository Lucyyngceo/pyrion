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
        This project reached me at a hard moment in my life. I have been fighting adversity on every front at once: family,
        personal, and the startup I am trying to keep alive.
      </p>
      <p>
        I am writing this a few minutes after watching Starship&apos;s fifteenth flight, when a ship came home and was caught by
        its tower for the first time. A machine built to carry people to space, and one day to other planets, came back
        intact. I am writing with tears in my eyes.
      </p>
      <p>
        It may be only a hackathon project, but it tells me something real: we are moving forward as a species, and I am
        moving forward too. I come from a small mountain town where people called me crazy for wanting this. Today I am
        writing these lines next to the most ambitious thing I have ever built, something I never imagined I would be able to
        make.
      </p>
      <p>
        Dreams do come true. This project is my proof. I will carry it with me for the rest of my career, and for the rest of
        my life.
      </p>
      <p>
        Thank you, NASA, for this opportunity, and thank you to everyone who made it possible. I will not let you down in the
        mission I have chosen for my life: helping make life multiplanetary.
      </p>

      <h2>Thank you, Costa Rica</h2>

      <p>
        To Universidad Fidélitas, which opened its doors to host NASA Space Apps San José. To the NASA Space Apps Costa Rica
        organizers and volunteers who gave their weekend so that we could build. To the jury and partner organizations:
        Asociación Costarricense de Cohetería, World Wide Technology, ACACIE, the Colegio Federado de Ingenieros y de
        Arquitectos, and IA Developers.
      </p>
      <p>
        From the heart: you let me prove to myself that the frontiers I once only imagined can be crossed. I will never forget
        it. I will repay it the only way I know, by giving everything I have, to my last breath, to helping people and our
        human species.
      </p>

      <div className="sig">
        <p>Luis Johan Elizondo Arias</p>
        <p>La Paz, Piedades Norte, San Ramón, Alajuela, Costa Rica · San Ramón, land of poets</p>
        <p>From a family of farmers, sugarcane growers who make dulce, the traditional cane sugar, and small entrepreneurs.</p>
      </div>
    </main>
  );
}
