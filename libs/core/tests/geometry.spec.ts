import { describe, expect, it } from 'vitest';
import {
  add,
  cross,
  dist,
  dot,
  inverseTransformPoint,
  isSelfIntersecting,
  isValidPolygon,
  normalizeWinding,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  polygonSignedArea,
  rotate,
  segmentsCrossInterior,
  sub,
  transformPoint,
  vec2,
} from '../src';

describe('Geometry primitives', () => {
  it('performs vector operations correctly', () => {
    const a = vec2(3, 4);
    const b = vec2(1, 2);
    expect(add(a, b)).toEqual({ x: 4, y: 6 });
    expect(sub(a, b)).toEqual({ x: 2, y: 2 });
    expect(dot(a, b)).toBe(11);
    expect(cross(a, b)).toBe(2); // 3*2 - 4*1 = 2
    expect(dist(vec2(0, 0), vec2(3, 4))).toBe(5);
  });

  it('rotates vectors and transforms points', () => {
    const p = vec2(10, 0);
    const rotated90 = rotate(p, 90);
    expect(rotated90.x).toBeCloseTo(0);
    expect(rotated90.y).toBeCloseTo(10);

    const transformed = transformPoint(p, vec2(5, 5), 90);
    expect(transformed.x).toBeCloseTo(5);
    expect(transformed.y).toBeCloseTo(15);

    const inverted = inverseTransformPoint(transformed, vec2(5, 5), 90);
    expect(inverted.x).toBeCloseTo(10);
    expect(inverted.y).toBeCloseTo(0);
  });

  it('computes polygon area and centroid', () => {
    // 10x10 square
    const square = [
      vec2(0, 0),
      vec2(10, 0),
      vec2(10, 10),
      vec2(0, 10),
    ];
    expect(polygonArea(square)).toBe(100);
    const centroid = polygonCentroid(square);
    expect(centroid.x).toBeCloseTo(5);
    expect(centroid.y).toBeCloseTo(5);
  });

  it('normalizes polygon winding to CCW', () => {
    // CW polygon (y down or clockwise in cartesian)
    const cw = [
      vec2(0, 0),
      vec2(0, 10),
      vec2(10, 10),
      vec2(10, 0),
    ];
    expect(polygonSignedArea(cw)).toBeLessThan(0);
    const normalized = normalizeWinding(cw, 'ccw');
    expect(polygonSignedArea(normalized)).toBeGreaterThan(0);
  });

  it('detects point in polygon and points on boundary', () => {
    const poly = [
      vec2(0, 0),
      vec2(10, 0),
      vec2(10, 10),
      vec2(0, 10),
    ];

    expect(pointInPolygon(vec2(5, 5), poly)).toBe(true);
    expect(pointInPolygon(vec2(15, 5), poly)).toBe(false);

    // Boundary edge point is inside with tolerance
    expect(pointInPolygon(vec2(10, 5), poly)).toBe(true);
    expect(pointInPolygon(vec2(0, 0), poly)).toBe(true);
  });

  it('detects segment crossings and ignores touching endpoints', () => {
    // Strictly crossing segments
    const s1A = vec2(0, 5);
    const s1B = vec2(10, 5);
    const s2A = vec2(5, 0);
    const s2B = vec2(5, 10);
    expect(segmentsCrossInterior(s1A, s1B, s2A, s2B)).toBe(true);

    // Touching at endpoint (T-junction or corner)
    const tA = vec2(5, 5);
    const tB = vec2(5, 10);
    expect(segmentsCrossInterior(s1A, s1B, tA, tB)).toBe(false);

    // Parallel disjoint
    const pA = vec2(0, 0);
    const pB = vec2(10, 0);
    const pC = vec2(0, 2);
    const pD = vec2(10, 2);
    expect(segmentsCrossInterior(pA, pB, pC, pD)).toBe(false);
  });

  it('detects bow-tie (self-intersecting) polygon -> invalid-polygon', () => {
    // Bow-tie: non-adjacent edges cross
    const bowTie = [
      vec2(0, 0),
      vec2(10, 10),
      vec2(0, 10),
      vec2(10, 0),
    ];
    expect(isSelfIntersecting(bowTie)).toBe(true);
    expect(isValidPolygon(bowTie)).toBe(false);

    // Simple non-self-intersecting square is valid
    const validSquare = [
      vec2(0, 0),
      vec2(10, 0),
      vec2(10, 10),
      vec2(0, 10),
    ];
    expect(isSelfIntersecting(validSquare)).toBe(false);
    expect(isValidPolygon(validSquare)).toBe(true);
  });
});
