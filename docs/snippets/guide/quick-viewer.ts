import { SAMPLE_FLOORPLAN } from '@open-seats/core';
import { createViewer } from '@open-seats/viewer';

const viewer = createViewer(document.getElementById('seat-map')!, {
  floorplan: SAMPLE_FLOORPLAN,
  statuses: { 's-a-1a': 'reserved', 's-a-2a': 'locked' },
  maxSelectable: 4,
});

viewer.on('selectionChanged', ({ selectedSeats }) => {
  console.log(selectedSeats.map((ctx) => ctx.seat.label));
});
