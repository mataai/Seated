# `<seats-editor>`

A complete floorplan designer: the [editor](/editor/) canvas plus a toolbar, a left panel (floorplan import, history, blueprint, creation forms), a properties panel for the selected node, and a floating action bar.

<<< @/snippets/angular/editor.component.ts#editor

::: tip Saving
`floorplanChange` gives you the plan after every edit. Feeding that same plan back into `[floorplan]` is safe: the component recognises it and doesn't reload. Passing a _different_ plan reloads the editor and clears its undo history.
:::

## Inputs

| Input                                        | Default    | Description                                                        |
| :------------------------------------------- | :--------- | :----------------------------------------------------------------- |
| `floorplan`                                  |            | Plan to edit. Changing it reloads the editor.                      |
| `tool`                                       | `'select'` | Active [tool](/editor/tools).                                      |
| `options`                                    |            | [Editor options](/editor/#create-an-editor): rules, grid snapping. |
| `showToolbar`                                | `true`     | Show the tool bar.                                                 |
| `showProperties`                             | `true`     | Show the properties panel.                                         |
| `showFloatingBar`                            | `true`     | Show the floating action bar.                                      |
| `leftPanelCollapsed` / `rightPanelCollapsed` | `false`    | Start with a panel collapsed.                                      |

## Outputs

| Output                                                 | Payload                                                         |
| :----------------------------------------------------- | :-------------------------------------------------------------- |
| `floorplanChange`                                      | `Floorplan` after every edit. (`change` is a deprecated alias.) |
| `toolChange`                                           | `ToolType`                                                      |
| `selectionChange`                                      | `string[]`                                                      |
| `previewToggle`                                        | `boolean`                                                       |
| `violationsUpdated`                                    | `Violation[]`                                                   |
| `leftPanelCollapseChange` / `rightPanelCollapseChange` | `boolean`                                                       |

## Importing floorplans

The left panel has an **Import Floorplan** button for `.json` files. Imports are validated against the schema, and the user confirms before replacing a non-empty plan. Import from your own UI (e.g. drag-and-drop) with:

```ts
const imported = await this.editor().importFloorplanFile(file); // false if invalid or cancelled
```

The confirmation uses `window.confirm`. To use your own dialog, extend the component and override the protected `confirmReplace(message)` method.

## Methods

| Group           | Methods                                                                                                                                                                                        |
| :-------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Floorplan       | `getFloorplan()`, `loadFloorplan(plan)`, `importFloorplanFile(file)`                                                                                                                           |
| History & tools | `undo()`, `redo()`, `canUndo()`, `canRedo()`, `setTool(tool)`, `togglePreview()`, `isPreview()`                                                                                                |
| Selection       | `selectNodes(ids)`, `selectNode(id)`, `deleteSelected()`, `duplicateSelected()`                                                                                                                |
| Nodes           | `moveNode`, `nudgeNode`, `rotateNode`, `updateNodeLabel`, `deleteNode`, `duplicateNode`, `setZoneFill`, `scaleShape`, `addSeatOnCanvas`                                                        |
| Clipboard       | `copySelection()`, `cutSelection()`, `paste(buildingId?, offset?)`, `canPaste()`                                                                                                               |
| Blueprint       | `setBackground(bg)`, `setBackgroundOpacity(percent)`, `setBackgroundScale(scale)`, `toggleBackgroundVisibility()`, `toggleBackgroundLocked()`, `removeBackground()`, `fitBackgroundToCanvas()` |
| Panels          | `toggleLeftPanel()`, `toggleRightPanel()`                                                                                                                                                      |

For anything else, use the [vanilla editor](/editor/) directly.
