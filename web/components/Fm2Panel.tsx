"use client";

import { useId, useMemo, useState } from "react";
import { FM2_SOURCES, PMMA_STOICH, fm2Balance, fm2Chamber, fm2FinalO2, type Fm2Balance, type SourceCitation } from "@/lib/engine";
import { fmt } from "@/lib/units";

const STARTS = [37, 33, 29, 25];
/** Not stated in NTRS 20260001966: PYRION's assumed range, shown as such. */
const T_RANGE = { lo: 288.15, hi: 308.15, def: 295.15 };
const note = (n: string) => ({ note: n });
const TEMP_SRC = note("Not stated in NTRS 20260001966. Assumed range 15 to 35 °C chosen by PYRION; 22 °C is the laboratory temperature of another paper (NTRS 20000004509, p. 6).");

function balance(startPct: number, limitPct: number, tK: number): Fm2Balance {
  return fm2Balance(
    fm2Chamber({
      temperatureK: { value: tK, unit: "K", source: TEMP_SRC },
      startO2Fraction: { value: startPct / 100, unit: "1", source: FM2_SOURCES.pressure },
      limitO2Fraction: { value: limitPct / 100, unit: "1", source: note("Hypothesised limiting oxygen, set by the slider. Not a measurement.") },
      stoichGO2PerGFuel: PMMA_STOICH,
    }),
  );
}

function Cite({ s }: { s: SourceCitation }) {
  return (
    <span className="muted">
      {s.file.split("/")[0]}, p. {s.page}: <q>{s.quote}</q>
    </span>
  );
}

export default function Fm2Panel() {
  const id = useId();
  const [limit, setLimit] = useState(25);
  const [tK, setTK] = useState(T_RANGE.def);

  const rows = useMemo(
    () =>
      STARTS.map((x0) => {
        const at = balance(x0, limit, tK);
        const lo = balance(x0, limit, T_RANGE.lo);
        const hi = balance(x0, limit, T_RANGE.hi);
        return { x0, at, g: [Math.min(lo.fuelBurnedG, hi.fuelBurnedG), Math.max(lo.fuelBurnedG, hi.fuelBurnedG)] };
      }),
    [limit, tK],
  );

  // Check case: PMMA, 34 % O2, 8.2 psia, up to 1.2 g burned; NASA: final O2 13 % to 21 %.
  const check = useMemo(() => {
    const inputs = (t: number, l: number) => balance(34, l, t).inputs;
    const finals = [T_RANGE.lo, tK, T_RANGE.hi].map((t) => fm2FinalO2(inputs(t, 21), 1.2).finalO2Fraction * 100);
    const m21 = [T_RANGE.lo, T_RANGE.hi].map((t) => balance(34, 21, t).fuelBurnedG);
    const m13 = [T_RANGE.lo, T_RANGE.hi].map((t) => balance(34, 13, t).fuelBurnedG);
    return { atT: finals[1], lo: Math.min(finals[0], finals[2]), hi: Math.max(finals[0], finals[2]), m21, m13 };
  }, [tK]);
  const inRange = check.lo >= 13 && check.hi <= 21;
  const partly = !inRange && check.hi >= 13 && check.lo <= 21;

  const b0 = rows[0].at.inputs;

  return (
    <section className="card br-card" aria-labelledby="fm2-h">
      <div className="card-head">
        <h2 id="fm2-h">FM2 instrument balance</h2>
        <p className="muted small">
          <strong>Closed-chamber mass balance, not a flame model.</strong> How much oxygen a burn can use before the chamber
          reaches a hypothesised limiting oxygen. It does not say where the limit is.
        </p>
      </div>

      <div className="fm2-grid">
        <div>
          <h3 className="br-h3">Inputs, with sources</h3>
          <ul className="fm2-in">
            <li>
              <strong>Volume {fmt(b0.volumeL.value, 1)} L</strong> <Cite s={FM2_SOURCES.volume} />
            </li>
            <li>
              <strong>Pressure 8.2 psia ({fmt(b0.pressureKPa.value, 1)} kPa)</strong> <Cite s={FM2_SOURCES.pressure} />
            </li>
            <li>
              <strong>Starting O₂ 37 / 33 / 29 / 25 %</strong> (the four tests, same source, pp. 5–10)
            </li>
            <li>
              <strong>Fuel: PMMA, {fmt(PMMA_STOICH.value, 4)} g O₂ per g</strong>{" "}
              <span className="muted">derived by PYRION from C₅H₈O₂, not stated by NASA</span>
            </li>
          </ul>

          <label className="fm2-ctl" htmlFor={`${id}-t`}>
            <span>
              Temperature <strong>{fmt(tK, 1)} K</strong> ({fmt(tK - 273.15, 1)} °C){" "}
              <span className="tag-assumed">assumed range {fmt(T_RANGE.lo - 273.15, 0)}–{fmt(T_RANGE.hi - 273.15, 0)} °C, not in the source</span>
            </span>
            <input id={`${id}-t`} type="range" min={T_RANGE.lo} max={T_RANGE.hi} step={0.5} value={tK} onChange={(e) => setTK(Number(e.target.value))} />
          </label>

          <label className="fm2-ctl" htmlFor={`${id}-l`}>
            <span>
              Hypothesised limiting O₂ <strong>{fmt(limit, 1)} %</strong>{" "}
              <span className="tag-assumed">hypothesis, not a measurement</span>
            </span>
            <input id={`${id}-l`} type="range" min={20} max={32} step={0.5} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
            <span className="muted small">
              The FM2 plan expects a lunar limit of 24–26 % (<Cite s={FM2_SOURCES.plan} />). That is an expectation, not a result.
            </span>
          </label>
        </div>

        <div>
          <h3 className="br-h3">Output per test (limit {fmt(limit, 1)} %)</h3>
          <table className="fm2-tab">
            <thead>
              <tr>
                <th scope="col">Start O₂</th>
                <th scope="col" className="num">O₂ consumable</th>
                <th scope="col" className="num">PMMA burned</th>
                <th scope="col" className="num">Final O₂</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ x0, at, g }) => (
                <tr key={x0} className={at.startAboveLimit ? "" : "fm2-below"}>
                  <th scope="row">{x0} %</th>
                  <td className="num">
                    {at.startAboveLimit ? `${fmt(at.o2ConsumableMol * 1000, 1)} mmol (${fmt(at.o2ConsumableG, 2)} g)` : "none"}
                  </td>
                  <td className="num">
                    {at.startAboveLimit ? (
                      <>
                        {fmt(at.fuelBurnedG, 2)} g <span className="muted">({fmt(g[0], 2)}–{fmt(g[1], 2)} over the T range)</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="num">{fmt(at.finalO2Fraction * 100, 1)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">
            A start at or below the hypothesised limit has nothing to consume in this model. Final O₂ is the limit
            reached, not a prediction of the flame.
          </p>
          <details className="receipt-box">
            <summary>Formulas and assumptions</summary>
            <ul className="fm2-in small">
              {rows[0].at.formulas.map((f) => (
                <li key={f}>
                  <code>{f}</code>
                </li>
              ))}
              {rows[0].at.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </details>
        </div>
      </div>

      <div className="fm2-check">
        <h3 className="br-h3">Check case: PMMA at 34 % O₂, 8.2 psia, up to 1.2 g burned</h3>
        <p>
          NASA estimates the final O₂ at <strong>13 % to 21 %</strong> (<Cite s={FM2_SOURCES.checkCase} />). This balance, burning{" "}
          1.2 g of PMMA completely, gives <strong>{fmt(check.atT, 1)} %</strong> at {fmt(tK, 0)} K ({fmt(check.lo, 1)}–{fmt(check.hi, 1)} % over
          the assumed temperature range):{" "}
          <strong>
            {inRange ? "inside NASA's range" : partly ? "partly inside NASA's range" : "outside NASA's range"}
          </strong>
          .
        </p>
        <p className="muted small">
          Fuel mass that would bring a 34 % start to 21 %: {fmt(check.m21[0], 2)}–{fmt(check.m21[1], 2)} g; to 13 %: {fmt(check.m13[0], 2)}–{fmt(check.m13[1], 2)} g.
          The source gives the 13–21 % range without saying which burned mass or temperature belong to each end, so this check
          can show consistency of the instrument model, not that the model is right.
        </p>
      </div>
    </section>
  );
}
