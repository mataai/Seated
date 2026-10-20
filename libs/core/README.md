# @open-seats/core

Pure TypeScript schema, geometry, validation, and status registry for the OpenSeats floorplan management system.

## Key Features
- **No DOM, No Konva, Framework-Agnostic**: Pure computational and schema layer.
- **Zod Schema**: Complete runtime schema validation for Floorplans, Buildings, Zones, Rows, and Seats.
- **Geometry & Spatial Math**: Vector transformations, polygon winding normalisation, interior edge crossing checks, point-in-polygon containment, and ear-clipping triangulation.
- **Strict Invariants**: `validateLayout(floorplan)` for full audits and `canPlace(floorplan, nodeId, proposedTransform)` with a 2D spatial grid index for sub-millisecond incremental drag-and-drop checks.
- **Extensible Status Registry**: Configurable seat statuses with safe fallback.
- **Typed Event Emitter**: Zero-dependency typed event dispatch.

## Installation
```bash
npm install @open-seats/core
```
