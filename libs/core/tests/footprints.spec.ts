import { describe, expect, it } from 'vitest';
import { rowFootprint, seatPosition, type Row, type Seat } from '../src';

describe('Footprints & Seat Positions', () => {
  const seatA: Seat = { id: 's-1', index: 0, side: 'a', label: '1A' };
  const seatB: Seat = { id: 's-2', index: 0, side: 'b', label: '1B' };

  it('calculates seat position along and across row axis', () => {
    const row: Row = {
      id: 'r-1',
      label: 'Row 1',
      position: { x: 0, y: 0 },
      rotation: 0,
      side: 'both',
      seatSpacing: 50,
      seatRadius: 10,
      tableWidth: 40,
      seats: [seatA, seatB],
    };

    // tableWidth = 40, seatRadius = 10 -> offset = 40/2 + 10 = 30
    const posA = seatPosition(row, seatA);
    expect(posA.x).toBe(0);
    expect(posA.y).toBe(-30);

    const posB = seatPosition(row, seatB);
    expect(posB.x).toBe(0);
    expect(posB.y).toBe(30);

    // At index 2:
    const seatIndex2: Seat = { id: 's-3', index: 2, side: 'a', label: '3A' };
    const posIndex2 = seatPosition(row, seatIndex2);
    expect(posIndex2.x).toBe(100);
    expect(posIndex2.y).toBe(-30);
  });

  it('computes one-sided vs two-sided footprints correctly', () => {
    // Both sides: width = tableWidth + 4*r = 40 + 40 = 80 (from -40 to +40)
    const rowBoth: Row = {
      id: 'r-both',
      label: 'Row Both',
      position: { x: 100, y: 100 },
      rotation: 0,
      side: 'both',
      seatSpacing: 50,
      seatRadius: 10,
      tableWidth: 40,
      seats: [
        { id: 's-1', index: 0, side: 'a', label: '1A' },
        { id: 's-2', index: 2, side: 'b', label: '3B' },
      ],
    };

    const fpBoth = rowFootprint(rowBoth);
    // minX = -10, maxX = 2*50 + 10 = 110 (length = 120)
    // minY = -40, maxY = +40 (height = 80)
    // translated by (100, 100):
    // corners: (90, 60), (210, 60), (210, 140), (90, 140)
    expect(fpBoth[0]).toEqual({ x: 90, y: 60 });
    expect(fpBoth[1]).toEqual({ x: 210, y: 60 });
    expect(fpBoth[2]).toEqual({ x: 210, y: 140 });
    expect(fpBoth[3]).toEqual({ x: 90, y: 140 });

    // One-sided: width = tableWidth + 2*r = 40 + 20 = 60 (from -40 to +20)
    const rowOne: Row = {
      ...rowBoth,
      id: 'r-one',
      side: 'one',
      seats: [{ id: 's-1', index: 0, side: 'a', label: '1A' }],
    };

    const fpOne = rowFootprint(rowOne);
    // minY = -40, maxY = +20 (translated by 100: 60 to 120)
    expect(fpOne[0]).toEqual({ x: 90, y: 60 });
    expect(fpOne[1]).toEqual({ x: 90 + 20, y: 60 }); // maxIndex = 0, length = 20: 90 to 110
    expect(fpOne[2]).toEqual({ x: 110, y: 120 });
    expect(fpOne[3]).toEqual({ x: 90, y: 120 });
  });

  it('supports tableWidth: 0 (bare line of seats)', () => {
    const rowZeroWidth: Row = {
      id: 'r-zero',
      label: 'Zero Width Row',
      position: { x: 0, y: 0 },
      rotation: 0,
      side: 'both',
      seatSpacing: 30,
      seatRadius: 10,
      tableWidth: 0,
      seats: [
        { id: 's-1', index: 0, side: 'a', label: '1A' },
        { id: 's-2', index: 1, side: 'b', label: '2B' },
      ],
    };

    const fp = rowFootprint(rowZeroWidth);
    // tableWidth = 0, side: both -> minY = -(0 + 2*10) = -20, maxY = +20
    // minX = -10, maxX = 1*30 + 10 = 40
    expect(fp[0]).toEqual({ x: -10, y: -20 });
    expect(fp[1]).toEqual({ x: 40, y: -20 });
    expect(fp[2]).toEqual({ x: 40, y: 20 });
    expect(fp[3]).toEqual({ x: -10, y: 20 });
  });

  it('handles rotated rows', () => {
    const rotatedRow: Row = {
      id: 'r-rot',
      label: 'Rotated Row',
      position: { x: 100, y: 100 },
      rotation: 90,
      side: 'both',
      seatSpacing: 50,
      seatRadius: 10,
      tableWidth: 40,
      seats: [{ id: 's-1', index: 0, side: 'a', label: '1A' }],
    };

    const fp = rowFootprint(rotatedRow);
    // unrotated local corners for maxIndex 0:
    // (-10, -40), (10, -40), (10, 40), (-10, 40)
    // rotated by 90 deg:
    // (-10, -40) rotated 90 is (40, -10), translated + (100, 100) = (140, 90)
    expect(fp[0].x).toBeCloseTo(140);
    expect(fp[0].y).toBeCloseTo(90);
  });
});
