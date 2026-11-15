---
id: lenses-leg-filter
title: Safety-leg filter (Lenses page)
chapter: 9
order: 224
keywords: filter, prevention, detection, suppression, safety leg, lens matrix, lenses
dataHelp: lenses-leg-filter
sources: data/derived/lenses.json (investigations[].legs, built by tools/build_lenses.py); web/lib/lenses/equipment.ts (parseLeg)
link: /lenses
---
What it is: Links above the lens matrix that show all investigations or only those with a quote for one safety leg: prevention, detection or suppression. The same filter opens from a link such as /lenses?leg=detection.

What it shows: The matrix rows of the investigations whose PSI record (or the challenge statement) has at least one quote tagged with that leg, and how many there are. The number next to each leg is the count of tagged investigations.

How to use it: Select a leg to filter, or "all" to show every investigation again. The address of the page keeps the filter, so the view can be shared.

Example: Select detection to see SAME, SAME-R and the other investigations whose records mention detection.

What it does not do: It does not rank investigations within a leg, and an investigation left out has no quote for that leg in the fields read; that does not mean its research says nothing about it.
