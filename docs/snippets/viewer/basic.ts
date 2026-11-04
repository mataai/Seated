// #region create
import { SAMPLE_FLOORPLAN } from '@open-seats/core';
import { createViewer } from '@open-seats/viewer';

const container = document.getElementById('seat-map')!;

const viewer = createViewer(container, {
  floorplan: SAMPLE_FLOORPLAN,
  statuses: { 's-a-1a': 'reserved' },
  maxSelectable: 6,
});
// #endregion create

// #region load
// Swap the floorplan at any time; statuses and selection are kept per seat id.
async function showFloorplan(url: string) {
  viewer.load(await (await fetch(url)).json());
  if (viewer.violations.length > 0) {
    console.warn('Layout problems:', viewer.violations);
  }
}
// #endregion load

// #region destroy
// Remove listeners, DOM nodes and live connections when the view goes away.
viewer.destroy();
// #endregion destroy

export { showFloorplan };
