# Drawing tools

| Tool               | What the pointer does                                                                                                                                                                                                                                         |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `select`           | Select, drag and transform buildings, zones and rows.                                                                                                                                                                                                         |
| `pan`              | Drag to move the view.                                                                                                                                                                                                                                        |
| `building`         | Draw a building (starts `startBuildingCreation`).                                                                                                                                                                                                             |
| `row`              | Lay out a row of seats inside a building (starts `startRowCreation`).                                                                                                                                                                                         |
| `zone`, `add-seat` | No canvas drawing of their own: a mode your UI can react to (via `getTool()` / `toolChange`), calling [`createZone`](./programmatic#buildings-and-zones) or [`addSeatOnCanvas`](./programmatic#rows-and-seats). The Angular editor creates zones from a form. |

## Switch tools

<<< @/snippets/editor/tools.ts#tools

## Draw a building

<<< @/snippets/editor/tools.ts#building

A building that would overlap another one is rejected: `buildingCreationFailed` fires with the reason and the violations.

## Lay out a row

<<< @/snippets/editor/tools.ts#row

The row follows the line between the two clicks; seats are spaced by `seatSpacing`. With `side: 'both'`, seats face each other across a table `tableWidth` wide. The draft glows red, with a reason badge, while its position is invalid.
