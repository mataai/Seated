import { describe, expect, it } from 'vitest';
import {
  canPlace,
  validateLayout,
  type Floorplan,
} from '../src';

describe('Layout and Incremental Validation', () => {
  const createBasePlan = (): Floorplan => ({
    schemaVersion: 1,
    dimensions: { width: 1000, height: 800 },
    buildings: [
      {
        id: 'b-1',
        label: 'Building 1',
        position: { x: 50, y: 50 },
        rotation: 0,
        points: [
          { x: 0, y: 0 },
          { x: 400, y: 0 },
          { x: 400, y: 300 },
          { x: 0, y: 300 },
        ],
        zones: [
          {
            id: 'z-1',
            position: { x: 10, y: 10 },
            rotation: 0,
            points: [
              { x: 0, y: 0 },
              { x: 50, y: 0 },
              { x: 50, y: 50 },
              { x: 0, y: 50 },
            ],
            fill: '#ccc',
          },
        ],
        rows: [
          {
            id: 'r-1',
            label: 'Row 1',
            position: { x: 100, y: 100 },
            rotation: 0,
            side: 'both',
            seatSpacing: 40,
            seatRadius: 15, // 2*15 = 30 <= 40 -> valid
            tableWidth: 20,
            seats: [{ id: 's-1', index: 0, side: 'a', label: '1A' }],
          },
        ],
      },
    ],
  });

  it('validates a correct floorplan with no violations', () => {
    const plan = createBasePlan();
    const violations = validateLayout(plan);
    expect(violations.length).toBe(0);
  });

  it('detects seatSpacing < 2 * seatRadius -> seat-overlap', () => {
    const plan = createBasePlan();
    // Spacing 25 < 2 * 15 (30)
    plan.buildings[0].rows[0].seatSpacing = 25;
    plan.buildings[0].rows[0].seatRadius = 15;

    const violations = validateLayout(plan);
    const seatOverlap = violations.find((v) => v.rule === 'seat-overlap');
    expect(seatOverlap).toBeDefined();
    expect(seatOverlap?.ids).toContain('r-1');
  });

  it('detects invalid polygon (bow-tie self-intersecting) on zone', () => {
    const plan = createBasePlan();
    plan.buildings[0].zones[0].points = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 0, y: 50 },
      { x: 50, y: 0 },
    ];

    const violations = validateLayout(plan);
    const polyViolation = violations.find((v) => v.rule === 'invalid-polygon');
    expect(polyViolation).toBeDefined();
    expect(polyViolation?.ids).toContain('z-1');
  });

  it('detects overlapping buildings -> building-overlap', () => {
    const plan = createBasePlan();
    plan.buildings.push({
      id: 'b-2',
      label: 'Building 2',
      position: { x: 200, y: 150 }, // Overlaps b-1: (50,50) to (450,350)
      rotation: 0,
      points: [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 300 },
        { x: 0, y: 300 },
      ],
      zones: [],
      rows: [],
    });

    const violations = validateLayout(plan);
    const bOverlap = violations.find((v) => v.rule === 'building-overlap');
    expect(bOverlap).toBeDefined();
    expect(bOverlap?.ids).toContain('b-1');
    expect(bOverlap?.ids).toContain('b-2');
  });

  it('detects row out-of-bounds', () => {
    const plan = createBasePlan();
    // Position row outside building boundary
    plan.buildings[0].rows[0].position = { x: 390, y: 290 };

    const violations = validateLayout(plan);
    const oob = violations.find((v) => v.rule === 'out-of-bounds');
    expect(oob).toBeDefined();
    expect(oob?.ids).toContain('r-1');
  });

  it('canPlace: incremental check allows valid move and rejects collision', () => {
    const plan = createBasePlan();

    // Valid proposed position for r-1
    const validCheck = canPlace(plan, 'r-1', {
      position: { x: 150, y: 150 },
    });
    expect(validCheck.length).toBe(0);

    // Invalid: position colliding with zone z-1 at (10, 10)
    const collisionCheck = canPlace(plan, 'r-1', {
      position: { x: 20, y: 20 },
    });
    expect(collisionCheck.some((v) => v.rule === 'zone-row-overlap')).toBe(true);

    // Invalid: move out of building bounds
    const oobCheck = canPlace(plan, 'r-1', {
      position: { x: 500, y: 500 },
    });
    expect(oobCheck.some((v) => v.rule === 'out-of-bounds')).toBe(true);

    // Invalid: change seat spacing to overlap
    const spacingCheck = canPlace(plan, 'r-1', {
      seatSpacing: 20,
      seatRadius: 15,
    });
    expect(spacingCheck.some((v) => v.rule === 'seat-overlap')).toBe(true);
  });
});
