import { SAMPLE_FLOORPLAN } from '@open-seats/core';
import { createViewer } from '@open-seats/viewer';

const container = document.getElementById('seat-map')!;

// #region definitions
const viewer = createViewer(container, {
  floorplan: SAMPLE_FLOORPLAN,
  defaultStatus: 'available',
  statusDefinitions: [
    {
      key: 'available',
      label: 'Available',
      style: { fill: '#22c55e' },
      selectable: true,
    },
    {
      key: 'vip',
      label: 'VIP',
      style: { fill: '#eab308', stroke: '#854d0e' },
      selectable: true,
    },
    {
      key: 'reserved',
      label: 'Reserved',
      style: { fill: '#9ca3af', opacity: 0.6 },
      selectable: false,
    },
    {
      key: 'blocked',
      label: 'Blocked',
      style: { fill: '#ef4444' },
      selectable: false,
      hoverable: false,
    },
  ],
  statuses: { 's-a-1a': 'vip', 's-a-2a': 'vip' },
});
// #endregion definitions

// #region update
viewer.setStatus('s-b-1a', 'reserved');

// Merge several changes at once; `null` resets a seat to the default status.
viewer.setStatuses({ 's-b-2a': 'reserved', 's-a-1a': null });

viewer.getStatus('s-b-1a'); // 'reserved'
// #endregion update

// #region snapshot
// Replace every status (seats not listed go back to the default)…
viewer.applyStatusSnapshot({ 's-c-1a': 'reserved' }, { revision: 41 });

// …then apply changes in order. Stale revisions are ignored.
viewer.applyStatusPatch({ 's-c-2a': 'reserved' }, { revision: 42 }); // true
viewer.applyStatusPatch({ 's-c-2a': null }, { revision: 40 }); // false: stale
// #endregion snapshot
