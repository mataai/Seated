# @open-seats/editor

Visual floorplan editor and canvas authoring element for OpenSeats.

## Key Features
- **Tools**: Select, Pan, Building (free-form polygon), Zone (non-seating polygon), Row (table with seats on one or both sides), Add Seat (lone seat = one-seat row).
- **Undo / Redo**: Command stack supporting full historical state rollback for all transformations.
- **Strict Invariants**: All modifications, moves, rotations, and reshaping pass through `canPlace()` before committing.
- **Polygon Vertex Editing**: Drag vertices, add vertex on edges, delete vertices (with minimum 3 vertex guard).
- **Reparenting**: Move rows between buildings with automatic coordinate transformations, or transfer seats between rows with ID stability.
- **Preview Mode**: Embeds the viewer directly in the canvas for seamless view/edit toggling.
- **Import / Export**: Clean JSON floorplan export guaranteeing validity.

## Quick Start
```typescript
import { createEditor } from '@open-seats/editor';

const editor = createEditor(document.getElementById('canvas')!);

// Create building and row
const building = editor.createBuilding([
  { x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 400 }, { x: 0, y: 400 }
], 'Arena');

editor.createRow(building.id, { x: 50, y: 80 }, 6);

const plan = editor.getFloorplan();
```
