import { SAMPLE_FLOORPLAN } from '@open-seats/core';
import { createViewer } from '@open-seats/viewer';

const viewer = createViewer(document.getElementById('seat-map')!, {
  floorplan: SAMPLE_FLOORPLAN,
});

// #region controls
const on = (selector: string, run: () => void) =>
  document.querySelector(selector)!.addEventListener('click', run);

on('#zoom-in', () => viewer.zoomIn()); // default factor 1.2
on('#zoom-out', () => viewer.zoomOut(1.5));
on('#fit', () => viewer.resetZoom()); // fit everything again

viewer.panTo(0, 0); // absolute stage offset, in pixels
viewer.panBy(0, -120); // relative

console.log(`zoom: ${Math.round(viewer.getScale() * 100)}%`);
// #endregion controls
