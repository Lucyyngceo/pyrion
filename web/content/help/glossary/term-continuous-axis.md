---
id: term-continuous-axis
title: "Continuous axis"
chapter: 11
order: 5
dataHelp: [ctl-oxygen-number, ctl-pressure-number]
sources: ["engine/src/types.ts"]
---

A setting that is a number: oxygen fraction, pressure, flow velocity, sample thickness and a few others. Compared by range and, for oxygen with pressure, by region. The opposite is a regime axis, which is a category.

## For engineers

`CONTINUOUS_AXES` (`engine/src/types.ts`): `o2_mole_fraction`, `burner_o2_mole_fraction`, `pressure` (kPa), `flow_velocity` (cm/s), `sample_thickness` (mm), `droplet_diameter_initial` (mm), `ambient_temperature` (K), `gravity_level` (g). `gravity_level` is informational and never compared.
