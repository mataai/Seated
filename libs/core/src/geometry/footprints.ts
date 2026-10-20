import type { Building, Row, Seat, Vec2, Zone } from '../schema/types';
import { transformPoint } from './vec2';

/**
 * Calculates the local coordinate of a seat relative to its row.
 * The row axis is along the X-axis (through table body center).
 * Seat position along the axis: index * seatSpacing.
 * Across the axis:
 *  - side 'a': -(tableWidth / 2 + seatRadius)
 *  - side 'b': +(tableWidth / 2 + seatRadius)
 */
export function seatPosition(row: Row, seat: Seat): Vec2 {
  const x = seat.index * row.seatSpacing;
  const offset = row.tableWidth / 2 + row.seatRadius;
  const y = seat.side === 'b' ? offset : -offset;
  return { x, y };
}

/**
 * Calculates the position of a seat in its building's coordinate space.
 */
export function seatBuildingPosition(row: Row, seat: Seat): Vec2 {
  const localPos = seatPosition(row, seat);
  return transformPoint(localPos, row.position, row.rotation);
}

/**
 * Calculates the position of a seat in world (floorplan) space.
 */
export function seatWorldPosition(
  row: Row,
  seat: Seat,
  building?: Building
): Vec2 {
  const bPos = seatBuildingPosition(row, seat);
  if (!building) return bPos;
  return transformPoint(bPos, building.position, building.rotation);
}

/**
 * Computes the 4 corners of the row's bounding footprint polygon.
 * Rotated rectangle covering table body plus all seats.
 * Returned in building space (or world space if parentBuilding is provided).
 */
export function rowFootprint(row: Row, parentBuilding?: Building): Vec2[] {
  let maxIndex = 0;
  if (row.seats && row.seats.length > 0) {
    for (const seat of row.seats) {
      if (seat.index > maxIndex) {
        maxIndex = seat.index;
      }
    }
  }

  const minX = -row.seatRadius;
  const maxX = maxIndex * row.seatSpacing + row.seatRadius;

  let minY: number;
  let maxY: number;

  if (row.side === 'both') {
    minY = -(row.tableWidth / 2 + 2 * row.seatRadius);
    maxY = +(row.tableWidth / 2 + 2 * row.seatRadius);
  } else {
    // One-sided: seats are only on side 'a' (negative y)
    minY = -(row.tableWidth / 2 + 2 * row.seatRadius);
    maxY = +(row.tableWidth / 2);
  }

  const localCorners: Vec2[] = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];

  const inBuilding = localCorners.map((pt) =>
    transformPoint(pt, row.position, row.rotation)
  );

  if (!parentBuilding) {
    return inBuilding;
  }

  return inBuilding.map((pt) =>
    transformPoint(pt, parentBuilding.position, parentBuilding.rotation)
  );
}

/**
 * Computes the footprint polygon of a building in world space.
 */
export function buildingFootprint(building: Building): Vec2[] {
  return building.points.map((pt) =>
    transformPoint(pt, building.position, building.rotation)
  );
}

/**
 * Computes the footprint polygon of a zone.
 * Returned in building space by default, or in world space if parentBuilding is provided.
 */
export function zoneFootprint(zone: Zone, parentBuilding?: Building): Vec2[] {
  const inBuilding = zone.points.map((pt) =>
    transformPoint(pt, zone.position, zone.rotation)
  );

  if (!parentBuilding) {
    return inBuilding;
  }

  return inBuilding.map((pt) =>
    transformPoint(pt, parentBuilding.position, parentBuilding.rotation)
  );
}
