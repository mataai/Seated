import { describe, expect, it } from 'vitest';
import { polygonContains, polygonsOverlap, vec2 } from '../src';

describe('Polygon Overlap and Containment', () => {
  it('touching edges are valid (do NOT count as overlap)', () => {
    // Two squares sharing an edge at x = 10
    const square1 = [vec2(0, 0), vec2(10, 0), vec2(10, 10), vec2(0, 10)];
    const square2 = [vec2(10, 0), vec2(20, 0), vec2(20, 10), vec2(10, 10)];

    expect(polygonsOverlap(square1, square2)).toBe(false);
  });

  it('row exactly filling a building is valid (contained, touching edges)', () => {
    // Building 100x100
    const building = [vec2(0, 0), vec2(100, 0), vec2(100, 100), vec2(0, 100)];
    // Inner shape exactly matching building
    const matchingInner = [
      vec2(0, 0),
      vec2(100, 0),
      vec2(100, 100),
      vec2(0, 100),
    ];

    expect(polygonContains(building, matchingInner)).toBe(true);
  });

  it('polygon fully inside another with no edge crossings -> overlap detected', () => {
    const outer = [vec2(0, 0), vec2(100, 0), vec2(100, 100), vec2(0, 100)];
    const inner = [vec2(20, 20), vec2(40, 20), vec2(40, 40), vec2(20, 40)];

    // When testing overlap between siblings (e.g. two rows or zone & row),
    // one fully inside the other must be detected as an overlap!
    expect(polygonsOverlap(outer, inner)).toBe(true);
  });

  it('L-shaped building: row bridging the notch is rejected', () => {
    // L-shaped building:
    // (0, 10) ------ (5, 10)
    //   |               |
    //   |            (5, 5) ----- (10, 5)
    //   |                           |
    // (0, 0) ------------------- (10, 0)
    // The notch is in the upper right (x > 5 and y > 5).
    const lBuilding = [
      vec2(0, 0),
      vec2(10, 0),
      vec2(10, 5),
      vec2(5, 5),
      vec2(5, 10),
      vec2(0, 10),
    ];

    // Row that bridges the notch:
    // Starts at (2, 8) [inside], passes through notch (x from 5 to 8, y from 7 to 9)
    const bridgingRow = [vec2(2, 7), vec2(8, 7), vec2(8, 9), vec2(2, 9)];

    // Must be rejected by containment!
    expect(polygonContains(lBuilding, bridgingRow)).toBe(false);

    // Row fully inside the left column of L: (1, 6) to (4, 9)
    const validRowInL = [vec2(1, 6), vec2(4, 6), vec2(4, 9), vec2(1, 9)];
    expect(polygonContains(lBuilding, validRowInL)).toBe(true);
  });

  it('concave zone: row inside the bounding box but outside the polygon is valid', () => {
    // Concave L-shaped zone
    const concaveZone = [
      vec2(0, 0),
      vec2(10, 0),
      vec2(10, 5),
      vec2(5, 5),
      vec2(5, 10),
      vec2(0, 10),
    ];
    // Bounding box of zone is (0,0) to (10,10).
    // Row placed in the notch: (6, 6) to (9, 9)
    // It is inside the bounding box of the zone, but outside the zone polygon itself!
    const rowInNotch = [vec2(6, 6), vec2(9, 6), vec2(9, 9), vec2(6, 9)];

    // They must NOT overlap!
    expect(polygonsOverlap(concaveZone, rowInNotch)).toBe(false);
  });
});
