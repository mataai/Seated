# Core

`@open-seats/core` has the floorplan model and the logic shared by the viewer and editor. It has no DOM dependency, so you can also use it on your server, for example to validate floorplans before saving them.

```sh
npm install @open-seats/core
```

| Area                         | Exports                                                                                                            |
| :--------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| [Schema & parsing](./schema) | `Floorplan` types, `FloorplanSchema`, `parseFloorplan`, `safeParseFloorplan`, `cloneFloorplan`, `SAMPLE_FLOORPLAN` |
| [Validation](./validation)   | `validateLayout`, `canPlace`, `Violation`                                                                          |
| [Geometry](./geometry)       | Vector helpers, polygon tests, footprints, `GridSpatialIndex`                                                      |
| Statuses                     | `StatusRegistry`, `DEFAULT_STATUSES`                                                                               |
| Events                       | `TypedEventEmitter`                                                                                                |

## Statuses

The viewer resolves seat colours through a `StatusRegistry`. You can use it to build a legend that matches the map:

<<< @/snippets/core/core.ts#statuses
