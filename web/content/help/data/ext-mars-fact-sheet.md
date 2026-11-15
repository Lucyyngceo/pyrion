---
id: ds-ext-mars-fact-sheet
title: NASA Mars Fact Sheet (NSSDC): surface gravity
chapter: data
order: 150
keywords: mars, gravity, 0.38, nssdc, fact sheet
link: /data
page: data
dataHelp:
sources: https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
---
The Mars Fact Sheet is a NASA Goddard (NSSDC) web page listing physical data of Mars next to Earth. PYRION uses one row of it.

In plain words: the app needs the gravity of Mars to place Mars on the gravity dial. It does not invent a value: it reads it from this page.

The row used (page last updated 19 May 2025), quoted:

> Surface gravity (mean) (m/s2) 3.73 9.82 0.380

Read as: Mars 3.73 m/s2, Earth 9.82 m/s2, ratio 0.380 (that is 0.380 g).

## For engineers
- Address: https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html.
- This page is cited by address and row; it is not stored under `data/raw/` and it contributes no condition record. The value is typed once in `engine/src/presets.ts` (`SOURCES.marsGravity`) with its quote.
