import type { Building, Floorplan, Vec2 } from '../schema/types';
import {
  buildingFootprint,
  rowFootprint,
  zoneFootprint,
} from '../geometry/footprints';
import { isValidPolygon } from '../geometry/polygon';
import {
  type BoundingBox,
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

/**
 * Validates that all building polygons are geometrically valid and do not overlap one another.
 */
function validateBuildings(
  buildings: Building[],
  tol: number,
  violations: Violation[]
): {
  footprints: Map<string, Vec2[]>;
  boxes: Map<string, BoundingBox>;
} {
  const footprints = new Map<string, Vec2[]>();
  const boxes = new Map<string, BoundingBox>();

  for (const building of buildings) {
    if (!isValidPolygon(building.points, tol)) {
      violations.push({
        rule: 'invalid-polygon',
        ids: [building.id],
      });
    }
    const poly = buildingFootprint(building);
    footprints.set(building.id, poly);
    boxes.set(building.id, computeBoundingBox(poly));
  }

  // Cross-building overlap checks
  for (let i = 0; i < buildings.length; i++) {
    const b1 = buildings[i];
    const poly1 = footprints.get(b1.id);
    const box1 = boxes.get(b1.id);
    if (!poly1 || !box1) continue;

    for (let j = i + 1; j < buildings.length; j++) {
      const b2 = buildings[j];
      const poly2 = footprints.get(b2.id);
      const box2 = boxes.get(b2.id);
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

  return { footprints, boxes };
}

/**
 * Validates intra-building constraints: containment of zones/rows, internal overlaps, and seat spacing.
 */
function validateBuildingInternals(
  building: Building,
  tol: number,
  violations: Violation[]
): void {
  const zones = building.zones ?? [];
  const rows = building.rows ?? [];

  const zoneFootprints = new Map<string, Vec2[]>();
  const zoneBoxes = new Map<string, BoundingBox>();
  const rowFootprints = new Map<string, Vec2[]>();
  const rowBoxes = new Map<string, BoundingBox>();

  // 1. Validate zones
  for (const zone of zones) {
    if (!isValidPolygon(zone.points, tol)) {
      violations.push({
        rule: 'invalid-polygon',
        ids: [zone.id],
      });
    }
    const poly = zoneFootprint(zone);
    zoneFootprints.set(zone.id, poly);
    zoneBoxes.set(zone.id, computeBoundingBox(poly));
  }

  // 2. Validate rows and populate spatial index if row count warrants it
  const rowSpatialIndex = rows.length > 8 ? new GridSpatialIndex(150) : null;

  for (const row of rows) {
    if (row.seatSpacing < 2 * row.seatRadius - tol) {
      violations.push({
        rule: 'seat-overlap',
        ids: [row.id],
      });
    }
    const poly = rowFootprint(row);
    const box = computeBoundingBox(poly);
    rowFootprints.set(row.id, poly);
    rowBoxes.set(row.id, box);
    rowSpatialIndex?.insert(row.id, box);
  }

  // 3. Containment within building perimeter
  const buildingPoints = building.points;
  const buildingBox = computeBoundingBox(buildingPoints);

  for (const zone of zones) {
    const poly = zoneFootprints.get(zone.id);
    const box = zoneBoxes.get(zone.id);
    if (!poly || !box) continue;

    if (!polygonContains(buildingPoints, poly, tol, buildingBox, box)) {
      violations.push({
        rule: 'out-of-bounds',
        ids: [zone.id, building.id],
      });
    }
  }

  for (const row of rows) {
    const poly = rowFootprints.get(row.id);
    const box = rowBoxes.get(row.id);
    if (!poly || !box) continue;

    if (!polygonContains(buildingPoints, poly, tol, buildingBox, box)) {
      violations.push({
        rule: 'out-of-bounds',
        ids: [row.id, building.id],
      });
    }
  }

  // 4. Zone vs Zone overlap
  for (let i = 0; i < zones.length; i++) {
    const z1 = zones[i];
    const poly1 = zoneFootprints.get(z1.id);
    const box1 = zoneBoxes.get(z1.id);
    if (!poly1 || !box1) continue;

    for (let j = i + 1; j < zones.length; j++) {
      const z2 = zones[j];
      const poly2 = zoneFootprints.get(z2.id);
      const box2 = zoneBoxes.get(z2.id);
      if (!poly2 || !box2) continue;

      if (
        boundingBoxesOverlap(box1, box2, tol) &&
        polygonsOverlap(poly1, poly2, tol, box1, box2)
      ) {
        violations.push({
          rule: 'zone-overlap',
          ids: [z1.id, z2.id],
        });
      }
    }
  }

  // 5. Row vs Row overlap (using spatial index when available)
  if (rowSpatialIndex) {
    const checkedPairs = new Set<string>();
    for (const r1 of rows) {
      const poly1 = rowFootprints.get(r1.id);
      const box1 = rowBoxes.get(r1.id);
      if (!poly1 || !box1) continue;

      const candidates = rowSpatialIndex.query(box1);
      for (const candId of candidates) {
        if (candId <= r1.id) continue;
        const pairKey = `${r1.id}:${candId}`;
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        const poly2 = rowFootprints.get(candId);
        const box2 = rowBoxes.get(candId);
        if (!poly2 || !box2) continue;

        if (
          boundingBoxesOverlap(box1, box2, tol) &&
          polygonsOverlap(poly1, poly2, tol, box1, box2)
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
      const poly1 = rowFootprints.get(r1.id);
      const box1 = rowBoxes.get(r1.id);
      if (!poly1 || !box1) continue;

      for (let j = i + 1; j < rows.length; j++) {
        const r2 = rows[j];
        const poly2 = rowFootprints.get(r2.id);
        const box2 = rowBoxes.get(r2.id);
        if (!poly2 || !box2) continue;

        if (
          boundingBoxesOverlap(box1, box2, tol) &&
          polygonsOverlap(poly1, poly2, tol, box1, box2)
        ) {
          violations.push({
            rule: 'row-overlap',
            ids: [r1.id, r2.id],
          });
        }
      }
    }
  }

  // 6. Zone vs Row overlap
  for (const zone of zones) {
    const zPoly = zoneFootprints.get(zone.id);
    const zBox = zoneBoxes.get(zone.id);
    if (!zPoly || !zBox) continue;

    const candidateRowIds = rowSpatialIndex
      ? rowSpatialIndex.query(zBox)
      : rows.map((r) => r.id);

    for (const rowId of candidateRowIds) {
      const rPoly = rowFootprints.get(rowId);
      const rBox = rowBoxes.get(rowId);
      if (!rPoly || !rBox) continue;

      if (
        boundingBoxesOverlap(zBox, rBox, tol) &&
        polygonsOverlap(zPoly, rPoly, tol, zBox, rBox)
      ) {
        violations.push({
          rule: 'zone-row-overlap',
          ids: [zone.id, rowId],
        });
      }
    }
  }
}

/**
 * Validates the complete floorplan against geometric and topological layout rules:
 * - Valid non-self-intersecting polygons
 * - Non-overlapping buildings
 * - Zones and rows contained within parent buildings
 * - Non-overlapping zones and rows within each building
 * - Sufficient seat spacing along each row
 */
export function validateLayout(
  floorplan: Floorplan,
  opts?: ValidationOptions
): Violation[] {
  const tol = opts?.tolerance ?? 0.01;
  const violations: Violation[] = [];
  const buildings = floorplan.buildings ?? [];

  // 1. Inter-building validation
  validateBuildings(buildings, tol, violations);

  // 2. Intra-building validation
  for (const building of buildings) {
    validateBuildingInternals(building, tol, violations);
  }

  return violations;
}
