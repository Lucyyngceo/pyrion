---
id: take-me-there
title: "\"Take me there\""
keywords: take me there, apply route, move my condition, switch to, go to evidence, button on route, apply a route, custom condition
chapter: 3
order: 6
dataHelp: [take-me-there, tars-take-me-there, help-center-take-me-there]
sources: ["engine/src/navigator.ts", "web/content/help/take-me-there.md"]
---

"Take me there" is the button on a route. It moves your condition to the condition the route describes, and the verdict is recalculated on the spot.

What happens when you click it:

1. The app replaces your target with the route's resulting target (the new oxygen and pressure, the opened axes, the switched regime).
2. The engine evaluates it again, exactly as for any other condition. If the route was built correctly, the investigation is now *Applicable*; if not, you would see it, because the verdict is never taken from the route.
3. Applying a route leaves the preset you started from: your condition is now a custom one.

For a different-regime route the button says "Switch to ..." and not "Move": it is a different situation, not a small step, and the app does not hide that.

The button is a convenience. Everything it does you could do yourself with the sliders and the regime selectors; the route only tells you which values to use and why.

## For engineers

The route's `target` (`Route.target`, `engine/src/navigator.ts`) is the canonical target after all changes: `{ regime, continuous, informational? }`. It is verified before being returned: `judgeCluster(cluster, finalTarget, scales).verdict === 'APPLICABLE'` (otherwise the investigation is `unreachable`). Test: `navigator.test.ts` `checkInvariant` applies **every** route's target with `evaluate()` and asserts APPLICABLE for the route's accession.

The app uses `route.target` directly; it must not edit it. For gravity, `informational.gravity_level` is dropped when the route switches the regime to anything but partial gravity (so a stale lunar level cannot remain in a microgravity target) and `informational.gravity_not_covered` is removed after a switch.

A target given to `routesToEvidence` with `continuous.gravity_level` is normalized to `informational.gravity_level` and `RouteSet.notes[0]` says "The gravity level is shown, not compared: no condition record carries it, so it is not an axis a route can move or leave open."
