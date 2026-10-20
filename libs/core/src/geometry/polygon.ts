import type { Vec2 } from '../schema/types';
import {
  cross,
  sub,
  distanceToSegment,
  approxEqual,
} from './vec2';

/**
 * Calculates the signed area of a polygon using the shoelace formula.
 * Positive for CCW, negative for CW.
 */
export function polygonSignedArea(points: Vec2[]): number {
  const n = points.length;
  if (n < 3) return 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return area / 2;
}

export function polygonArea(points: Vec2[]): number {
  return Math.abs(polygonSignedArea(points));
}

export function polygonCentroid(points: Vec2[]): Vec2 {
  const n = points.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n < 3) {
    let sumX = 0;
    let sumY = 0;
    for (const p of points) {
      sumX += p.x;
      sumY += p.y;
    }
    return { x: sumX / n, y: sumY / n };
  }

  const signedArea = polygonSignedArea(points);
  if (Math.abs(signedArea) < 1e-7) {
    let sumX = 0;
    let sumY = 0;
    for (const p of points) {
      sumX += p.x;
      sumY += p.y;
    }
    return { x: sumX / n, y: sumY / n };
  }

  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const factor = points[i].x * points[j].y - points[j].x * points[i].y;
    cx += (points[i].x + points[j].x) * factor;
    cy += (points[i].y + points[j].y) * factor;
  }
  return {
    x: cx / (6 * signedArea),
    y: cy / (6 * signedArea),
  };
}

export function normalizeWinding(
  points: Vec2[],
  target: 'ccw' | 'cw' = 'ccw'
): Vec2[] {
  const signedArea = polygonSignedArea(points);
  const isCCW = signedArea > 0;
  if ((target === 'ccw' && !isCCW) || (target === 'cw' && isCCW)) {
    return [...points].reverse();
  }
  return [...points];
}

export function isPointOnSegment(
  p: Vec2,
  a: Vec2,
  b: Vec2,
  tol = 0.01
): boolean {
  return distanceToSegment(p, a, b) <= tol;
}

export function isPointOnPolygonBoundary(
  p: Vec2,
  polygon: Vec2[],
  tol = 0.01
): boolean {
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (isPointOnSegment(p, polygon[i], polygon[j], tol)) {
      return true;
    }
  }
  return false;
}

/**
 * Standard ray-casting test.
 * Returns true if point is inside the polygon or on its boundary (within tol).
 */
export function pointInPolygon(
  p: Vec2,
  polygon: Vec2[],
  tol = 0.01
): boolean {
  const n = polygon.length;
  if (n < 3) return false;

  // Check boundary first
  if (isPointOnPolygonBoundary(p, polygon, tol)) {
    return true;
  }

  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Checks whether point p is strictly inside the polygon (inside and not within tol of the boundary).
 */
export function pointStrictlyInPolygon(
  p: Vec2,
  polygon: Vec2[],
  tol = 0.01
): boolean {
  if (isPointOnPolygonBoundary(p, polygon, tol)) {
    return false;
  }
  return pointInPolygon(p, polygon, tol);
}

/**
 * Tests if two 2D line segments [p1, p2] and [p3, p4] cross strictly in their interior.
 * Endpoints touching within tol or collinear overlapping segments do NOT count as crossing.
 */
export function segmentsCrossInterior(
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  p4: Vec2,
  tol = 0.01
): boolean {
  // Check if any endpoint is within tol of the other segment or endpoint
  if (
    isPointOnSegment(p1, p3, p4, tol) ||
    isPointOnSegment(p2, p3, p4, tol) ||
    isPointOnSegment(p3, p1, p2, tol) ||
    isPointOnSegment(p4, p1, p2, tol)
  ) {
    return false;
  }

  const d1 = sub(p2, p1);
  const d2 = sub(p4, p3);
  const denom = cross(d1, d2);

  // Parallel or collinear
  if (Math.abs(denom) < 1e-9) {
    return false;
  }

  const d3 = sub(p3, p1);
  const t = cross(d3, d2) / denom;
  const u = cross(d3, d1) / denom;

  const margin = 1e-4;
  return t > margin && t < 1 - margin && u > margin && u < 1 - margin;
}

/**
 * Checks if two segments intersect in any way (including endpoints or touching).
 */
export function segmentsIntersect(
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  p4: Vec2,
  tol = 0.01
): boolean {
  if (segmentsCrossInterior(p1, p2, p3, p4, tol)) {
    return true;
  }
  return (
    isPointOnSegment(p1, p3, p4, tol) ||
    isPointOnSegment(p2, p3, p4, tol) ||
    isPointOnSegment(p3, p1, p2, tol) ||
    isPointOnSegment(p4, p1, p2, tol)
  );
}

/**
 * Checks if a polygon has self-intersections (bow-tie, figure 8, overlapping edges).
 */
export function isSelfIntersecting(polygon: Vec2[], tol = 0.01): boolean {
  const n = polygon.length;
  if (n < 3) return false;

  // Check for duplicate consecutive vertices or zero-length edges
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (approxEqual(polygon[i], polygon[j], tol)) {
      return true;
    }
  }

  // Check every pair of edges
  for (let i = 0; i < n; i++) {
    const iNext = (i + 1) % n;
    const a1 = polygon[i];
    const a2 = polygon[iNext];

    for (let j = i + 1; j < n; j++) {
      const jNext = (j + 1) % n;

      // Adjacent edges share a vertex
      const isAdjacent =
        i === j || i === jNext || iNext === j || iNext === jNext;
      const b1 = polygon[j];
      const b2 = polygon[jNext];

      if (isAdjacent) {
        // If adjacent edges overlap backwards onto each other (zero angle hairpin)
        continue;
      }

      if (segmentsIntersect(a1, a2, b1, b2, tol)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Validates a polygon shape according to Rule 7:
 * >= 3 points, non-zero area, no self-intersection.
 */
export function isValidPolygon(polygon: Vec2[], tol = 0.01): boolean {
  if (!polygon || polygon.length < 3) return false;
  if (polygonArea(polygon) <= tol) return false;
  if (isSelfIntersecting(polygon, tol)) return false;
  return true;
}

/**
 * Ear clipping triangulation to decompose simple polygon into triangles.
 * Used for interior point sampling.
 */
export function triangulate(polygon: Vec2[]): [Vec2, Vec2, Vec2][] {
  const n = polygon.length;
  if (n < 3) return [];
  if (n === 3) return [[polygon[0], polygon[1], polygon[2]]];

  const points = normalizeWinding(polygon, 'ccw');
  const indices: number[] = points.map((_, i) => i);
  const triangles: [Vec2, Vec2, Vec2][] = [];

  let count = indices.length;
  let attempts = 0;
  const maxAttempts = count * count;

  while (count > 3 && attempts < maxAttempts) {
    attempts++;
    let earFound = false;

    for (let i = 0; i < count; i++) {
      const prevIdx = indices[(i - 1 + count) % count];
      const currIdx = indices[i];
      const nextIdx = indices[(i + 1) % count];

      const a = points[prevIdx];
      const b = points[currIdx];
      const c = points[nextIdx];

      // Check if convex
      if (cross(sub(b, a), sub(c, b)) <= 0) {
        continue;
      }

      // Check if any other vertex is inside triangle abc
      let containsOther = false;
      for (let j = 0; j < count; j++) {
        const testIdx = indices[j];
        if (testIdx === prevIdx || testIdx === currIdx || testIdx === nextIdx) {
          continue;
        }
        const p = points[testIdx];
        if (pointInTriangle(p, a, b, c)) {
          containsOther = true;
          break;
        }
      }

      if (!containsOther) {
        triangles.push([a, b, c]);
        indices.splice(i, 1);
        count--;
        earFound = true;
        break;
      }
    }

    if (!earFound) {
      break;
    }
  }

  if (indices.length === 3) {
    triangles.push([
      points[indices[0]],
      points[indices[1]],
      points[indices[2]],
    ]);
  }

  return triangles;
}

function pointInTriangle(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
  const cp1 = cross(sub(b, a), sub(p, a));
  const cp2 = cross(sub(c, b), sub(p, b));
  const cp3 = cross(sub(a, c), sub(p, c));
  const hasNeg = cp1 < -1e-7 || cp2 < -1e-7 || cp3 < -1e-7;
  const hasPos = cp1 > 1e-7 || cp2 > 1e-7 || cp3 > 1e-7;
  return !(hasNeg && hasPos);
}

/**
 * Returns a set of interior sample points for the polygon (centroids of triangulated sub-triangles).
 */
export function getInteriorPoints(polygon: Vec2[]): Vec2[] {
  const tris = triangulate(polygon);
  if (tris.length === 0) {
    return [polygonCentroid(polygon)];
  }
  return tris.map(([a, b, c]) => ({
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3,
  }));
}
