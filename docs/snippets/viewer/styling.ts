import { SAMPLE_FLOORPLAN } from '@open-seats/core';
import { createViewer } from '@open-seats/viewer';

// #region styles
createViewer(document.getElementById('seat-map')!, {
  floorplan: SAMPLE_FLOORPLAN,
  selectedStyle: { fill: '#2563eb', stroke: '#1e3a8a', strokeWidth: 3 },
  hoverStyle: { stroke: '#f59e0b', strokeWidth: 3 },
  showBackground: false, // hide the blueprint image, if the floorplan has one
});
// #endregion styles
