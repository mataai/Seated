# Zoom & pan

The map starts fitted to its container, so the whole floorplan (including a blueprint background) is visible. It re-fits on resize until the user zooms or pans.

Users zoom with the mouse wheel or a pinch, and pan by dragging the background or with <kbd>Shift</kbd> + arrow keys.

## Your own controls

<<< @/snippets/viewer/viewport.ts#controls

| Method                                           | Description                                                                                        |
| :----------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| `zoomIn(factor = 1.2)` / `zoomOut(factor = 1.2)` | Zoom by a factor, between 0.1× and 10×. The mouse wheel and pinch zoom around the pointer instead. |
| `resetZoom()`                                    | Fit all content again (and resume fitting on resize).                                              |
| `panTo(x, y)` / `panBy(dx, dy)`                  | Move the view, in screen pixels.                                                                   |
| `getScale()`                                     | Current zoom level (`1` = 100%).                                                                   |
