import type { Floorplan } from '../schema/types';
import {
  buildingFootprint,
  rowFootprint,
  zoneFootprint,
} from '../geometry/footprints';
import { isValidPolygon } from '../geometry/polygon';
import {
  BoundingBox,
  boundingBoxesOverlap,
  computeBoundingBox,
  polygonContains,
  polygonsOverlap,
} from '../geometry/overlap';
import { GridSpatialIndex } from '../spatial/grid-index';

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
  const bBoxes = new Map<string, BoundingBox>();

  for (const b of buildings) {
    if (!isValidPolygon(b.points, tol)) {
      violations.push({
        rule: 'invalid-polygon',
        ids: [b.id],
      });
    }
    const poly = buildingFootprint(b);
    bFootprints.set(b.id, poly);
    bBoxes.set(b.id, computeBoundingBox(poly));
  }

  // Cross-building checks: buildings must not overlap
  for (let i = 0; i < buildings.length; i++) {
    const b1 = buildings[i];
    const poly1 = bFootprints.get(b1.id);
    const box1 = bBoxes.get(b1.id);
    if (!poly1 || !box1) continue;

    for (let j = i + 1; j < buildings.length; j++) {
      const b2 = buildings[j];
      const poly2 = bFootprints.get(b2.id);
      const box2 = bBoxes.get(b2.id);
      if (!poly2 || !box2) continue;

      if (
        boundingBoxesOverlap(box1, box2, tol) &&
        polygonsOverlap(poly1, poly2, tol, box1, box2)
      ) {
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
    const zBoxes = new Map<string, BoundingBox>();
    const rFootprints = new Map<string, ReturnType<typeof rowFootprint>>();
    const rBoxes = new Map<string, BoundingBox>();

    // Validate zone polygons
    for (const z of zones) {
      if (!isValidPolygon(z.points, tol)) {
        violations.push({
          rule: 'invalid-polygon',
          ids: [z.id],
        });
      }
      const poly = zoneFootprint(z);
      zFootprints.set(z.id, poly);
      zBoxes.set(z.id, computeBoundingBox(poly));
    }

    // Spatial indexing for rows if substantial count
    const rowSpatialIndex = rows.length > 8 ? new GridSpatialIndex(150) : null;

    // Validate row seat spacing & footprints
    for (const r of rows) {
      if (r.seatSpacing < 2 * r.seatRadius - tol) {
        violations.push({
          rule: 'seat-overlap',
          ids: [r.id],
        });
      }
      const poly = rowFootprint(r);
      const box = computeBoundingBox(poly);
      rFootprints.set(r.id, poly);
      rBoxes.set(r.id, box);
      rowSpatialIndex?.insert(r.id, box);
    }

    // Containment within building
    const bPoly = b.points;
    const bPolyBox = computeBoundingBox(bPoly);

    for (const z of zones) {
      const zPoly = zFootprints.get(z.id);
      const zBox = zBoxes.get(z.id);
      if (!zPoly || !zBox) continue;
      if (!polygonContains(bPoly, zPoly, tol, bPolyBox, zBox)) {
        violations.push({
          rule: 'out-of-bounds',
          ids: [z.id, b.id],
        });
      }
    }

    for (const r of rows) {
      const rPoly = rFootprints.get(r.id);
      const rBox = rBoxes.get(r.id);
      if (!rPoly || !rBox) continue;
      if (!polygonContains(bPoly, rPoly, tol, bPolyBox, rBox)) {
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
      const b1 = zBoxes.get(z1.id);
      if (!p1 || !b1) continue;

      for (let j = i + 1; j < zones.length; j++) {
        const z2 = zones[j];
        const p2 = zFootprints.get(z2.id);
        const b2 = zBoxes.get(z2.id);
        if (!p2 || !b2) continue;

        if (
          boundingBoxesOverlap(b1, b2, tol) &&
          polygonsOverlap(p1, p2, tol, b1, b2)
        ) {
          violations.push({
            rule: 'zone-overlap',
            ids: [z1.id, z2.id],
          });
        }
      }
    }

    // Row vs Row overlap
    if (rowSpatialIndex) {
      const checkedPairs = new Set<string>();
      for (const r1 of rows) {
        const p1 = rFootprints.get(r1.id);
        const b1 = rBoxes.get(r1.id);
        if (!p1 || !b1) continue;

        const candidates = rowSpatialIndex.query(b1);
        for (const candId of candidates) {
          if (candId <= r1.id) continue;
          const pairKey = `${r1.id}:${candId}`;
          if (checkedPairs.has(pairKey)) continue;
          checkedPairs.add(pairKey);

          const p2 = rFootprints.get(candId);
          const b2 = rBoxes.get(candId);
          if (!p2 || !b2) continue;

          if (
            boundingBoxesOverlap(b1, b2, tol) &&
            polygonsOverlap(p1, p2, tol, b1, b2)
          ) {
            violations.push({
              rule: 'row-overlap',
              ids: [r1.id, candId],
            });
          }
        }
      }
    } else {
      for (let i = 0; i < rows.length; i++) {
        const r1 = rows[i];
        const p1 = rFootprints.get(r1.id);
        const b1 = rBoxes.get(r1.id);
        if (!p1 || !b1) continue;

        for (let j = i + 1; j < rows.length; j++) {
          const r2 = rows[j];
          const p2 = rFootprints.get(r2.id);
          const b2 = rBoxes.get(r2.id);
          if (!p2 || !b2) continue;

          if (
            boundingBoxesOverlap(b1, b2, tol) &&
            polygonsOverlap(p1, p2, tol, b1, b2)
          ) {
            violations.push({
              rule: 'row-overlap',
              ids: [r1.id, r2.id],
            });
          }
        }
      }
    }

    // Zone vs Row overlap
    for (const z of zones) {
      const zPoly = zFootprints.get(z.id);
      const zBox = zBoxes.get(z.id);
      if (!zPoly || !zBox) continue;

      if (rowSpatialIndex) {
        const candidates = rowSpatialIndex.query(zBox);
        for (const candId of candidates) {
          const rPoly = rFootprints.get(candId);
          const rBox = rBoxes.get(candId);
          if (!rPoly || !rBox) continue;

          if (
            boundingBoxesOverlap(zBox, rBox, tol) &&
            polygonsOverlap(zPoly, rPoly, tol, zBox, rBox)
          ) {
            violations.push({
              rule: 'zone-row-overlap',
              ids: [z.id, candId],
            });
          }
        }
      } else {
        for (const r of rows) {
          const rPoly = rFootprints.get(r.id);
          const rBox = rBoxes.get(r.id);
          if (!rPoly || !rBox) continue;

          if (
            boundingBoxesOverlap(zBox, rBox, tol) &&
            polygonsOverlap(zPoly, rPoly, tol, zBox, rBox)
          ) {
            violations.push({
              rule: 'zone-row-overlap',
              ids: [z.id, r.id],
            });
          }
        }
      }
    }
  }

  return violations;
}
