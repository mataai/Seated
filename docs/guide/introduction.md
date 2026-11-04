# Introduction

OpenSeats is a set of TypeScript packages for building seat maps: a **designer** to draw venues, a **viewer** for customers to pick seats, and **live updates** so everyone sees bookings as they happen.

## Packages

| Package                            | What it's for                                                                          |
| :--------------------------------- | :------------------------------------------------------------------------------------- |
| [`@open-seats/viewer`](/viewer/)   | The reservation map: statuses, selection, tooltips, keyboard navigation, live updates. |
| [`@open-seats/editor`](/editor/)   | The floorplan designer: drawing tools, programmatic API, undo/redo, blueprints.        |
| [`@open-seats/angular`](/angular/) | `<seats-viewer>` and `<seats-editor>` standalone components for Angular 19–22.         |
| [`@open-seats/core`](/core/)       | The floorplan schema, validation and geometry. No DOM; works on the server.            |
| `@open-seats/renderer`             | The Konva canvas renderer used by the viewer and editor. Installed automatically.      |

## How the pieces fit

```
          designs                    stores                     shows
  ┌──────────────────┐   JSON   ┌──────────────┐   JSON   ┌──────────────────┐
  │ Editor           │ ───────▶ │ Your backend │ ───────▶ │ Viewer           │
  │ @open-seats/     │ change   │              │  load()  │ @open-seats/     │
  │ editor           │  event   │  statuses ──────────────▶ viewer           │
  └──────────────────┘          └──────────────┘  live     └──────────────────┘
```

1. A venue manager draws the venue in the **editor**. Every edit emits the floorplan as plain JSON ([the floorplan model](/guide/floorplan)).
2. Your backend stores that JSON. It is the only thing the viewer needs.
3. Customers open the **viewer** with the floorplan and the current seat statuses (`available`, `reserved`, …).
4. When someone books a seat, your backend broadcasts the change and every open viewer updates ([live updates](/live/)).

The floorplan describes **geometry only**. Statuses, prices and tickets are runtime data that you pass to the viewer separately, so the same floorplan can be reused for every event in the venue.

## Next steps

- [Getting started](/guide/getting-started): install and render a first map.
- [Floorplan model](/guide/floorplan): buildings, zones, rows and seats.
- [Viewer](/viewer/) or [Angular](/angular/), depending on your stack.
