# Blueprints

Put an architect's plan behind the canvas and trace over it. Images (PNG, JPEG, WebP, SVG, GIF, BMP) and PDFs are supported. The blueprint is stored in `floorplan.background` and also shown by the viewer, unless it sets `showBackground: false`.

## Upload

<<< @/snippets/editor/blueprints.ts#upload

PDF pages are rendered to an image at load time. Load another page by calling `loadBackgroundFromFile(file, { pageNumber })` again.

## Adjust

<<< @/snippets/editor/blueprints.ts#adjust

| Field                                  | Description                                               |
| :------------------------------------- | :-------------------------------------------------------- |
| `src`                                  | Image data URL or URL.                                    |
| `position`                             | Top-left corner in world space.                           |
| `scale`                                | Size multiplier.                                          |
| `opacity`                              | `0`–`1`.                                                  |
| `locked`                               | When `false`, the blueprint can be dragged on the canvas. |
| `visible`                              | Hide it without removing it.                              |
| `filename`, `pageNumber`, `totalPages` | Where it came from.                                       |

## PDF worker

<<< @/snippets/editor/blueprints.ts#worker

::: tip File size
The blueprint is embedded in the floorplan JSON as a data URL. For large plans, upload the image to your storage and set `src` to its URL with `setBackground({ src: url, … })`.
:::
