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

/** 0 when p is inside the hull, otherwise the distance to its boundary. */
export function distanceToHull(p: Vec2, hull: readonly Vec2[]): number {
  if (hull.length === 0) return Infinity;
  if (hullContains(p, hull)) return 0;
  return distToBoundary(p, hull);
}
