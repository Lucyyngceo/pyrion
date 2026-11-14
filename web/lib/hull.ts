// Convex hull and containment in the (O2 mole fraction, pressure) plane.
// Pressure is scaled by 1 atm so both axes are of order 1. The scaling is affine,
// so the hull and the inside/outside test are the same as in raw units.

import { ATM_KPA } from "./units";

export type Pt = [number, number]; // [o2 mole fraction, kPa]

const EPS = 1e-6;
const norm = ([o2, p]: Pt): Pt => [o2, p / ATM_KPA];
const denorm = ([o2, p]: Pt): Pt => [o2, p * ATM_KPA];

const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Andrew's monotone chain. Returns CCW vertices in raw units; 1 or 2 vertices if degenerate. */
export function convexHull(points: Pt[]): Pt[] {
  const uniq = new Map<string, Pt>();
  for (const p of points) {
    const n = norm(p);
    uniq.set(`${n[0].toFixed(9)}|${n[1].toFixed(9)}`, n);
  }
  const pts = [...uniq.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length <= 1) return pts.map(denorm);

  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= EPS * EPS) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= EPS * EPS) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  // All points collinear: keep the two extremes.
  if (hull.length < 3) return [pts[0], pts[pts.length - 1]].map(denorm);
  return hull.map(denorm);
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Normalized distance from the point to the hull; 0 when inside or on the boundary. */
export function distanceToHull(point: Pt, hullRaw: Pt[]): number {
  if (hullRaw.length === 0) return Infinity;
  const p = norm(point);
  const h = hullRaw.map(norm);
  if (h.length === 1) return Math.hypot(p[0] - h[0][0], p[1] - h[0][1]);
  if (h.length === 2) return distToSegment(p, h[0], h[1]);
  let inside = true;
  for (let i = 0; i < h.length; i++) {
    if (cross(h[i], h[(i + 1) % h.length], p) < -EPS) {
      inside = false;
      break;
    }
  }
  if (inside) return 0;
  let d = Infinity;
  for (let i = 0; i < h.length; i++) d = Math.min(d, distToSegment(p, h[i], h[(i + 1) % h.length]));
  return d;
}

export const insideHull = (point: Pt, hull: Pt[]) => distanceToHull(point, hull) <= EPS;
