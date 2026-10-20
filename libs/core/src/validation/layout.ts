import type { Floorplan } from '../schema/types';
import {
  buildingFootprint,
  rowFootprint,
  zoneFootprint,
} from '../geometry/footprints';
import { isValidPolygon } from '../geometry/polygon';
import { polygonContains, polygonsOverlap } from '../geometry/overlap';

export interface Violation {
  rule:
    | 'building-overlap'
    | 'zone-overlap'
    | 'row-overlap'
    | 'zone-row-overlap'
    | 'seat-overlap'
    | 'out-of-bounds'
    | 'invalid-polygon';
  ids: string[];
}

export interface ValidationOptions {
  tolerance?: number;
}

export function validateLayout(
  floorplan: Floorplan,
  opts?: ValidationOptions
): Violation[] {
  const tol = opts?.tolerance ?? 0.01;
  const violations: Violation[] = [];

  const buildings = floorplan.buildings ?? [];

  // 1. Validate building polygons & overlap
  const bFootprints = new Map<string, ReturnType<typeof buildingFootprint>>();

  for (const b of buildings) {
    if (!isValidPolygon(b.points, tol)) {
      violations.push({
        rule: 'invalid-polygon',
        ids: [b.id],
      });
    }
    bFootprints.set(b.id, buildingFootprint(b));
  }

  // Cross-building checks: buildings must not overlap
  for (let i = 0; i < buildings.length; i++) {
    const b1 = buildings[i];
    const poly1 = bFootprints.get(b1.id);
    if (!poly1) continue;

    for (let j = i + 1; j < buildings.length; j++) {
      const b2 = buildings[j];
      const poly2 = bFootprints.get(b2.id);
      if (!poly2) continue;

      if (polygonsOverlap(poly1, poly2, tol)) {
        violations.push({
          rule: 'building-overlap',
          ids: [b1.id, b2.id],
        });
      }
    }
  }

  // 2. Intra-building validation (zones, rows, containment, seat-overlap)
  for (const b of buildings) {
    const zones = b.zones ?? [];
    const rows = b.rows ?? [];

    const zFootprints = new Map<string, ReturnType<typeof zoneFootprint>>();
    const rFootprints = new Map<string, ReturnType<typeof rowFootprint>>();

    // Validate zone polygons
    for (const z of zones) {
      if (!isValidPolygon(z.points, tol)) {
        violations.push({
          rule: 'invalid-polygon',
          ids: [z.id],
        });
      }
      zFootprints.set(z.id, zoneFootprint(z));
    }

    // Validate row seat spacing & footprints
    for (const r of rows) {
      if (r.seatSpacing < 2 * r.seatRadius - tol) {
        violations.push({
          rule: 'seat-overlap',
          ids: [r.id],
        });
      }
      rFootprints.set(r.id, rowFootprint(r));
    }

    // Containment within building
    for (const z of zones) {
      const zPoly = zFootprints.get(z.id);
      if (!zPoly) continue;
      if (!polygonContains(b.points, zPoly, tol)) {
        violations.push({
          rule: 'out-of-bounds',
          ids: [z.id, b.id],
        });
      }
    }

    for (const r of rows) {
      const rPoly = rFootprints.get(r.id);
      if (!rPoly) continue;
      if (!polygonContains(b.points, rPoly, tol)) {
        violations.push({
          rule: 'out-of-bounds',
          ids: [r.id, b.id],
        });
      }
    }

    // Zone vs Zone overlap
    for (let i = 0; i < zones.length; i++) {
      const z1 = zones[i];
      const p1 = zFootprints.get(z1.id);
      if (!p1) continue;

      for (let j = i + 1; j < zones.length; j++) {
        const z2 = zones[j];
        const p2 = zFootprints.get(z2.id);
        if (!p2) continue;

        if (polygonsOverlap(p1, p2, tol)) {
          violations.push({
            rule: 'zone-overlap',
            ids: [z1.id, z2.id],
          });
        }
      }
    }

    // Row vs Row overlap
    for (let i = 0; i < rows.length; i++) {
      const r1 = rows[i];
      const p1 = rFootprints.get(r1.id);
      if (!p1) continue;

      for (let j = i + 1; j < rows.length; j++) {
        const r2 = rows[j];
        const p2 = rFootprints.get(r2.id);
        if (!p2) continue;

        if (polygonsOverlap(p1, p2, tol)) {
          violations.push({
            rule: 'row-overlap',
            ids: [r1.id, r2.id],
          });
        }
      }
    }

    // Zone vs Row overlap
    for (const z of zones) {
      const zPoly = zFootprints.get(z.id);
      if (!zPoly) continue;

      for (const r of rows) {
        const rPoly = rFootprints.get(r.id);
        if (!rPoly) continue;

        if (polygonsOverlap(zPoly, rPoly, tol)) {
          violations.push({
            rule: 'zone-row-overlap',
            ids: [z.id, r.id],
          });
        }
      }
    }
  }

  return violations;
}
