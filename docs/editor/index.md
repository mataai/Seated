# Editor

`@open-seats/editor` is the floorplan designer: a canvas with drawing tools, selection and transform handles, and a programmatic API for everything the tools do. It produces the JSON the [viewer](/viewer/) renders.

::: tip Angular
`<seats-editor>` wraps the editor with a complete UI: toolbar, property panels, blueprint controls, floorplan import. See [Angular → `<seats-editor>`](/angular/editor).
:::

## Create an editor

<<< @/snippets/editor/basic.ts#create

| Option                 | Default    | Description                                                      |
| :--------------------- | :--------- | :--------------------------------------------------------------- |
| `floorplan`            | empty plan | Floorplan to start from.                                         |
| `rules.enforce`        | `true`     | Reject edits that break the [layout rules](/guide/layout-rules). |
| `rules.tolerance`      | `0.01`     | How close shapes may get before they count as overlapping.       |
| `gridSnapping.enabled` | `false`    | Snap positions to a grid.                                        |
| `gridSnapping.size`    | `10`       | Grid size in pixels.                                             |

## Save the floorplan

<<< @/snippets/editor/basic.ts#save

`loadFloorplan(plan)` replaces the whole plan and clears the undo history.

## Preview

<<< @/snippets/editor/basic.ts#preview

## Other controls

<<< @/snippets/editor/basic.ts#misc

## Events

| Event                                                                                 | Payload       | When                                                        |
| :------------------------------------------------------------------------------------ | :------------ | :---------------------------------------------------------- |
| `change`                                                                              | `Floorplan`   | After any edit, undo or redo.                               |
| `toolChange`                                                                          | `ToolType`    | The active tool changed.                                    |
| `selectionChange`                                                                     | `string[]`    | Selected node ids changed.                                  |
| `previewToggle`                                                                       | `boolean`     | Preview mode toggled.                                       |
| `violationsUpdated`                                                                   | `Violation[]` | An edit was rejected, or the layout was re-validated.       |
| `buildingCreationStarted` / `…PointsChange` / `…Completed` / `…Cancelled` / `…Failed` |               | Interactive building drawing. See [Drawing tools](./tools). |
| `rowCreationStarted` / `…PointsChange` / `…Completed` / `…Cancelled` / `…Failed`      |               | Interactive row drawing.                                    |

## Keyboard

| Keys                                                                                                  | Action                                                                                    |
| :---------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Z</kbd>                                                             | Undo                                                                                      |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>, <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Y</kbd> | Redo                                                                                      |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>C</kbd> / <kbd>X</kbd> / <kbd>V</kbd>                               | Copy / cut / paste                                                                        |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>D</kbd>                                                             | Duplicate the selection                                                                   |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd>                                                              | Delete the selection (one undo step)                                                      |
| Arrow keys                                                                                            | Nudge the selection by 2 px (10 px with <kbd>Shift</kbd>, or one grid step when snapping) |
| <kbd>Esc</kbd>                                                                                        | Cancel drawing, or clear the selection                                                    |

The canvas container must have focus for these to work.
