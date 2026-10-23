import type { Vec2 } from '../schema/types';
import {
  pointInPolygon,
  pointStrictlyInPolygon,
  segmentsCrossInterior,
  getInteriorPoints,
} from './polygon';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function computeBoundingBox(points: Vec2[]): BoundingBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return { minX, minY, maxX, maxY };
}

export function boundingBoxesOverlap(
  a: BoundingBox,
  b: BoundingBox,
  tol = 0.01
): boolean {
  if (a.maxX < b.minX - tol) return false;
  if (a.minX > b.maxX + tol) return false;
  if (a.maxY < b.minY - tol) return false;
  if (a.minY > b.maxY + tol) return false;
  return true;
}

/**
 * Checks whether two polygons overlap.
 * Touching edges and vertices are VALID and do NOT count as overlap.
 *
 * Algorithm:
 * 1. Bounding-box rejection test (with tolerance).
 * 2. Edge-crossing test: returns true if any edge of A strictly crosses an edge of B.
 * 3. Containment test in both directions using interior sample points.
 */
export function polygonsOverlap(
  polyA: Vec2[],
  polyB: Vec2[],
  tol = 0.01,
  boxA?: BoundingBox,
  boxB?: BoundingBox
): boolean {
  if (polyA.length < 3 || polyB.length < 3) return false;

  const bA = boxA ?? computeBoundingBox(polyA);
  const bB = boxB ?? computeBoundingBox(polyB);
  if (!boundingBoxesOverlap(bA, bB, tol)) {
    return false;
  }

  const nA = polyA.length;
  const nB = polyB.length;

  // Step 2: Check for strict interior edge crossings
  for (let i = 0; i < nA; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % nA];

    for (let j = 0; j < nB; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % nB];

      if (segmentsCrossInterior(a1, a2, b1, b2, tol)) {
        return true;
      }
    }
  }

  // Step 3: Check if polyA is inside polyB, or polyB is inside polyA
  // Test interior points of polyA inside polyB
  const interiorA = getInteriorPoints(polyA);
  for (const pt of interiorA) {
    if (pointStrictlyInPolygon(pt, polyB, tol)) {
      return true;
    }
  }

  // Test interior points of polyB inside polyA
  const interiorB = getInteriorPoints(polyB);
  for (const pt of interiorB) {
    if (pointStrictlyInPolygon(pt, polyA, tol)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether outer polygon fully contains inner polygon.
 * Touching edges are valid.
 *
 * Requirements:
 * 1. All vertices of inner must be inside outer (or on outer's boundary within tol).
 * 2. No edge of inner may strictly cross an edge of outer.
 * 3. Edge midpoints of inner must be inside outer (catches notch-bridging edges).
 * 4. Interior sample points of inner must be inside outer.
 */
export function polygonContains(
  outer: Vec2[],
  inner: Vec2[],
  tol = 0.01,
  outerBox?: BoundingBox,
  innerBox?: BoundingBox
): boolean {
  if (outer.length < 3 || inner.length < 3) return false;

  const oBox = outerBox ?? computeBoundingBox(outer);
  const iBox = innerBox ?? computeBoundingBox(inner);

  // Quick bounding box check: inner box cannot exceed outer box by more than tol
  if (
    iBox.minX < oBox.minX - tol ||
    iBox.maxX > oBox.maxX + tol ||
    iBox.minY < oBox.minY - tol ||
    iBox.maxY > oBox.maxY + tol
  ) {
    return false;
  }

  // 1. All vertices of inner must be inside outer
  for (const vertex of inner) {
    if (!pointInPolygon(vertex, outer, tol)) {
      return false;
    }
  }

  const nOuter = outer.length;
  const nInner = inner.length;

  // 2. No edge of inner may cross an edge of outer strictly
  for (let i = 0; i < nInner; i++) {
    const in1 = inner[i];
    const in2 = inner[(i + 1) % nInner];

    for (let j = 0; j < nOuter; j++) {
      const out1 = outer[j];
      const out2 = outer[(j + 1) % nOuter];

      if (segmentsCrossInterior(in1, in2, out1, out2, tol)) {
        return false;
      }
    }

    // 3. Edge midpoint must be inside outer
    const midX = (in1.x + in2.x) / 2;
    const midY = (in1.y + in2.y) / 2;
    if (!pointInPolygon({ x: midX, y: midY }, outer, tol)) {
      return false;
    }
  }

  // 4. Interior sample points must also be inside outer
  const interiorPoints = getInteriorPoints(inner);
  for (const pt of interiorPoints) {
    if (!pointInPolygon(pt, outer, tol)) {
      return false;
    }
  }

  return true;
}
