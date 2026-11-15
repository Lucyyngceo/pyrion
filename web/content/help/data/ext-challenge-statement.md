---
id: ds-ext-challenge-statement
title: The Flame in Freefall challenge statement
chapter: data
order: 151
keywords: challenge, flame in freefall, space apps, moon base, 30% oxygen, 10.2 psi
link: /data
page: data
dataHelp:
sources: https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/
---
The Flame in Freefall challenge is the NASA International Space Apps Challenge 2026 problem this project answers: “Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data”. Its page is https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/.

In plain words: the challenge asks what fire safety insight can be drawn from the NASA microgravity combustion data. It also states the atmosphere expected for a Moon base, and the app uses that statement as one of its starting scenarios.

The sentence the app uses (section "Potential Considerations", "Spacesuits and oxygen concentration"), quoted:

> The intermediate oxygen concentration used on the Moon will likely be 30% or greater, with a corresponding pressure of 10.2 psi or less.

The challenge states a band, not a point. The scenario takes the corner of that band (30 % O2, 10.2 psi, which is 70.3 kPa). The lunar gravity of that scenario (0.16 g) does not come from the challenge: it comes from NTRS 20210020446.

## For engineers
- Preset id `challenge-lunar-base` in `engine/src/presets.ts`; conversion 1 psi = 6.894757293168361 kPa, so 10.2 psi = 70.3265 kPa.
- The challenge text is not a PSI or NTRS document and is not stored in `data/raw/`.
