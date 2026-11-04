# Editing & history

Nodes are buildings, zones and rows, addressed by id. Each method returns `false` (and changes nothing) if the result would break a [layout rule](/guide/layout-rules).

## Selection

<<< @/snippets/editor/editing.ts#selection

## Move, rotate, rename

<<< @/snippets/editor/editing.ts#transform

Renaming a building or a row updates the labels of all its seats.

## Shape and size

<<< @/snippets/editor/editing.ts#shapes

## Polygon vertices

Buildings and zones are polygons. Edit their corners directly:

<<< @/snippets/editor/editing.ts#vertices

## Clipboard

<<< @/snippets/editor/editing.ts#clipboard

Pasted and duplicated nodes get new ids, and their seats new labels.

## Undo and redo

Every edit is one undo step, including background changes. Rapid slider changes can be merged into one step with `updateBackground(…, { merge: true })`.

<<< @/snippets/editor/editing.ts#history
