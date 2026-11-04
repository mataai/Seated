import { SAMPLE_FLOORPLAN } from '@open-seats/core';
import { createViewer } from '@open-seats/viewer';

const viewer = createViewer(document.getElementById('seat-map')!, {
  floorplan: SAMPLE_FLOORPLAN,
});

// #region subscribe
// `on` returns an unsubscribe function.
const stop = viewer.on('seatSelected', ({ seat, row, building }) => {
  console.log(`Selected ${seat.label} (${building.label}, row ${row.label})`);
});
stop();

// Or keep a reference to the listener and use `off`.
const onHover = ({ seat }: { seat: { label: string } }) =>
  console.log(seat.label);
viewer.on('seatHovered', onHover);
viewer.off('seatHovered', onHover);
// #endregion subscribe

// #region all
viewer.on('ready', () => console.log('rendered'));
viewer.on('floorplanLoaded', (plan) =>
  console.log(plan.buildings.length, 'buildings')
);
viewer.on('violationsUpdated', (violations) => console.log(violations));
viewer.on('seatHoverEnded', ({ seat }) => console.log('left', seat.id));
viewer.on('seatDeselected', ({ seat }) => console.log('deselected', seat.id));
viewer.on('statusesChanged', ({ changes, replaced }) =>
  console.log(changes, replaced)
);
viewer.on('seatDataChanged', ({ changes, source }) =>
  console.log(source, changes)
);
viewer.on('connectionStateChanged', ({ state, error }) =>
  console.log(state, error)
);
// #endregion all
