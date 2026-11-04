import { createEditor } from '@open-seats/editor';

const editor = createEditor(document.getElementById('designer')!);
declare const rowId: string;
declare const otherRowId: string;
declare const otherBuildingId: string;
declare const seatId: string;

// #region configure
editor.setRowSide(rowId, 'one'); // 'one' | 'both'
editor.setRowSeatCount(rowId, 14); // keeps the table length, recomputes spacing
editor.setRowSeatSpacing(rowId, 36);
editor.setRowSeatRadius(rowId, 12);
editor.setRowTableWidth(rowId, 30);
// #endregion configure

// #region move
// Move a seat to another row (optionally to a given side)…
editor.moveSeatToRow(rowId, seatId, otherRowId, 'a');

// …or a whole row to another building, dropping it at a world position.
editor.reparentRow(rowId, otherBuildingId, { x: 640, y: 220 });
// #endregion move

// #region result
// Each call returns false when the change would break a layout rule.
if (!editor.setRowSeatCount(rowId, 40)) {
  console.warn('Not enough room for 40 seats');
}
// #endregion result
