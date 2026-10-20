# OpenSeats / Seated

An open-source, framework-agnostic JavaScript/TypeScript library replacing Seats.io for **floorplan management only**:

1. **Editor**: A full-featured floorplan designer for creating, reshaping, and modifying buildings, zones, rows, and seats with strict layout invariant enforcement and undo/redo support.
2. **Viewer**: A lightweight, high-performance rendering engine for seat reservations with selection management, custom seat statuses, async debounced tooltips, touch pinch-to-zoom, and full ARIA / keyboard accessibility.

First-class targets: **Vanilla JS / TypeScript (no framework)** and **Angular 19+**.

---

## Architecture & Packages

```
libs/
  core/       @open-seats/core       Schema (Zod), geometry, layout invariants, spatial index, typed event emitter
  renderer/   @open-seats/renderer   Konva scene builder, hit-testing, zoom/pan (hidden behind Renderer interface)
  viewer/     @open-seats/viewer     Runtime seat selection, status registry, async tooltip provider, ARIA keyboard flow
  editor/     @open-seats/editor     Tools (building, zone, row, seat), undo/redo command stack, vertex editing, preview mode
  angular/    @open-seats/angular    Angular standalone components: <seats-viewer> and <seats-editor>

apps/
  demo-vanilla/   Interactive Vanilla TS demonstration (theme switcher, live event feed, reservations)
  demo-angular/   Interactive Angular 19 application demonstrating <seats-viewer> and <seats-editor>
```

### Installation

Consumers only install the surface packages they need:

#### Vanilla JS / TypeScript
```bash
npm install @open-seats/viewer @open-seats/editor
```

#### Angular
```bash
npm install @open-seats/angular @open-seats/viewer @open-seats/editor
```

---

## Core Vocabulary

| Term | Meaning |
| :--- | :--- |
| **Floorplan** | Root document JSON containing dimensions, background, and buildings. |
| **Building** | A free-form polygon container for zones and rows. |
| **Zone** | A non-seating free-form polygon inside a building (stage, bar, aisle, sound booth). |
| **Row** | A table body with seats on one or both opposing sides (`tableWidth: 0` for bare seat lines). |
| **Seat** | An individual seat belonging to a row with a stable ID and label. |

---

## Quick Start: Viewer (Vanilla TypeScript)

```typescript
import { createViewer } from '@open-seats/viewer';
import auditoriumPlan from './samples/grand-auditorium.json';

const container = document.getElementById('seat-map')!;

const viewer = createViewer(container, {
  floorplan: auditoriumPlan,
  statuses: {
    's-a-1a': 'reserved',
    's-a-1b': 'locked',
  },
  maxSelectable: 4,
  tooltipProvider: async (ctx) => ({
    title: `Seat ${ctx.seat.label}`,
    subtitle: `Row ${ctx.row.label} • ${ctx.building.label}`,
    content: 'Standard Admission',
  }),
});

viewer.on('selectionChanged', ({ selectedSeatIds, selectedSeats }) => {
  console.log('Selected seats:', selectedSeatIds);
});

viewer.on('seatSelected', (ctx) => {
  console.log('Reserved:', ctx.seat.id);
});
```

---

## Quick Start: Editor (Vanilla TypeScript)

```typescript
import { createEditor } from '@open-seats/editor';

const container = document.getElementById('editor-map')!;

const editor = createEditor(container);

// Draw or create elements
const building = editor.createBuilding([
  { x: 0, y: 0 },
  { x: 800, y: 0 },
  { x: 800, y: 600 },
  { x: 0, y: 600 },
], 'Main Hall');

const row = editor.createRow(building.id, { x: 100, y: 150 }, 8, {
  side: 'both',
  seatSpacing: 42,
  seatRadius: 14,
  tableWidth: 28,
});

// Toggle preview mode embedding the viewer
editor.togglePreview();

// Export valid floorplan JSON
const floorplanJson = editor.getFloorplan();
```

---

## Quick Start: Angular 19+

Import the standalone components:

```typescript
import { Component } from '@angular/core';
import { SeatsViewerComponent, SeatsEditorComponent } from '@open-seats/angular';
import { SAMPLE_FLOORPLAN } from '@open-seats/core';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [SeatsViewerComponent, SeatsEditorComponent],
  template: `
    <seats-viewer
      [floorplan]="floorplan"
      [statuses]="seatStatuses"
      [maxSelectable]="2"
      (selectionChanged)="onSelectionChanged($event)"
      (seatSelected)="onSeatSelected($event)"
    />
  `,
  styles: [`
    :host { display: block; width: 100vw; height: 100vh; }
  `],
})
export class BookingComponent {
  floorplan = SAMPLE_FLOORPLAN;
  seatStatuses = { 's-a-1a': 'reserved' };

  onSelectionChanged(event: any) {
    console.log('Current selection:', event.selectedSeatIds);
  }

  onSeatSelected(ctx: any) {
    console.log('Selected:', ctx.seat.label);
  }
}
```

---

## Accessibility & Keyboard Navigation

The viewer implements ARIA standards for interactive maps and screen readers:

- **Container Semantics**: `role="application"`, `aria-label="Interactive Floorplan Seat Selection"`, and `tabindex="0"`.
- **Live Announcements**: An `aria-live="polite"` region automatically announces seat focus, row details, status, and selection changes.
- **Arrow Keys** (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`): 2D spatial navigation to the nearest seat in that direction.
- **Tab / Shift+Tab**: Sequential seat focus cycle.
- **Space / Enter**: Toggle selection on the focused seat.
- **Escape**: Clear active selection.
- **`+` / `-`**: Zoom in and zoom out.
- **`0`**: Reset zoom.
- **Shift + Arrow Keys**: Pan the floorplan view.

### Editor Keyboard Shortcuts
- **`Ctrl+Z` / `Cmd+Z`**: Undo.
- **`Ctrl+Shift+Z` / `Ctrl+Y`**: Redo.
- **`Delete` / `Backspace`**: Delete selected node.
- **`Escape`**: Clear node selection.

---

## Layout Invariants & Validation

Strict layout invariants are enforced in the editor via `canPlace()` and validated in full via `validateLayout()`:

1. **Buildings must not overlap**.
2. **Zones must not overlap** within a building.
3. **Rows must not overlap** within a building.
4. **Zones and rows must not overlap** within a building.
5. **Seats in a row must not overlap** (`seatSpacing >= 2 * seatRadius`).
6. **Rows and zones must lie fully inside their parent building** (concave polygons and L-shaped bridging are properly rejected).
7. **Polygons must be valid** (≥3 points, non-zero area, no self-intersections).

Touching edges within tolerance (default `0.01`) are valid.

---

## Running the Applications

### Run the Vanilla TS Demo
```bash
npx nx serve demo-vanilla
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Run the Angular Demo
```bash
npx nx serve ng-demo
```
Open [http://localhost:4200](http://localhost:4200) in your browser.

### Run All Tests
```bash
npx nx run-many -t test
```

### Build All Packages and Apps
```bash
npx nx run-many -t build
```

---

## License

MIT
