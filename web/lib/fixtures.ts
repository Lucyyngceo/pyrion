// SYNTHETIC FIXTURES — NOT NASA DATA.
//
// Used only while data/conditions/*.csv does not exist yet, so the interface can be built
// and tested. Every value below is invented. The investigations are called "DEMO-…" on
// purpose, so no fixture can be mistaken for a PSI investigation, and the page shows a
// banner whenever these fixtures are in use.

import type { ConditionRecord, Dataset, Investigation } from "./types";

type Spec = {
  accession: string;
  regime?: [string, string, string];
  points: [number | null, number | null][];
};

const SPECS: Spec[] = [
  {
    accession: "DEMO-A",
    regime: ["microgravity", "solid", "N2"],
    points: [[0.16, 52], [0.18, 101.3], [0.24, 101.3], [0.4, 92], [0.36, 62], [0.21, 45], [0.28, 80], [0.22, 70]],
  },
  {
    accession: "DEMO-B",
    regime: ["microgravity", "liquid", "He"],
    points: [[0.15, 101.3], [0.2, 101.3], [0.25, 101.3], [0.2, 200], [0.15, 300], [0.25, 300]],
  },
  {
    accession: "DEMO-C",
    regime: ["microgravity", "liquid", "CO2"],
    points: [[0.16, 101.3], [0.21, 101.3], [0.19, 152]],
  },
  {
    accession: "DEMO-D",
    regime: ["microgravity", "gas", "N2"],
    points: [[0.21, 101.3], [0.4, 101.3], [0.5, 101.3], [0.65, 101.3], [0.85, 101.3]],
  },
  {
    accession: "DEMO-E",
    regime: ["normal_gravity", "solid", "N2"],
    points: [[0.21, 101.3], [0.3, 70], [0.25, 58], [0.21, 82]],
  },
  {
    accession: "DEMO-F",
    regime: ["microgravity", "solid", "N2"],
    points: [[0.21, null], [0.25, null]],
  },
  {
    accession: "DEMO-G",
    points: [[0.21, 101.3], [0.3, 101.3]],
  },
];

function rec(accession: string, test_id: string, variable: string, value: string, unit: string, row: number): ConditionRecord {
  return {
    accession,
    test_id,
    variable,
    value,
    unit,
    value_original: value,
    unit_original: unit,
    method: "table",
    source_file: "synthetic/fixture.csv",
    source_location: `row=${row};column=${variable}`,
    quote: "SYNTHETIC: invented for interface development, not a NASA value",
    status: "extracted",
    note: "synthetic fixture",
  };
}

function build(): ConditionRecord[] {
  const out: ConditionRecord[] = [];
  let row = 1;
  for (const s of SPECS) {
    if (s.regime) {
      const [g, f, d] = s.regime;
      out.push(rec(s.accession, "*", "gravity_regime", g, "", row));
      out.push(rec(s.accession, "*", "fuel_phase", f, "", row));
      out.push(rec(s.accession, "*", "diluent", d, "", row));
    }
    s.points.forEach(([o2, p], i) => {
      const id = `T${String(i + 1).padStart(2, "0")}`;
      if (o2 !== null) out.push(rec(s.accession, id, "o2_mole_fraction", String(o2), "1", row));
      if (p !== null) out.push(rec(s.accession, id, "pressure", String(p), "kPa", row));
      row++;
    });
  }
  return out;
}

const INVESTIGATIONS: Investigation[] = SPECS.map((s) => ({
  accession: s.accession,
  acronym: `Fixture ${s.accession.slice(-1)}`,
  title: "Synthetic fixture for interface development (not NASA data)",
  doi: "",
  license: "synthetic",
  version: "0",
  project_type: "Synthetic fixture",
}));

export function syntheticDataset(): Dataset {
  return {
    mode: "synthetic",
    records: build(),
    investigations: INVESTIGATIONS,
    files: {},
    conditionFiles: [],
  };
}
