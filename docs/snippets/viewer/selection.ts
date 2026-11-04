import { SAMPLE_FLOORPLAN } from '@open-seats/core';
import { createViewer } from '@open-seats/viewer';

const container = document.getElementById('seat-map')!;

// #region limit
const viewer = createViewer(container, {
  floorplan: SAMPLE_FLOORPLAN,
  maxSelectable: 4, // 1 = single-seat mode: a new click replaces the selection
  selectedSeatIds: ['s-a-3a'], // pre-selected seats
});

viewer.setMaxSelectable(2);
// #endregion limit

// #region programmatic
viewer.selectSeats(['s-a-4a', 's-a-5a']);
viewer.deselectSeats(['s-a-4a']);

const ids = viewer.getSelectedSeatIds(); // ['s-a-3a', 's-a-5a']
const seats = viewer.getSelectedSeats(); // [{ seat, row, building }, …]
console.log(
  ids,
  seats.map(({ seat, row }) => `${row.label} ${seat.label}`)
);

viewer.clearSelection();
// #endregion programmatic

// #region checkout
const checkoutButton = document.querySelector<HTMLButtonElement>('#checkout')!;

viewer.on('selectionChanged', ({ selectedSeatIds }) => {
  checkoutButton.disabled = selectedSeatIds.length === 0;
  checkoutButton.textContent = `Book ${selectedSeatIds.length} seat(s)`;
});

// Fired when selected seats stop being selectable, e.g. someone else booked
// them. They're already deselected; tell the user.
viewer.on('selectionInvalidated', ({ seats }) => {
  const labels = seats.map((ctx) => ctx.seat.label).join(', ');
  alert(`Sorry, ${labels} was just taken.`);
});
// #endregion checkout
