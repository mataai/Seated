import { safeParseFloorplan, type Floorplan } from '@open-seats/core';

// #region model
const floorplan: Floorplan = {
  schemaVersion: 1,
  dimensions: { width: 800, height: 600 },
  buildings: [
    {
      id: 'hall',
      label: 'Hall',
      position: { x: 50, y: 50 }, // world space
      rotation: 0,
      points: [
        { x: 0, y: 0 },
        { x: 600, y: 0 },
        { x: 600, y: 400 },
        { x: 0, y: 400 },
      ],
      zones: [
        {
          id: 'stage',
          position: { x: 200, y: 20 }, // relative to the building
          rotation: 0,
          points: [
            { x: 0, y: 0 },
            { x: 200, y: 0 },
            { x: 200, y: 60 },
            { x: 0, y: 60 },
          ],
          fill: '#312e81',
          text: { value: 'STAGE', color: '#e0e7ff' },
        },
      ],
      rows: [
        {
          id: 'row-a',
          label: 'A',
          position: { x: 120, y: 160 }, // relative to the building
          rotation: 0,
          side: 'both', // seats on both sides of a table
          seatSpacing: 40,
          seatRadius: 14,
          tableWidth: 24,
          seats: [
            { id: 's-a-1', index: 0, side: 'a', label: 'Hall-A-1' },
            { id: 's-a-2', index: 0, side: 'b', label: 'Hall-A-2' },
            { id: 's-a-3', index: 1, side: 'a', label: 'Hall-A-3' },
            { id: 's-a-4', index: 1, side: 'b', label: 'Hall-A-4' },
          ],
        },
      ],
    },
  ],
};
// #endregion model

// #region parse
async function loadFloorplan(url: string): Promise<Floorplan> {
  const json: unknown = await (await fetch(url)).json();
  const result = safeParseFloorplan(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(
      `Invalid floorplan at "${issue.path.join('.')}": ${issue.message}`
    );
  }
  return result.data as Floorplan;
}
// #endregion parse

export { floorplan, loadFloorplan };
