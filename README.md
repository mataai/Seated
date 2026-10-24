# OpenSeats / Seated

[![CI](https://github.com/mataai/Seated/actions/workflows/ci.yml/badge.svg)](https://github.com/mataai/Seated/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-blue.svg)](https://www.typescriptlang.org/)
[![Nx Monorepo](https://img.shields.io/badge/Nx-Monorepo-blueviolet.svg)](https://nx.dev)
[![Angular](https://img.shields.io/badge/Angular-19%E2%80%9322-DD0031.svg)](https://angular.dev)

An open-source, framework-agnostic JavaScript/TypeScript suite for **interactive floorplan management and seat reservations**:

1. **Floorplan Editor (`@open-seats/editor`)**: A feature-rich visual designer for authoring and shaping buildings, non-seating zones, tables/rows, and seats with live layout invariant enforcement, vertex manipulation, grid snapping, and undo/redo history.
2. **Reservation Viewer (`@open-seats/viewer`)**: A high-performance canvas rendering engine for seat reservations with instant selection handling, custom status registry, async debounced tooltips, touch pinch-to-zoom/pan, and full screen-reader ARIA live announcements and 2D spatial keyboard navigation.
3. **Framework Wrappers (`@open-seats/angular`)**: First-class standalone components (`<seats-viewer>` and `<seats-editor>`) for modern Angular applications.

---

## Table of Contents

- [Architecture & Monorepo Packages](#architecture--monorepo-packages)
- [Installation](#installation)
- [Core Vocabulary](#core-vocabulary)
- [Quick Start](#quick-start)
  - [1. Viewer (Vanilla TypeScript)](#1-viewer-vanilla-typescript)
  - [2. Editor (Vanilla TypeScript)](#2-editor-vanilla-typescript)
  - [3. Angular Components](#3-angular-components)
- [Key Features](#key-features)
  - [Editor Features](#editor-features)
  - [Viewer Features](#viewer-features)
  - [Accessibility & Keyboard Shortcuts](#accessibility--keyboard-shortcuts)
  - [Layout Invariants & Validation](#layout-invariants--validation)
- [API & Options Reference](#api--options-reference)
  - [Viewer Options & Events](#viewer-options--events)
  - [Editor Options, Tools & Events](#editor-options-tools--events)
  - [Angular Components Reference](#angular-components-reference)
- [Running Demos & Development](#running-demos--development)
- [License](#license)

---

## Architecture & Monorepo Packages

The workspace is organized into modular packages using [Nx](https://nx.dev):

```
libs/
  core/       @open-seats/core       Schema (Zod), 2D geometry, layout invariants, spatial index, typed event emitter
  renderer/   @open-seats/renderer   Konva scene builder, hit-testing, zoom/pan (hidden behind Renderer interface)
  viewer/     @open-seats/viewer     Runtime seat selection, status registry, async tooltip provider, ARIA keyboard flow
  editor/     @open-seats/editor     Tools (building, zone, row, seat), undo/redo command stack, vertex editing, preview mode
  angular/    @open-seats/angular    Angular standalone components: <seats-viewer> and <seats-editor>

apps/
  demo-vanilla/   Interactive Vanilla TS demonstration (theme switcher, live event feed, reservations)
  demo-angular/   Interactive Angular application (ng-demo) demonstrating <seats-viewer> and <seats-editor>
```

---

## Installation

Install only the packages required by your application:

### Vanilla JS / TypeScript

```bash
npm install @open-seats/viewer @open-seats/editor
```

### Angular (19–22)

```bash
npm install @open-seats/angular @open-seats/viewer @open-seats/editor
```

_(Note: `@open-seats/core` and `@open-seats/renderer` are installed automatically as dependencies)._

---

## Core Vocabulary

| Term          | Meaning                                                                                                 |
| :------------ | :------------------------------------------------------------------------------------------------------ |
| **Floorplan** | Root document JSON containing dimensions, background image configuration, and buildings.                |
| **Building**  | A free-form polygon container for zones and rows. Moving a building translates its children.            |
| **Zone**      | A non-seating free-form polygon inside a building (stage, bar, dance floor, aisle, sound booth).        |
| **Row**       | A table or seating line with seats on one or both opposing sides (`tableWidth: 0` for bare seat lines). |
| **Seat**      | An individual seat belonging to a row with a stable ID, label, and coordinates.                         |

---

## Quick Start

### 1. Viewer (Vanilla TypeScript)

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
    content: 'Standard Admission - $45.00',
  }),
});

// Listen to selection changes
viewer.on('selectionChanged', ({ selectedSeatIds, selectedSeats }) => {
  console.log('Selected seat IDs:', selectedSeatIds);
});

// Listen to individual seat selection
viewer.on('seatSelected', (ctx) => {
  console.log('Seat selected:', ctx.seat.id);
});
```

### 2. Editor (Vanilla TypeScript)

```typescript
import { createEditor } from '@open-seats/editor';

const container = document.getElementById('editor-map')!;
const editor = createEditor(container, {
  gridSnapping: { enabled: true, size: 20 },
});

// Create a building polygon
const building = editor.createBuilding(
  [
    { x: 0, y: 0 },
    { x: 800, y: 0 },
    { x: 800, y: 600 },
    { x: 0, y: 600 },
  ],
  'Main Auditorium'
);

// Add a row of seats to the building
const row = editor.createRow(building.id, { x: 100, y: 150 }, 8, {
  side: 'both',
  seatSpacing: 42,
  seatRadius: 14,
  tableWidth: 28,
});

// Toggle preview mode (switches into interactive reservation viewer)
editor.togglePreview();

// Export valid floorplan JSON
const floorplanJson = editor.getFloorplan();
```

### 3. Angular Components

Import the standalone components in your Angular module or component:

```typescript
import { Component } from '@angular/core';
import { SeatsViewerComponent, SeatsEditorComponent } from '@open-seats/angular';
import { SAMPLE_FLOORPLAN, type Floorplan } from '@open-seats/core';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [SeatsViewerComponent, SeatsEditorComponent],
  template: ` <seats-viewer [floorplan]="floorplan" [statuses]="seatStatuses" [maxSelectable]="4" (selectionChanged)="onSelectionChanged($event)" (seatSelected)="onSeatSelected($event)" /> `,
  styles: [
    `
      :host {
        display: block;
        width: 100vw;
        height: 100vh;
      }
    `,
  ],
})
export class BookingComponent {
  floorplan: Floorplan = SAMPLE_FLOORPLAN;
  seatStatuses: Record<string, string> = {
    's-a-1a': 'reserved',
    's-a-1b': 'locked',
  };

  onSelectionChanged(event: { selectedSeatIds: string[] }) {
    console.log('Current selection:', event.selectedSeatIds);
  }

  onSeatSelected(ctx: any) {
    console.log('Selected:', ctx.seat.label);
  }
}
```

---

## Key Features

### Editor Features

- **Tools**: `select`, `pan`, `building` (draw polygon), `zone` (draw non-seating area), `row` (place table/row), `add-seat`.
- **Row Configuration**: Single-sided or double-sided (`both`), customizable seat spacing, seat radius, table width, label numbering.
- **Vertex Editing**: Directly drag polygon vertices to reshape buildings and zones.
- **History Stack**: Robust Undo (`Ctrl+Z`) and Redo (`Ctrl+Shift+Z` / `Ctrl+Y`) tracking all mutations.
- **Grid Snapping**: Configurable grid alignment for clean layouts.
- **Embedded Preview**: Seamlessly toggle between editing mode and viewer reservation mode.

### Viewer Features

- **Selection Handling**: Single and multi-seat selection with configurable `maxSelectable`.
- **Status Registry**: Map seat statuses (e.g. `available`, `reserved`, `locked`, `vip`) with custom colors and selectable flags.
- **Async Tooltips**: Built-in debounced tooltip resolver supporting async data fetching (e.g., live pricing or seat views).
- **Navigation**: Touch pinch-to-zoom, mouse wheel zoom, pan dragging, and keyboard navigation.

### Accessibility & Keyboard Shortcuts

The viewer strictly implements ARIA accessibility standards:

- **Container Semantics**: `role="application"`, `aria-label="Interactive Floorplan Seat Selection"`, and `tabindex="0"`.
- **Live Announcements**: An `aria-live="polite"` region automatically announces seat focus, row details, status, and selection state to screen readers.
- **Spatial 2D Arrow Navigation**: Press `ArrowUp`, `ArrowDown`, `ArrowLeft`, or `ArrowRight` to jump focus to the spatially nearest seat in that direction.
- **Tab / Shift+Tab**: Sequential seat focus cycling.
- **Space / Enter**: Toggle selection of the currently focused seat.
- **Escape**: Clear current selection.
- **`+` / `-`**: Zoom in and zoom out.
- **`0`**: Reset zoom level.
- **Shift + Arrow Keys**: Pan floorplan view.

#### Editor Shortcuts

| Shortcut                  | Action                                       |
| :------------------------ | :------------------------------------------- |
| `Ctrl+Z` / `Cmd+Z`        | Undo                                         |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo                                         |
| `Delete` / `Backspace`    | Delete selected building, zone, row, or seat |
| `Escape`                  | Clear current selection                      |

### Layout Invariants & Validation

Strict layout invariants are enforced in the editor via `canPlace()` and validated via `validateLayout()`:

1. **Buildings must not overlap** with other buildings.
2. **Zones must not overlap** other zones or rows within a building.
3. **Rows must not overlap** other rows or zones within a building.
4. **Seats in a row must not overlap** (`seatSpacing >= 2 * seatRadius`).
5. **Rows and zones must lie strictly inside their parent building** (concave polygons and L-shaped bridging are properly rejected).
6. **Polygons must be valid** (≥3 points, non-zero area, no self-intersections).

Touching edges within configured tolerance (default `0.01`) are permitted.

---

## API & Options Reference

### Viewer Options & Events

#### `ViewerOptions`

| Option                     | Type                     | Description                                                             |
| :------------------------- | :----------------------- | :---------------------------------------------------------------------- |
| `floorplan`                | `Floorplan`              | The floorplan JSON object to render.                                    |
| `statuses`                 | `Record<string, string>` | Map of seat IDs to status names (e.g. `'reserved'`, `'booked'`).        |
| `statusDefinitions`        | `SeatStatusDefinition[]` | Custom status configurations (colors, selectability).                   |
| `maxSelectable`            | `number`                 | Maximum number of seats selectable simultaneously.                      |
| `selectedSeatIds`          | `string[]`               | Initial pre-selected seat IDs.                                          |
| `tooltipProvider`          | `TooltipProvider`        | Async function returning tooltip title, subtitle, or content.           |
| `tooltipDebounceMs`        | `number`                 | Debounce delay in ms before showing tooltip (default: `150`).           |
| `enableKeyboardNavigation` | `boolean`                | Enable spatial 2D arrow navigation and accessibility (default: `true`). |

#### `ViewerEvents`

- `ready`: Viewer initialized and ready.
- `seatHovered` / `seatHoverEnded`: Triggered when pointer moves over/off a seat.
- `seatSelected` / `seatDeselected`: Triggered when an individual seat is clicked or selected via keyboard.
- `selectionChanged`: Emitted whenever the selection changes, providing `selectedSeatIds` and `selectedSeats`.
- `floorplanLoaded`: Emitted when a new floorplan JSON is loaded.
- `violationsUpdated`: Emitted when layout violations are detected.

---

### Editor Options, Tools & Events

#### `EditorOptions`

| Option         | Type                                      | Description                                      |
| :------------- | :---------------------------------------- | :----------------------------------------------- |
| `floorplan`    | `Floorplan`                               | Initial floorplan data to load.                  |
| `rules`        | `{ enforce: boolean; tolerance: number }` | Layout invariant enforcement settings.           |
| `gridSnapping` | `{ enabled: boolean; size: number }`      | Grid snapping toggle and grid spacing in pixels. |

#### `EditorTools`

- `'select'`: Select, move, and edit elements or vertices.
- `'pan'`: Pan the canvas without selecting elements.
- `'building'`: Click to add vertices and create building polygons.
- `'zone'`: Click to draw non-seating zones inside buildings.
- `'row'`: Click to place seating rows/tables.
- `'add-seat'`: Append seats to existing rows.

#### `EditorEvents`

- `change`: Emitted with the updated `Floorplan` after any modification.
- `toolChange`: Emitted when active tool changes.
- `selectionChange`: Emitted with an array of selected element IDs.
- `previewToggle`: Emitted when preview mode is entered or exited.
- `violationsUpdated`: Emitted with current layout violations.

---

### Angular Components Reference

#### `<seats-viewer>`

- **Inputs**:
  - `[floorplan]`: `Floorplan`
  - `[statuses]`: `Record<string, string>`
  - `[maxSelectable]`: `number`
  - `[options]`: `Partial<ViewerOptions>`
- **Outputs**:
  - `(ready)`
  - `(seatHovered)`
  - `(seatHoverEnded)`
  - `(seatSelected)`
  - `(seatDeselected)`
  - `(selectionChanged)`
  - `(floorplanLoaded)`
  - `(violationsUpdated)`

#### `<seats-editor>`

- **Inputs**:
  - `[floorplan]`: `Floorplan`
  - `[tool]`: `ToolType` (default `'select'`)
  - `[options]`: `Partial<EditorOptions>`
- **Outputs**:
  - `(change)`: Emits updated `Floorplan`
  - `(toolChange)`: Emits active `ToolType`
  - `(selectionChange)`: Emits selected element IDs
  - `(previewToggle)`: Emits preview boolean flag
  - `(violationsUpdated)`: Emits layout violations

---

## Running Demos & Development

### Start the Angular Demo Application

```bash
npm start
# or
npx nx serve ng-demo
```

Access the application at [http://localhost:4200](http://localhost:4200).

### Start the Vanilla TypeScript Demo

```bash
npx nx serve demo-vanilla
```

Access the application at [http://localhost:5173](http://localhost:5173).

### Run All Unit Tests

```bash
npx nx run-many -t test
```

### Build All Packages and Applications

```bash
npx nx run-many -t build
```

### Run Code Quality & Lint Checks

```bash
npx nx run-many -t lint
```

---

## License

This project is licensed under the [GNU General Public License v3.0 (GPLv3)](LICENSE).
