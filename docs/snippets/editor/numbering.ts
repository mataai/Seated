import type { Building, Row } from '@open-seats/core';
import { NumberingService } from '@open-seats/editor';

declare const building: Building;
declare const row: Row;

// #region labels
NumberingService.rowLabel(0); // 'A'
NumberingService.rowLabel(26); // 'AA'

NumberingService.seatLabel('Main Hall', 'C', 7); // 'Main Hall-C-7'

// Double-sided tables: side a gets odd numbers, side b even ones.
for (const seat of row.seats) {
  console.log(NumberingService.seatNumber(row, seat));
}
// #endregion labels

// #region renumber
// Recompute labels after editing a floorplan by hand (ids are kept).
const relabeled: Building = {
  ...building,
  rows: NumberingService.renumberBuildingSeats(building),
};
// #endregion renumber

export { relabeled };
