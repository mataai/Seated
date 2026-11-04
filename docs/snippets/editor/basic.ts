declare function saveFloorplan(json: string): Promise<void>;
// #region create
import { parseFloorplan } from '@open-seats/core';
import { createEditor } from '@open-seats/editor';

const saved = localStorage.getItem('floorplan');

const editor = createEditor(document.getElementById('designer')!, {
  floorplan: saved ? parseFloorplan(JSON.parse(saved)) : undefined,
  rules: { enforce: true, tolerance: 0.01 }, // reject overlapping edits
  gridSnapping: { enabled: true, size: 10 },
});
// #endregion create

// #region save
editor.on('change', (floorplan) => {
  void saveFloorplan(JSON.stringify(floorplan));
});

// Or read it when you need it (a deep copy).
const floorplan = editor.getFloorplan();
console.log(floorplan.buildings.length);
// #endregion save

// #region preview
// Preview mode shows the plan the way the viewer will.
editor.togglePreview(true);
editor.on('previewToggle', (enabled) => console.log('preview', enabled));
// #endregion preview

// #region misc
editor.setGridSnapping(false);
editor.zoomIn();
editor.resetZoom(); // fit all content
editor.destroy();
// #endregion misc
