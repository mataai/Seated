import { createEditor } from '@open-seats/editor';

const editor = createEditor(document.getElementById('designer')!);

// #region shapes
// Buildings are placed in world space…
const hall = editor.createRectangleBuilding({ x: 40, y: 40 }, 800, 500, 'Hall');

// …or from any polygon (points are relative to `position`).
const lounge = editor.createBuilding(
  [
    { x: 0, y: 0 },
    { x: 300, y: 0 },
    { x: 300, y: 200 },
    { x: 150, y: 260 },
    { x: 0, y: 200 },
  ],
  'Lounge',
  { x: 900, y: 40 }
);

if (hall && lounge) {
  // Zones and rows are placed relative to their building.
  editor.createRectangleZone(hall.id, { x: 300, y: 20 }, 200, 60, '#312e81');
  editor.createZone(
    lounge.id,
    [
      { x: 20, y: 20 },
      { x: 120, y: 20 },
      { x: 70, y: 90 },
    ],
    '#065f46'
  );
}
// #endregion shapes

// #region rows
if (hall) {
  const row = editor.createRow(hall.id, { x: 120, y: 160 }, 12, {
    side: 'both', // seats on both sides of a table
    seatSpacing: 40,
    seatRadius: 14,
    tableWidth: 24,
    rotation: 0,
  });

  if (row) {
    editor.addSeatToRow(hall.id, row.id, 'b'); // one more seat on side b
  }

  // A single free-standing seat (a one-seat row without a table).
  editor.addSeatOnCanvas(hall.id, { x: 120, y: 300 });
}
// #endregion rows

// #region invalid
// Every creation is validated: on overlap or out-of-bounds it returns null
// and reports why.
editor.on('violationsUpdated', (violations) => {
  for (const v of violations) console.warn(v.rule, v.ids);
});

const overlapping = editor.createRectangleBuilding(
  { x: 100, y: 100 },
  200,
  200
);
console.log(overlapping); // null: it overlaps "Hall"
// #endregion invalid
