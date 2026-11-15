---
id: lenses-timeline
title: Evidence timeline (Lenses page)
chapter: 9
order: 220
keywords: timeline, evidence over time, oxygen, pressure, Moon Base band, FM2, planned
dataHelp: lenses-timeline
sources: data/derived/timeline.json (tools/build_timeline.py), data/raw/psi-data/<PSI-n>/_investigation/<PSI-n>.json (investigationEndDate, missionStart), engine/src/planner.ts (MOON_BASE_BAND, fm2Hypothetical), NTRS 20260001966 PDF p. 10
link: /lenses
---
What it is: A play/pause button and a year slider for the oxygen-pressure chart of PSI test points.

What it shows: The (oxygen, pressure) points of PSI tests, added in the year PSI gives for the end of each investigation; investigations with no date in PSI appear in the last frame. The Moon Base band (the same band as the Mission Planner) is an empty dashed outline. FM2's four planned tests are dotted and labelled "planned, not in PSI".

How to use it: Press Play to step through the years, or drag the slider to a year. With reduced motion set in your system, nothing plays by itself.

Example: Drag the slider to the earliest year and then to the last frame to see how the tested region grew.

What it does not do: It does not say when each test was run (PSI gives investigation dates, not test dates), and the FM2 points are not measurements.
