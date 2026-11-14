# PYRION Ω — The Evidence Envelope

**NASA Space Apps Challenge 2026** · Challenge: *Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data* · Team **NDMLM** · Local event: San José, Costa Rica

> **Status:** under construction during the hackathon (November 14–15, 2026).

## What it is

PYRION is being built to rank NASA combustion experiments by how physically applicable they are to a target condition (gravity level, oxygen concentration, pressure, fuel type) and to show where the measured evidence ends.

Inside the measured range of a variable it can interpolate. Across a change of physical regime, such as microgravity versus partial gravity, it does not interpolate. It reports the gap instead.

The applicability verdict is computed by a deterministic engine. A language model is used only to parse inputs and to narrate results. It never decides the verdict.

## Data

Primary source: NASA Physical Sciences Informatics (PSI), <https://psi.nasa.gov>, combustion investigations.
Each investigation used is cited with its DOI and its license. That list is in progress.

## Provenance

Development started on November 14, 2026, after the hackathon opened at 09:00 CST (UTC−6). Pre-event work was conceptual only: challenge study and scope decisions. Server-side push timestamps and CI run logs are available in the repository history.

## Use of SI tools

This project uses Super Intelligence (SI) tools during development (Claude Code). A full disclosure will be added before submission: which tools, for what, and which parts of the code and text they produced.

## License

Code: Apache License 2.0, see [LICENSE](LICENSE).
Data from NASA PSI keeps its own terms, listed per investigation.
