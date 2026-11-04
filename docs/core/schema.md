# Schema & parsing

The [floorplan model](/guide/floorplan) is defined twice: as TypeScript interfaces (`Floorplan`, `Building`, `Zone`, `Row`, `Seat`, …) and as [Zod](https://zod.dev) schemas (`FloorplanSchema`, `BuildingSchema`, …) for runtime checks.

## Parse untrusted JSON

<<< @/snippets/core/core.ts#parse

| Function                    | Behaviour                                                                 |
| :-------------------------- | :------------------------------------------------------------------------ |
| `parseFloorplan(input)`     | Returns a `Floorplan`, or throws a `ZodError`.                            |
| `safeParseFloorplan(input)` | Returns `{ success, data }` or `{ success: false, error }`. Never throws. |
| `cloneFloorplan(plan)`      | Deep copy.                                                                |

<<< @/snippets/guide/floorplan.ts#parse

Schemas allow extra properties, so floorplans written by newer versions, or with your own fields, still parse. `schemaVersion` must be `1`.

## Sample

`SAMPLE_FLOORPLAN` is a two-building venue (the Grand Auditorium and a VIP Lounge, 96 seats in total) for demos and tests.
