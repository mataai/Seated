import { createEditor } from '@open-seats/editor';

const editor = createEditor(document.getElementById('designer')!, {
  gridSnapping: { enabled: true, size: 10 },
});

// Draw a hall with a stage and one row of 10 seats.
const hall = editor.createRectangleBuilding({ x: 40, y: 40 }, 600, 400, 'Hall');
if (hall) {
  editor.createRectangleZone(hall.id, { x: 200, y: 20 }, 200, 60, '#312e81');
  editor.createRow(hall.id, { x: 120, y: 160 }, 10);
}

// Every edit emits the updated floorplan: save it wherever you like.
editor.on('change', (floorplan) => {
  localStorage.setItem('floorplan', JSON.stringify(floorplan));
});
