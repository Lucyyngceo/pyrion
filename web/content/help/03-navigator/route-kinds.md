---
id: route-kinds
title: The three kinds of change: move, leave open, different regime
chapter: 3
order: 2
dataHelp: [route-sentence, route-chip, route-name]
sources: ["engine/src/navigator.ts"]
---

A route is made of changes, and there are only three kinds.

**Move.** A number you set (oxygen, pressure, flow, thickness...) goes to the nearest condition that was actually tested in that investigation. For oxygen and pressure together, "nearest" means the nearest point of the region covered by the investigation's tests, not the nearest oxygen value and the nearest pressure value separately. The route tells you the exact new values and shows the records that define that edge, so you can check them.

**Leave open.** Some axes of your question can be left unstated: the fuel phase (solid, liquid or gas), the diluent gas and the flame type. If an investigation did not record one of them, comparing at "any value" is honest, and the route says so: "Leave fuel phase open: PSI-25 did not record it." This is the only kind of "leave open" allowed.

**Different regime.** A regime axis you set differs from every condition the investigation was tested in: for example you set partial gravity and the investigation was run only in microgravity. The route says "Switch ... This is another regime, not a small step." A route that contains any regime switch is called a *different-regime route*, whatever else it also contains, and it is always ranked after every route that does not need one.

A route can combine kinds: "Leave fuel phase open ... Move pressure from 70.3 kPa to 101 kPa ...". If it contains a regime switch it is a different-regime route; otherwise, if it mixes kinds, it is a *combined* route.

Moves smaller than the measurement tolerance (0.5 %) are not listed, because the verdict already treats them as the same condition.

## For engineers

Types: `RouteChangeKind = 'move' | 'leave_open' | 'switch_regime'`; `RouteKind = 'move' | 'leave_open' | 'combined' | 'different_regime'` (`engine/src/navigator.ts`). Kind rule: any `switch_regime` change gives `different_regime`; otherwise more than one change kind gives `combined`; otherwise the single kind.

`planCluster` (`navigator.ts:120`) builds changes in this order:

1. **Regime axes**, in `REGIME_AXES` order (gravity_regime, fuel_phase, diluent, flame_type), for each axis the target states:
   - cluster state `missing` or `conflicting`: `leave_open` (never for `gravity_regime`, see the next topic);
   - cluster state `known` and different: `switch_regime` to the cluster's value;
   - the special case of `informational.gravity_not_covered` (a gravity above 1.1 g) is a switch of the gravity regime to the cluster's value, and `gravity_not_covered` is then removed from the route target.
2. **Continuous axes**: a stated axis that no test of the cluster records, or that is not recorded together with the other stated axes, makes the cluster unreachable (no `leave_open`).
3. **Moves.** If both `o2_mole_fraction` and `pressure` are stated, the points of the complete tests are normalized by the axis scales, the hull is built (`convexHull`, `engine/src/geometry.ts:25`) and, if the target is neither inside nor within the tolerance box (`hullNearBox`, `geometry.ts:88`), the nearest point of the hull is taken (`nearestPointOnHull`, `geometry.ts:135`). New values are rounded to 10 significant digits (`sig10`). Every other stated axis is clamped to [min, max] of the complete tests when it is outside by more than 0.5 % of its own value.
4. A move whose |to - from| is at most `MEASUREMENT_TOLERANCE_REL × |from|` (0.005, `engine/src/types.ts:175`) is applied to the target but not listed as a change.
5. Changes are ordered leave-open, move, switch for the sentence. `distance` is the Euclidean norm of the normalized displacement of the moved axes.

After a gravity switch to a regime other than `partial_gravity`, `informational.gravity_level` is removed from the route target, so a stale "0.16 g" cannot survive a switch to microgravity.

Moved values carry `citations`: for plane moves the records at the hull vertices that bound the nearest edge (`recordsAt`), for clamped axes the records at the bound.
