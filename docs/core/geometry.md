# Geometry

Helpers for working with floorplan coordinates, for example to build a custom renderer, an importer, or a "closest seats to the stage" feature.

## Seats, rows and buildings

<<< @/snippets/core/core.ts#geometry

| Function                                                             | Description                           |
| :------------------------------------------------------------------- | :------------------------------------ |
| `seatPosition(row, seat)`                                            | Seat centre relative to the row.      |
| `seatBuildingPosition(row, seat)`                                    | Seat centre relative to the building. |
| `seatWorldPosition(row, seat, building?)`                            | Seat centre on the canvas.            |
| `rowFootprint(row, building?)`                                       | Outline of the table and its seats.   |
| `buildingFootprint(building)` / `zoneFootprint(zone, building?)`     | Polygon outlines.                     |
| `transformPoint(p, position, rotation)` / `inverseTransformPoint(…)` | Move between local and parent space.  |

## Polygons

`polygonArea`, `polygonCentroid`, `polygonBoundingBox`, `pointInPolygon`, `pointStrictlyInPolygon`, `isValidPolygon`, `isSelfIntersecting`, `polygonsOverlap`, `polygonContains`, `segmentsIntersect`, `triangulate`, `scalePolygon` and `flipPolygon`.

## Vectors

`vec2`, `add`, `sub`, `mul`, `dot`, `cross`, `length`, `normalize`, `dist`, `rotate` (degrees), `rotateRad`, `degToRad`, `radToDeg`, `approxEqual`, `distanceToSegment`.

## Spatial index

For large plans, a grid index finds nearby shapes without checking every one:

<<< @/snippets/core/core.ts#spatial
