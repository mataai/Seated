# Floorplan model

A floorplan is a plain JSON object. The editor produces it, your backend stores it, and the viewer renders it. It is validated with a [Zod schema](/core/schema) and versioned with `schemaVersion`.

## Structure

```
Floorplan
├── dimensions          { width, height } of the canvas
├── background?         blueprint image (see Editor → Blueprints)
└── buildings[]         polygon in world space
    ├── zones[]         non-seating areas (stage, bar, …) inside the building
    └── rows[]          a line of seats, optionally around a table
        └── seats[]     identified by id, labelled "<building>-<row>-<number>"
```

| Node         | Key fields                                                                                                                                                                      |
| :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Building** | `id`, `label`, `position` (world), `rotation` (degrees), `points` (polygon, relative to `position`), `zones`, `rows`                                                            |
| **Zone**     | `id`, `position` (relative to the building), `rotation`, `points`, `fill`, optional `stroke`, `opacity`, `text`                                                                 |
| **Row**      | `id`, `label`, `position` (relative to the building), `rotation`, `side` (`'one'` or `'both'`), `seatSpacing`, `seatRadius`, `tableWidth`, optional `tableLength`, `tableStyle` |
| **Seat**     | `id`, `index` (slot along the row), `side` (`'a'` or `'b'`), `label`                                                                                                            |

Every node can carry a `data` object for your own static metadata (it's saved with the floorplan). For per-event data such as prices or tickets, use [seat data](/viewer/seat-data) instead, which is never saved.

## Coordinates

- Buildings are positioned in **world space**.
- Zones and rows are positioned **relative to their building**, and rotate with it.
- A row's seats are laid out along its length: slot `index` × `seatSpacing`. On double-sided rows (`side: 'both'`), side `a` is one side of the table and side `b` the other.

Use [`seatWorldPosition`](/core/geometry) to get a seat's centre on the canvas.

## Example

<<< @/snippets/guide/floorplan.ts#model

## Loading from JSON

Floorplans usually come from an API or a file. Validate them before use:

<<< @/snippets/guide/floorplan.ts#parse

## Seat ids and labels

- **Ids** are stable: statuses, selections and seat data are keyed by seat id, so keep them when you edit a floorplan.
- **Labels** are what users see, e.g. `Grand Auditorium-A-7`. The editor keeps them up to date when buildings or rows are renamed. On double-sided tables one side gets odd numbers and the other even numbers. See [Seat labels](/editor/numbering).
