import { SAMPLE_FLOORPLAN } from '@open-seats/core';
import { createViewer } from '@open-seats/viewer';

// #region a11y
const viewer = createViewer(document.getElementById('seat-map')!, {
  floorplan: SAMPLE_FLOORPLAN,
  ariaLabel: 'Choose your seats in the Grand Auditorium',
  enableKeyboardNavigation: true, // default
});

// Keyboard focus moves fire the same hover events as the mouse.
viewer.on('seatHovered', ({ seat }) => {
  document.querySelector('#focused-seat')!.textContent = seat.label;
});
// #endregion a11y
