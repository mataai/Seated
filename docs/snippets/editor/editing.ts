import { createEditor } from '@open-seats/editor';

const editor = createEditor(document.getElementById('designer')!);
declare const nodeId: string; // a building, zone or row id
declare const zoneId: string;
declare const buildingId: string;

// #region selection
editor.selectNodes([nodeId]);
editor.on('selectionChange', (ids) => console.log('selected', ids));
editor.getSelectedNodeIds();
editor.clearSelection();
// #endregion selection

// #region transform
editor.moveNode(nodeId, { x: 200, y: 120 });
editor.nudgeNode(nodeId, 10, 0); // e.g. bound to arrow keys
editor.rotateNode(nodeId, 15); // degrees
editor.updateNodeLabel(nodeId, 'Balcony'); // renames relabel the seats
editor.getNodePosition(nodeId); // { x, y }
// #endregion transform

// #region shapes
editor.setZoneFill(zoneId, '#7c3aed');
editor.scaleShape(zoneId, 1.5, 1); // stretch horizontally
editor.setShapeDimensions(buildingId, 900, 600);
editor.flipNode(nodeId, 'horizontal');
// #endregion shapes

// #region vertices
editor.moveVertex(buildingId, 2, { x: 820, y: 520 });
editor.addVertex(buildingId, 2, { x: 860, y: 300 }); // after vertex 2
editor.deleteVertex(buildingId, 3);
// #endregion vertices

// #region clipboard
editor.selectNodes([nodeId]);
editor.copySelection();
if (editor.canPaste()) {
  editor.paste(buildingId, { x: 40, y: 40 }); // target building, offset
}
editor.cutSelection();
editor.duplicateNode(nodeId);
editor.deleteNode(nodeId);
// #endregion clipboard

// #region history
document.querySelector('#undo')!.addEventListener('click', () => editor.undo());
document.querySelector('#redo')!.addEventListener('click', () => editor.redo());

editor.on('change', () => {
  document.querySelector<HTMLButtonElement>('#undo')!.disabled =
    !editor.canUndo();
  document.querySelector<HTMLButtonElement>('#redo')!.disabled =
    !editor.canRedo();
});
// #endregion history
