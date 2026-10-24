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
import type { BoundingBox } from '../geometry/overlap';
import {
  boundingBoxesOverlap,
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

interface SiblingFootprintItem {
  type: 'zone' | 'row';
  poly: Vec2[];
  box: BoundingBox;
}

/**
 * Validates a proposed transformation of an existing building.
 */
function validateProposedBuilding(
  original: Building,
  proposedTransform: ProposedTransform,
  allBuildings: Building[],
  tol: number
): Violation[] {
  const violations: Violation[] = [];
  const proposed: Building = {
    ...original,
    ...proposedTransform,
    points: proposedTransform.points ?? original.points,
    position: proposedTransform.position ?? original.position,
    rotation: proposedTransform.rotation ?? original.rotation,
  };

  if (!isValidPolygon(proposed.points, tol)) {
    violations.push({ rule: 'invalid-polygon', ids: [original.id] });
    return violations;
  }

  const proposedPoly = buildingFootprint(proposed);
  const proposedBox = computeBoundingBox(proposedPoly);

  // Broadphase spatial index against other buildings
  const spatialIndex = new GridSpatialIndex(150);
  const otherBuildingsMap = new Map<
    string,
    { poly: Vec2[]; box: BoundingBox }
  >();

  for (const other of allBuildings) {
    if (other.id === original.id) continue;
    const poly = buildingFootprint(other);
    const box = computeBoundingBox(poly);
    otherBuildingsMap.set(other.id, { poly, box });
    spatialIndex.insert(other.id, box);
  }

  const candidateIds = spatialIndex.query(proposedBox);
  for (const otherId of candidateIds) {
    const otherItem = otherBuildingsMap.get(otherId);
    if (!otherItem) continue;

    if (
      boundingBoxesOverlap(proposedBox, otherItem.box, tol) &&
      polygonsOverlap(
        proposedPoly,
        otherItem.poly,
        tol,
        proposedBox,
        otherItem.box
      )
    ) {
      violations.push({
        rule: 'building-overlap',
        ids: [original.id, otherId],
      });
    }
  }

  // Ensure children zones and rows remain within the new building boundary
  const proposedBuildingBox = computeBoundingBox(proposed.points);
  for (const zone of original.zones ?? []) {
    const zPoly = zoneFootprint(zone);
    if (!polygonContains(proposed.points, zPoly, tol, proposedBuildingBox)) {
      violations.push({
        rule: 'out-of-bounds',
        ids: [zone.id, original.id],
      });
    }
  }

  for (const row of original.rows ?? []) {
    const rPoly = rowFootprint(row);
    if (!polygonContains(proposed.points, rPoly, tol, proposedBuildingBox)) {
      violations.push({
        rule: 'out-of-bounds',
        ids: [row.id, original.id],
      });
    }
  }

  return violations;
}

/**
 * Validates a proposed transformation of an existing zone.
 */
function validateProposedZone(
  original: Zone,
  proposedTransform: ProposedTransform,
  parentBuilding: Building,
  tol: number
): Violation[] {
  const violations: Violation[] = [];
  const proposed: Zone = {
    ...original,
    ...proposedTransform,
    points: proposedTransform.points ?? original.points,
    position: proposedTransform.position ?? original.position,
    rotation: proposedTransform.rotation ?? original.rotation,
  };

  if (!isValidPolygon(proposed.points, tol)) {
    violations.push({ rule: 'invalid-polygon', ids: [original.id] });
    return violations;
  }

  const proposedPoly = zoneFootprint(proposed);
  const proposedBox = computeBoundingBox(proposedPoly);
  const parentBox = computeBoundingBox(parentBuilding.points);

  // Check containment within parent building
  if (
    !polygonContains(
      parentBuilding.points,
      proposedPoly,
      tol,
      parentBox,
      proposedBox
    )
  ) {
    violations.push({
      rule: 'out-of-bounds',
      ids: [original.id, parentBuilding.id],
    });
  }

  // Check overlap with sibling zones and rows using spatial indexing
  const spatialIndex = new GridSpatialIndex(100);
  const siblingItems = new Map<string, SiblingFootprintItem>();

  for (const siblingZone of parentBuilding.zones ?? []) {
    if (siblingZone.id === original.id) continue;
    const poly = zoneFootprint(siblingZone);
    const box = computeBoundingBox(poly);
    siblingItems.set(siblingZone.id, { type: 'zone', poly, box });
    spatialIndex.insert(siblingZone.id, box);
  }

  for (const siblingRow of parentBuilding.rows ?? []) {
    const poly = rowFootprint(siblingRow);
    const box = computeBoundingBox(poly);
    siblingItems.set(siblingRow.id, { type: 'row', poly, box });
    spatialIndex.insert(siblingRow.id, box);
  }

  const candidateIds = spatialIndex.query(proposedBox);
  for (const candId of candidateIds) {
    const item = siblingItems.get(candId);
    if (!item) continue;

    if (
      boundingBoxesOverlap(proposedBox, item.box, tol) &&
      polygonsOverlap(proposedPoly, item.poly, tol, proposedBox, item.box)
    ) {
      violations.push({
        rule: item.type === 'zone' ? 'zone-overlap' : 'zone-row-overlap',
        ids: [original.id, candId],
      });
    }
  }

  return violations;
}

/**
 * Validates a proposed transformation of an existing row.
 */
function validateProposedRow(
  original: Row,
  proposedTransform: ProposedTransform,
  parentBuilding: Building,
  tol: number
): Violation[] {
  const violations: Violation[] = [];
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

  // Seat spacing must accommodate twice the radius
  if (proposed.seatSpacing < 2 * proposed.seatRadius - tol) {
    violations.push({
      rule: 'seat-overlap',
      ids: [original.id],
    });
  }

  const proposedPoly = rowFootprint(proposed);
  const proposedBox = computeBoundingBox(proposedPoly);
  const parentBox = computeBoundingBox(parentBuilding.points);

  // Check containment within parent building
  if (
    !polygonContains(
      parentBuilding.points,
      proposedPoly,
      tol,
      parentBox,
      proposedBox
    )
  ) {
    violations.push({
      rule: 'out-of-bounds',
      ids: [original.id, parentBuilding.id],
    });
  }

  // Check overlap with sibling rows and zones using spatial indexing
  const spatialIndex = new GridSpatialIndex(100);
  const siblingItems = new Map<string, SiblingFootprintItem>();

  for (const siblingRow of parentBuilding.rows ?? []) {
    if (siblingRow.id === original.id) continue;
    const poly = rowFootprint(siblingRow);
    const box = computeBoundingBox(poly);
    siblingItems.set(siblingRow.id, { type: 'row', poly, box });
    spatialIndex.insert(siblingRow.id, box);
  }

  for (const siblingZone of parentBuilding.zones ?? []) {
    const poly = zoneFootprint(siblingZone);
    const box = computeBoundingBox(poly);
    siblingItems.set(siblingZone.id, { type: 'zone', poly, box });
    spatialIndex.insert(siblingZone.id, box);
  }

  const candidateIds = spatialIndex.query(proposedBox);
  for (const candId of candidateIds) {
    const item = siblingItems.get(candId);
    if (!item) continue;

    if (
      boundingBoxesOverlap(proposedBox, item.box, tol) &&
      polygonsOverlap(proposedPoly, item.poly, tol, proposedBox, item.box)
    ) {
      violations.push({
        rule: item.type === 'row' ? 'row-overlap' : 'zone-row-overlap',
        ids: [original.id, candId],
      });
    }
  }

  return violations;
}

/**
 * Validates whether a proposed transformation of an existing node in the floorplan
 * is valid and does not cause overlaps or out-of-bounds violations.
 */
export function canPlace(
  floorplan: Floorplan,
  nodeId: string,
  proposedTransform: ProposedTransform,
  opts?: ValidationOptions
): Violation[] {
  const tol = opts?.tolerance ?? 0.01;
  const buildings = floorplan.buildings ?? [];

  // 1. Check if nodeId is a building
  const targetBuilding = buildings.find((b) => b.id === nodeId);
  if (targetBuilding) {
    return validateProposedBuilding(
      targetBuilding,
      proposedTransform,
      buildings,
      tol
    );
  }

  // 2. Find parent building containing this zone or row
  for (const building of buildings) {
    const zone = (building.zones ?? []).find((z) => z.id === nodeId);
    if (zone) {
      return validateProposedZone(zone, proposedTransform, building, tol);
    }

    const row = (building.rows ?? []).find((r) => r.id === nodeId);
    if (row) {
      return validateProposedRow(row, proposedTransform, building, tol);
    }
  }

  return [];
}
