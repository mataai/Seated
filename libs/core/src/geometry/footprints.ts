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
  const halfTable = row.tableWidth / 2;
  const twoRadius = 2 * row.seatRadius;

  const minY = -(halfTable + twoRadius);
  const maxY = row.side === 'both' ? halfTable + twoRadius : halfTable;

  const rx = row.position.x;
  const ry = row.position.y;
  const rot = row.rotation;

  let p0x: number, p0y: number;
  let p1x: number, p1y: number;
  let p2x: number, p2y: number;
  let p3x: number, p3y: number;

  if (rot === 0) {
    p0x = minX + rx;
    p0y = minY + ry;
    p1x = maxX + rx;
    p1y = minY + ry;
    p2x = maxX + rx;
    p2y = maxY + ry;
    p3x = minX + rx;
    p3y = maxY + ry;
  } else {
    const rad = (rot * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    p0x = rx + minX * cos - minY * sin;
    p0y = ry + minX * sin + minY * cos;
    p1x = rx + maxX * cos - minY * sin;
    p1y = ry + maxX * sin + minY * cos;
    p2x = rx + maxX * cos - maxY * sin;
    p2y = ry + maxX * sin + maxY * cos;
    p3x = rx + minX * cos - maxY * sin;
    p3y = ry + minX * sin + maxY * cos;
  }

  if (!parentBuilding) {
    return [
      { x: p0x, y: p0y },
      { x: p1x, y: p1y },
      { x: p2x, y: p2y },
      { x: p3x, y: p3y },
    ];
  }

  const bx = parentBuilding.position.x;
  const by = parentBuilding.position.y;
  const brot = parentBuilding.rotation;

  if (brot === 0) {
    return [
      { x: p0x + bx, y: p0y + by },
      { x: p1x + bx, y: p1y + by },
      { x: p2x + bx, y: p2y + by },
      { x: p3x + bx, y: p3y + by },
    ];
  }

  const brad = (brot * Math.PI) / 180;
  const bcos = Math.cos(brad);
  const bsin = Math.sin(brad);
  return [
    { x: bx + p0x * bcos - p0y * bsin, y: by + p0x * bsin + p0y * bcos },
    { x: bx + p1x * bcos - p1y * bsin, y: by + p1x * bsin + p1y * bcos },
    { x: bx + p2x * bcos - p2y * bsin, y: by + p2x * bsin + p2y * bcos },
    { x: bx + p3x * bcos - p3y * bsin, y: by + p3x * bsin + p3y * bcos },
  ];
}

/**
 * Computes the footprint polygon of a building in world space.
 */
export function buildingFootprint(building: Building): Vec2[] {
  const bx = building.position.x;
  const by = building.position.y;
  const rot = building.rotation;
  const pts = building.points;
  const n = pts.length;
  const result: Vec2[] = new Array(n);

  if (rot === 0) {
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      result[i] = { x: bx + p.x, y: by + p.y };
    }
    return result;
  }

  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    result[i] = {
      x: bx + p.x * cos - p.y * sin,
      y: by + p.x * sin + p.y * cos,
    };
  }
  return result;
}

/**
 * Computes the footprint polygon of a zone.
 * Returned in building space by default, or in world space if parentBuilding is provided.
 */
export function zoneFootprint(zone: Zone, parentBuilding?: Building): Vec2[] {
  const zx = zone.position.x;
  const zy = zone.position.y;
  const zrot = zone.rotation;
  const pts = zone.points;
  const n = pts.length;
  const inBuilding: Vec2[] = new Array(n);

  if (zrot === 0) {
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      inBuilding[i] = { x: zx + p.x, y: zy + p.y };
    }
  } else {
    const zrad = (zrot * Math.PI) / 180;
    const zcos = Math.cos(zrad);
    const zsin = Math.sin(zrad);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      inBuilding[i] = {
        x: zx + p.x * zcos - p.y * zsin,
        y: zy + p.x * zsin + p.y * zcos,
      };
    }
  }

  if (!parentBuilding) {
    return inBuilding;
  }

  const bx = parentBuilding.position.x;
  const by = parentBuilding.position.y;
  const brot = parentBuilding.rotation;

  if (brot === 0) {
    for (let i = 0; i < n; i++) {
      const p = inBuilding[i];
      inBuilding[i] = { x: bx + p.x, y: by + p.y };
    }
    return inBuilding;
  }

  const brad = (brot * Math.PI) / 180;
  const bcos = Math.cos(brad);
  const bsin = Math.sin(brad);
  for (let i = 0; i < n; i++) {
    const p = inBuilding[i];
    inBuilding[i] = {
      x: bx + p.x * bcos - p.y * bsin,
      y: by + p.x * bsin + p.y * bcos,
    };
  }
  return inBuilding;
}
