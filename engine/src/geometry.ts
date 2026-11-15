// 2-D convex hull (Andrew's monotone chain) and point-to-hull tests.
// Coordinates passed here are already normalized (dimensionless), so one tolerance fits all axes.

export interface Vec2 {
  x: number;
  y: number;
}

/** Tolerance in normalized units. A target this close to the boundary counts as on it. */
export const EPS = 1e-9;

function cross(o: Vec2, a: Vec2, b: Vec2): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function cmp(a: Vec2, b: Vec2): number {
  return a.x - b.x || a.y - b.y;
}

/**
 * Convex hull, counter-clockwise, starting at the lowest x (then lowest y).
 * Collinear points on edges are dropped. Degenerate inputs return 1 point or 2 segment ends.
 * The result does not depend on input order.
 */
export function convexHull(points: readonly Vec2[]): Vec2[] {
  const pts = [...points].sort(cmp).filter((p, i, a) => i === 0 || cmp(p, a[i - 1]) !== 0);
  if (pts.length <= 2) return pts;
  const lower: Vec2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  const hull = lower.concat(upper);
  // All points collinear: monotone chain returns the two ends.
  return hull.length >= 2 ? hull : pts.length > 0 ? [pts[0], pts[pts.length - 1]] : [];
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = a.x + t * dx - p.x;
  const qy = a.y + t * dy - p.y;
  return Math.sqrt(qx * qx + qy * qy);
}

/** Distance from p to the hull's boundary (or to its point/segment when degenerate). */
function distToBoundary(p: Vec2, hull: readonly Vec2[]): number {
  if (hull.length === 1) return Math.hypot(p.x - hull[0].x, p.y - hull[0].y);
  let best = Infinity;
  const n = hull.length === 2 ? 1 : hull.length;
  for (let i = 0; i < n; i += 1) {
    const d = distToSegment(p, hull[i], hull[(i + 1) % hull.length]);
    if (d < best) best = d;
  }
  return best;
}

/** Is p inside or on the hull (within EPS)? Works for 1, 2 and 3+ vertex hulls. */
export function hullContains(p: Vec2, hull: readonly Vec2[]): boolean {
  if (hull.length === 0) return false;
  if (hull.length <= 2) return distToBoundary(p, hull) <= EPS;
  for (let i = 0; i < hull.length; i += 1) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const edgeLen = Math.hypot(b.x - a.x, b.y - a.y);
    // Signed distance of p to the edge's line; negative means outside (hull is CCW).
    if (cross(a, b, p) / edgeLen < -EPS) return false;
  }
  return true;
}

/**
 * Does the hull (point, segment or polygon) touch the axis-aligned box centred on c with half-widths
 * hx, hy (normalized units)? Used for the measurement tolerance: the target counts as inside when some
 * point of the hull lies within the tolerance box around it.
 */
export function hullNearBox(hull: readonly Vec2[], c: Vec2, hx: number, hy: number): boolean {
  if (hull.length === 0) return false;
  const x0 = c.x - hx - EPS;
  const x1 = c.x + hx + EPS;
  const y0 = c.y - hy - EPS;
  const y1 = c.y + hy + EPS;
  if (hull.some((p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1)) return true;
  if (hull.length >= 3 && hullContains(c, hull)) return true;
  const n = hull.length === 1 ? 0 : hull.length === 2 ? 1 : hull.length;
  for (let i = 0; i < n; i += 1) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    // Liang–Barsky: does the segment a→b meet the box?
    let t0 = 0;
    let t1 = 1;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const clip = (p: number, q: number): boolean => {
      if (p === 0) return q >= 0;
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
      return true;
    };
    if (clip(-dx, a.x - x0) && clip(dx, x1 - a.x) && clip(-dy, a.y - y0) && clip(dy, y1 - a.y) && t0 <= t1) return true;
  }
  return false;
}

/** 0 when p is inside the hull, otherwise the distance to its boundary. */
export function distanceToHull(p: Vec2, hull: readonly Vec2[]): number {
  if (hull.length === 0) return Infinity;
  if (hullContains(p, hull)) return 0;
  return distToBoundary(p, hull);
}
