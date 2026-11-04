import { createEditor, type ToolType } from '@open-seats/editor';

const editor = createEditor(document.getElementById('designer')!);

// #region tools
const toolbar = document.querySelector('#toolbar')!;
toolbar.addEventListener('click', (e) => {
  const tool = (e.target as HTMLElement).dataset['tool'] as
    ToolType | undefined;
  if (tool) editor.setTool(tool); // 'select' | 'pan' | 'building' | 'zone' | 'row' | 'add-seat'
});

editor.on('toolChange', (tool) => {
  for (const button of toolbar.querySelectorAll<HTMLElement>('[data-tool]')) {
    button.classList.toggle('active', button.dataset['tool'] === tool);
  }
});
// #endregion tools

// #region building
// Rectangle mode: click two opposite corners.
editor.startBuildingCreation('Main Hall', 'rectangle');

// Outline mode: click each corner. Clicking an existing corner again (with 3+
// corners placed) closes the shape; or finish from your own button.
editor.startBuildingCreation('Foyer', 'outline');
editor.on('buildingCreationPointsChange', (points) => {
  console.log(`${points.length} corners so far`);
});
document.querySelector('#finish')!.addEventListener('click', () => {
  editor.finishBuildingCreation();
});

editor.on('buildingCreationCompleted', (building) =>
  console.log('created', building.label)
);
editor.on('buildingCreationFailed', ({ reason }) => alert(reason));
// #endregion building

// #region row
// Click two points inside a building to lay out a row of seats along them.
editor.startRowCreation({
  side: 'both',
  seatSpacing: 36,
  seatRadius: 14,
  tableWidth: 24,
});

editor.on('rowCreationCompleted', (row) =>
  console.log(`${row.seats.length} seats`)
);
editor.on('rowCreationFailed', ({ reason, violations }) =>
  console.warn(reason, violations)
);

editor.cancelRowCreation();
// #endregion row
