import { describe, expect, it } from 'vitest';
import { parseFloorplan, safeParseFloorplan, type Floorplan } from '../src';

describe('Schema validation', () => {
  const validFloorplan: Floorplan = {
    schemaVersion: 1,
    dimensions: { width: 1000, height: 800 },
    buildings: [
      {
        id: 'b-1',
        label: 'Main Hall',
        position: { x: 50, y: 50 },
        rotation: 0,
        points: [
          { x: 0, y: 0 },
          { x: 500, y: 0 },
          { x: 500, y: 400 },
          { x: 0, y: 400 },
        ],
        zones: [
          {
            id: 'z-1',
            position: { x: 10, y: 10 },
            rotation: 0,
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
              { x: 100, y: 80 },
              { x: 0, y: 80 },
            ],
            fill: '#e0e0e0',
          },
        ],
        rows: [
          {
            id: 'r-1',
            label: 'Row 1',
            position: { x: 150, y: 50 },
            rotation: 0,
            side: 'both',
            seatSpacing: 40,
            seatRadius: 15,
            tableWidth: 30,
            seats: [
              { id: 's-1', index: 0, side: 'a', label: '1A' },
              { id: 's-2', index: 0, side: 'b', label: '1B' },
            ],
          },
        ],
      },
    ],
  };

  it('parses valid floorplan successfully', () => {
    const result = parseFloorplan(validFloorplan);
    expect(result.schemaVersion).toBe(1);
    expect(result.buildings.length).toBe(1);
    expect(result.buildings[0].rows[0].seats.length).toBe(2);
  });

  it('rejects seat with side "b" in a one-sided row (refinement rule)', () => {
    const invalidRowPlan = {
      ...validFloorplan,
      buildings: [
        {
          ...validFloorplan.buildings[0],
          rows: [
            {
              id: 'r-one',
              label: 'One-sided row',
              position: { x: 150, y: 50 },
              rotation: 0,
              side: 'one',
              seatSpacing: 40,
              seatRadius: 15,
              tableWidth: 30,
              seats: [
                { id: 's-1', index: 0, side: 'a', label: '1A' },
                { id: 's-2', index: 1, side: 'b', label: '1B' }, // Invalid!
              ],
            },
          ],
        },
      ],
    };

    const parsed = safeParseFloorplan(invalidRowPlan);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toContain(
        "has side 'b' but row \"r-one\" has side 'one'"
      );
    }
  });

  it('tolerates unknown optional fields for forward compatibility (passthrough)', () => {
    const forwardCompatiblePlan = {
      ...validFloorplan,
      futureField: 'awesome-future-feature',
      buildings: [
        {
          ...validFloorplan.buildings[0],
          extraBuildingData: { vip: true },
          zones: [
            {
              ...validFloorplan.buildings[0].zones[0],
              futureSeatedZone: true,
            },
          ],
        },
      ],
    };

    const parsed = safeParseFloorplan(forwardCompatiblePlan);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect((parsed.data as Record<string, unknown>).futureField).toBe(
        'awesome-future-feature'
      );
      expect(
        (parsed.data.buildings[0] as Record<string, unknown>).extraBuildingData
      ).toEqual({
        vip: true,
      });
    }
  });

  it('rejects unsupported schema version', () => {
    const wrongVersion = {
      ...validFloorplan,
      schemaVersion: 2,
    };
    const parsed = safeParseFloorplan(wrongVersion);
    expect(parsed.success).toBe(false);
  });
});
