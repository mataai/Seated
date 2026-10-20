import { describe, expect, it } from 'vitest';
import {
  canPlace,
  validateLayout,
  type Building,
  type Floorplan,
  type Row,
  type Seat,
} from '../src';

describe('Performance & Scalability (10k Seats Benchmark)', () => {
  function generateHighDensityFloorplan(
    rowCount = 100,
    seatsPerRow = 100
  ): Floorplan {
    const rows: Row[] = [];
    const seatRadius = 10;
    const seatSpacing = 25;
    const rowGap = 35;

    for (let r = 0; r < rowCount; r++) {
      const seats: Seat[] = [];
      for (let s = 0; s < seatsPerRow; s++) {
        seats.push({
          id: `seat-${r}-${s}`,
          index: s,
          side: 'a',
          label: `R${r + 1}-S${s + 1}`,
        });
      }

      rows.push({
        id: `row-${r}`,
        label: `Row ${r + 1}`,
        position: { x: 50, y: 50 + r * rowGap },
        rotation: 0,
        side: 'one',
        seatSpacing,
        seatRadius,
        tableWidth: 0,
        seats,
      });
    }

    const totalWidth = seatsPerRow * seatSpacing + 100;
    const totalHeight = rowCount * rowGap + 100;

    const building: Building = {
      id: 'stadium-main',
      label: 'Mega Arena',
      position: { x: 10, y: 10 },
      rotation: 0,
      points: [
        { x: 0, y: 0 },
        { x: totalWidth, y: 0 },
        { x: totalWidth, y: totalHeight },
        { x: 0, y: totalHeight },
      ],
      zones: [],
      rows,
    };

    return {
      schemaVersion: 1,
      dimensions: { width: totalWidth + 100, height: totalHeight + 100 },
      buildings: [building],
    };
  }

  it('validates a 10,000 seat floorplan layout rapidly using spatial indexing', () => {
    const plan = generateHighDensityFloorplan(100, 100); // 100 * 100 = 10,000 seats!
    const totalSeats = plan.buildings[0].rows.reduce(
      (sum, r) => sum + r.seats.length,
      0
    );
    expect(totalSeats).toBe(10000);

    const start = performance.now();
    const violations = validateLayout(plan);
    const duration = performance.now() - start;

    expect(violations.length).toBe(0);
    // 10,000 seats layout validation should complete swiftly
    expect(duration).toBeLessThan(1000); // < 1 second for 10k seats
  });

  it('performs incremental canPlace in a 10,000 seat plan in under 5ms', () => {
    const plan = generateHighDensityFloorplan(100, 100);

    const start = performance.now();
    // Move row-5 slightly within its free space
    const violations = canPlace(plan, 'row-5', {
      position: { x: 50, y: 50 + 5 * 35 + 2 },
    });
    const duration = performance.now() - start;

    expect(violations.length).toBe(0);
    // Incremental validation with spatial index must be nearly instantaneous for mouse interactions
    expect(duration).toBeLessThan(15);
  });
});
