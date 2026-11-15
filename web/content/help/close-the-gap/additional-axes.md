---
id: additional-axes
title: "Additional axes: listed, not gridded"
keywords: additional axes, gravity level, flow velocity, sample thickness, experimenter, listed not gridded, 0.16 g, 0.38 g, lunar gravity, mars gravity
chapter: 5
order: 4
dataHelp: [gap-section-axes]
sources: ["engine/src/experiments.ts", "NTRS 20210020446 p. 3", "NASA GSFC NSSDC Mars Fact Sheet"]
---

Oxygen and pressure are gridded because they are the axes PSI's tests vary most. Three more settings matter for a real experiment, but gridding them would multiply the number of tests. They are **listed, not gridded**, and each says plainly that the experimenter must choose it:

- **Gravity level**, for a partial-gravity target: to be stated by the experimenter; the levels in use are 0.16 g (lunar, from a NASA lunar-gravity presentation) and 0.38 g (Mars, NASA's Mars fact sheet), each with its source.
- **Flow velocity**, for a microgravity target: to be stated by the experimenter. If the nearest comparable investigations recorded a flow, the range they used is shown as a reference.
- **Sample thickness**, always: to be stated by the experimenter, with the recorded range of the comparable investigations as a reference.

The reason for "stated by the experimenter": PYRION does not know what material or geometry the new test would use, so it will not invent a value.

## For engineers

`additionalAxes: ListedAxis[]` (`engine/src/experiments.ts`): `{ axis: 'gravity_level' | 'flow_velocity' | 'sample_thickness', label, statedBy: 'experimenter', sentence, options? }`.

- `gravity_level` only when `target.regime.gravity_regime === 'partial_gravity'`; `options`: `{ value: 0.16, unit: 'g', source: 'NTRS 20210020446, page 3, "glunar = 0.16 gearth"' }` (`SOURCES.lunarGravity`, `engine/src/presets.ts`) and `{ value: 0.38, unit: 'g', source: 'Mars Fact Sheet, https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html', quote: 'Surface gravity (mean) (m/s2) 3.73 9.82 0.380' }` (`SOURCES.marsGravity`).
- `flow_velocity` only when the regime is `microgravity`.
- `sample_thickness` always.

Sentences: "Gravity level: to be stated by the experimenter; the levels in use are 0.16 g (lunar) and 0.38 g (Mars)." / "Flow velocity: to be stated by the experimenter. Recorded for the comparable investigations: PSI-9802 5 cm/s." (recorded ranges from the comparable investigations' records, 3 significant figures).

The 0.165 g figure of the FM2 centrifuge (NTRS 20260001966, PDF p. 13) is the engine's named Moon gravity; the 0.16 g presentation figure is shown here because it is what the lunar-gravity literature quotes.
