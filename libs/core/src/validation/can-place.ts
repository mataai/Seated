import type {
  Building,
  Floorplan,
  Row,
  Seat,
  Vec2,
  Zone,
} from '../schema/types';
import {
  buildingFootprint,
  rowFootprint,
  zoneFootprint,
} from '../geometry/footprints';
import { isValidPolygon } from '../geometry/polygon';
import {
  computeBoundingBox,
  polygonContains,
  polygonsOverlap,
} from '../geometry/overlap';
import { GridSpatialIndex } from '../spatial/grid-index';
import type { ValidationOptions, Violation } from './layout';

export interface ProposedTransform {
  position?: Vec2;
  rotation?: number;
  points?: Vec2[];
  side?: 'one' | 'both';
  seatSpacing?: number;
  seatRadius?: number;
  tableWidth?: number;
  seats?: Seat[];
}

export function canPlace(
  floorplan: Floorplan,
  nodeId: string,
  proposedTransform: ProposedTransform,
  opts?: ValidationOptions
): Violation[] {
  const tol = opts?.tolerance ?? 0.01;
  const violations: Violation[] = [];

  const buildings = floorplan.buildings ?? [];

  // Check if nodeId is a building
  const buildingIndex = buildings.findIndex((b) => b.id === nodeId);
  if (buildingIndex >= 0) {
    const original = buildings[buildingIndex];
    const proposed: Building = {
      ...original,
      ...proposedTransform,
      points: proposedTransform.points ?? original.points,
      position: proposedTransform.position ?? original.position,
      rotation: proposedTransform.rotation ?? original.rotation,
    };

    if (!isValidPolygon(proposed.points, tol)) {
      violations.push({ rule: 'invalid-polygon', ids: [nodeId] });
      return violations;
    }

    const proposedPoly = buildingFootprint(proposed);
    const proposedBox = computeBoundingBox(proposedPoly);

    // Spatial index against other buildings
    const spatialIndex = new GridSpatialIndex(150);
    const otherBuildingsMap = new Map<string, Vec2[]>();

    for (const other of buildings) {
      if (other.id === nodeId) continue;
      const poly = buildingFootprint(other);
      otherBuildingsMap.set(other.id, poly);
      spatialIndex.insert(other.id, computeBoundingBox(poly));
    }

    const candidateIds = spatialIndex.query(proposedBox);
    for (const otherId of candidateIds) {
      const otherPoly = otherBuildingsMap.get(otherId)!;
      if (polygonsOverlap(proposedPoly, otherPoly, tol)) {
        violations.push({
          rule: 'building-overlap',
          ids: [nodeId, otherId],
        });
      }
    }

    // Check that existing children are not pushed out of bounds
    for (const z of original.zones ?? []) {
      const zPoly = zoneFootprint(z);
      if (!polygonContains(proposed.points, zPoly, tol)) {
        violations.push({
          rule: 'out-of-bounds',
          ids: [z.id, nodeId],
        });
      }
    }

    for (const r of original.rows ?? []) {
      const rPoly = rowFootprint(r);
      if (!polygonContains(proposed.points, rPoly, tol)) {
        violations.push({
          rule: 'out-of-bounds',
          ids: [r.id, nodeId],
        });
      }
    }

    return violations;
  }

  // Find parent building containing this zone or row
  for (const b of buildings) {
    const zoneIndex = (b.zones ?? []).findIndex((z) => z.id === nodeId);
    if (zoneIndex >= 0) {
      const original = b.zones[zoneIndex];
      const proposed: Zone = {
        ...original,
        ...proposedTransform,
        points: proposedTransform.points ?? original.points,
        position: proposedTransform.position ?? original.position,
        rotation: proposedTransform.rotation ?? original.rotation,
      };

      if (!isValidPolygon(proposed.points, tol)) {
        violations.push({ rule: 'invalid-polygon', ids: [nodeId] });
        return violations;
      }

      const proposedPoly = zoneFootprint(proposed);
      const proposedBox = computeBoundingBox(proposedPoly);

      // Check containment in parent building
      if (!polygonContains(b.points, proposedPoly, tol)) {
        violations.push({
          rule: 'out-of-bounds',
          ids: [nodeId, b.id],
        });
      }

      // Check overlap with sibling zones and rows using spatial index
      const spatialIndex = new GridSpatialIndex(100);
      const siblingPolys = new Map<string, { type: 'zone' | 'row'; poly: Vec2[] }>();

      for (const siblingZ of b.zones) {
        if (siblingZ.id === nodeId) continue;
        const poly = zoneFootprint(siblingZ);
        siblingPolys.set(siblingZ.id, { type: 'zone', poly });
        spatialIndex.insert(siblingZ.id, computeBoundingBox(poly));
      }

      for (const siblingR of b.rows ?? []) {
        const poly = rowFootprint(siblingR);
        siblingPolys.set(siblingR.id, { type: 'row', poly });
        spatialIndex.insert(siblingR.id, computeBoundingBox(poly));
      }

      const candidates = spatialIndex.query(proposedBox);
      for (const candId of candidates) {
        const item = siblingPolys.get(candId)!;
        if (polygonsOverlap(proposedPoly, item.poly, tol)) {
          violations.push({
            rule: item.type === 'zone' ? 'zone-overlap' : 'zone-row-overlap',
            ids: [nodeId, candId],
          });
        }
      }

      return violations;
    }

    const rowIndex = (b.rows ?? []).findIndex((r) => r.id === nodeId);
    if (rowIndex >= 0) {
      const original = b.rows[rowIndex];
      const proposed: Row = {
        ...original,
        ...proposedTransform,
        position: proposedTransform.position ?? original.position,
        rotation: proposedTransform.rotation ?? original.rotation,
        side: proposedTransform.side ?? original.side,
        seatSpacing: proposedTransform.seatSpacing ?? original.seatSpacing,
        seatRadius: proposedTransform.seatRadius ?? original.seatRadius,
        tableWidth: proposedTransform.tableWidth ?? original.tableWidth,
        seats: proposedTransform.seats ?? original.seats,
      };

      // Seat overlap check within the row
      if (proposed.seatSpacing < 2 * proposed.seatRadius - tol) {
        violations.push({
          rule: 'seat-overlap',
          ids: [nodeId],
        });
      }

      const proposedPoly = rowFootprint(proposed);
      const proposedBox = computeBoundingBox(proposedPoly);

      // Check containment in parent building
      if (!polygonContains(b.points, proposedPoly, tol)) {
        violations.push({
          rule: 'out-of-bounds',
          ids: [nodeId, b.id],
        });
      }

      // Check overlap with sibling rows and zones using spatial index
      const spatialIndex = new GridSpatialIndex(100);
      const siblingPolys = new Map<string, { type: 'zone' | 'row'; poly: Vec2[] }>();

      for (const siblingR of b.rows) {
        if (siblingR.id === nodeId) continue;
        const poly = rowFootprint(siblingR);
        siblingPolys.set(siblingR.id, { type: 'row', poly });
        spatialIndex.insert(siblingR.id, computeBoundingBox(poly));
      }

      for (const siblingZ of b.zones ?? []) {
        const poly = zoneFootprint(siblingZ);
        siblingPolys.set(siblingZ.id, { type: 'zone', poly });
        spatialIndex.insert(siblingZ.id, computeBoundingBox(poly));
      }

      const candidates = spatialIndex.query(proposedBox);
      for (const candId of candidates) {
        const item = siblingPolys.get(candId)!;
        if (polygonsOverlap(proposedPoly, item.poly, tol)) {
          violations.push({
            rule: item.type === 'row' ? 'row-overlap' : 'zone-row-overlap',
            ids: [nodeId, candId],
          });
        }
      }

      return violations;
    }
  }

  // Node not found in floorplan
  return violations;
}
