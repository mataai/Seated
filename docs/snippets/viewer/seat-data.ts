import { SAMPLE_FLOORPLAN } from '@open-seats/core';
import { createViewer } from '@open-seats/viewer';

// #region set
const viewer = createViewer(document.getElementById('seat-map')!, {
  floorplan: SAMPLE_FLOORPLAN,
  seatData: {
    's-a-1a': { price: 95, category: 'Front row' },
  },
  tooltipProvider: async ({ seat, data }) => ({
    title: seat.label,
    content: data?.['ticket']
      ? `Your ticket ${data['ticket']}`
      : `$${data?.['price'] ?? 65}`,
  }),
});

// Merge per seat (replaces that seat's data); `null` removes it.
viewer.setSeatData({ 's-a-2a': { price: 95 }, 's-a-1a': null });

// Replace all app data at once.
viewer.setSeatData({ 's-a-3a': { ticket: 'T-1001' } }, { replace: true });

viewer.getSeatData('s-a-3a'); // { ticket: 'T-1001' }
// #endregion set

// #region layers
// Live updates can send shared data (e.g. prices) for the same seat. The
// viewer keeps it in a separate layer and merges both: your fields win.
viewer.applyStatusSnapshot(
  {},
  { data: { 's-a-3a': { price: 120, ticket: 'x' } } }
);

viewer.getSeatData('s-a-3a'); // { price: 120, ticket: 'T-1001' }

viewer.on('seatDataChanged', ({ changes, source }) => {
  console.log(source, Object.keys(changes)); // 'live' | 'app'
});
// #endregion layers
