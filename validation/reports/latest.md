# Validation report — 2026-11-14T16:39:46Z

Records: 2349 · trace check: ran · cells_traced: 2091 · text_files_scanned: 21 · units_rechecked: 810

**BLOCKER 1 · MAJOR 0 · MINOR 1**

| severity | check | where | what |
|---|---|---|---|
| BLOCKER | bounds | `data/conditions/PSI-69.csv:945` | pressure=0 kPa outside physical bounds [0.1, 2000.0] |
| MINOR | language | `web/lib/engine-adapter.ts:4` | 'safe' in: // engine in ../engine is still being written. When it exports a browser-safe |
