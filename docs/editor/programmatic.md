# Building programmatically

Everything the drawing tools do is available as methods, for importers, templates or tests. Every call is validated against the [layout rules](/guide/layout-rules), recorded in the undo history, and emits `change`.

## Buildings and zones

<<< @/snippets/editor/programmatic.ts#shapes

## Rows and seats

<<< @/snippets/editor/programmatic.ts#rows

Seat labels are generated for you, e.g. `Hall-A-1`. See [Seat labels](./numbering).

## When an edit is rejected

<<< @/snippets/editor/programmatic.ts#invalid

Turn enforcement off with `createEditor(el, { rules: { enforce: false } })` to allow anything, for example while importing a plan you'll fix up afterwards.

## Reference

| Method                                                            | Returns            |
| :---------------------------------------------------------------- | :----------------- |
| `createBuilding(points, label?, position?)`                       | `Building \| null` |
| `createRectangleBuilding(position, width, height, label?)`        | `Building \| null` |
| `createZone(buildingId, points, fill, position?)`                 | `Zone \| null`     |
| `createRectangleZone(buildingId, position, width, height, fill?)` | `Zone \| null`     |
| `createRow(buildingId, position, seatCount, opts?)`               | `Row \| null`      |
| `addSeatToRow(buildingId, rowId, side?)`                          | `Seat \| null`     |
| `addSeatOnCanvas(buildingId, position)`                           | `Row \| null`      |

`createRow` options: `side` (`'one'` \| `'both'`), `seatSpacing`, `seatRadius`, `tableWidth`, `tableLength`, `rotation`.
