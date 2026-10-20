# Seated / OpenSeats: Project Plan

> Audience: coding agents working in this repository. Read the whole document before starting a task. Sections marked **DECIDED** are settled; do not re-litigate them. Sections marked **ASSUMED** were inferred and should be confirmed with the maintainer before building on them.

## 1. Goal

A JavaScript/TypeScript library replacing Seats.io for **floorplan management only**:

1. An **editor** element that edits a floorplan on a canvas and exports/imports it as JSON.
2. A **viewer** element that renders the same JSON for seat reservation. The host website receives events about seat selection and hovering, and can supply extra info for a hovered seat.

The library is framework-agnostic. First-class targets: **vanilla JS (no framework)** and **Angular**.

### Out of scope (left to the library consumer) **DECIDED**

Pricing, categories, general admission, holds/expiry, bookings, any backend. The library only manages the floorplan, displays seat statuses the host supplies, and emits events.

## 2. Current state of the repo

- Nx workspace: `libs/open-seats-core`, `apps/open-seats-demo` (Angular). Repo is named "Seated", packages are `@open-seats/*`.
- Stack: TypeScript, **Konva**, **RxJS**. Tests: Vitest config exists **and** Jest config exists (remove Jest).
- Existing core (`libs/open-seats-core/src/lib`): `Seated` facade (typo'd file `steated.ts`), `SeatMediator` (event wiring plus collision/snapping, ~247 lines), `KonvaMediator` (stage, layer, wheel zoom, pan), `EngineState` (RxJS BehaviorSubjects), `SeatFactory`/`TableFactory`, `Seat` (Konva.Circle), `Table` (Konva.Rect), and `save-data.ts`.
- Old save format (to be **dropped**, no real data exists, no migration needed):
  `{ dimentions, seats: [...], tables: [...] }`, with seats as free-floating circles.
- The existing collision/snapping logic (`_tableClipChecking`, `_seatClipChecking`) exists because seats were placed freely. In the new row-based model seats cannot overlap by construction, so **delete this logic rather than refactor it**.
- 11 open issues (old user stories), mapped in section 9.

## 3. Vocabulary **DECIDED**

| Term          | Meaning                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| **Floorplan** | Root document.                                                                                              |
| **Building**  | A free-form polygon area. (Old issues called this "area".)                                                  |
| **Zone**      | A non-seating free-form polygon inside a building (stage, bar, aisle, label). **Not** a container for rows. |
| **Row**       | A table: a body with seats on one or both opposing sides. (Old issues called this "table".)                 |
| **Seat**      | A single seat belonging to a row.                                                                           |

Use exactly these names in code, docs, and UI. Do **not** use "table" or "area" anywhere in new code.

## 4. Architecture

### 4.1 Packages (Nx libs)

```
libs/
  core/       # schema, types, validation, geometry, status registry, event emitter. NO DOM, NO Konva.
  renderer/   # Konva scene building, pan/zoom, hit-testing, hover. Shared by viewer and editor. Konva hidden behind a Renderer interface.
  viewer/     # @open-seats/viewer: statuses, selection, tooltip flow, events
  editor/     # @open-seats/editor: tools, undo/redo, import/export
  angular/    # @open-seats/angular: <seats-viewer>, <seats-editor> (ng-packagr)
apps/
  demo-vanilla/   # NEW: proves the no-framework path
  demo-angular/   # existing open-seats-demo
```

**Install story DECIDED:** users install only `@open-seats/viewer` (viewing), `@open-seats/editor` (editing), and `@open-seats/angular` (if using Angular). `core` and `renderer` are ordinary transitive dependencies. `angular` lists viewer/editor as peer dependencies.

### 4.2 Principles

- **Viewer and editor are separate bundles** (viewer stays small). The editor embeds the viewer for a "preview" mode, which satisfies the "toggle view/edit" user story.
- **Konva stays** for now, but only `renderer` may import it. If 10k+ seat performance needs it later, rows can be drawn with a custom Konva `sceneFunc` or raw Canvas without touching other packages.
- **Imperative framework-agnostic API:** `createViewer(container, options)` / `createEditor(container, options)` return an instance with `destroy()`. Framework wrappers stay thin.
- **No RxJS in core/viewer/editor public APIs.** Use a tiny typed event emitter. The Angular wrapper may expose Observables.
- **Statuses are never stored in the schema.** The host supplies them at runtime.

## 5. Data model (schema v1) **DECIDED**

Child coordinates are **relative to their parent** (so moving a building moves its contents).

```ts
type Vec2 = { x: number; y: number };

interface Floorplan {
  schemaVersion: 1; // keep from day one
  dimensions: { width: number; height: number };
  background?: {
    src: string; // URL or data URI
    position?: Vec2;
    scale?: number;
    opacity?: number;
    locked?: boolean; // not selectable/draggable while editing
  };
  buildings: Building[];
}

interface Building {
  id: string;
  label: string;
  position: Vec2;
  rotation: number;
  points: Vec2[]; // free-form polygon, local to position
  zones: Zone[];
  rows: Row[];
  data?: Record<string, unknown>; // consumer payload
}

interface Zone {
  // non-seating region, no status
  id: string;
  position: Vec2;
  rotation: number;
  points: Vec2[]; // free-form polygon, relative to building
  fill: string;
  stroke?: string;
  opacity?: number;
  text?: {
    value: string;
    color?: string;
    fontSize?: number;
    fontFamily?: string;
    align?: 'left' | 'center' | 'right';
    offset?: Vec2; // relative to polygon centroid
  };
  data?: Record<string, unknown>;
}

interface Row {
  // a "table"
  id: string;
  label: string;
  position: Vec2;
  rotation: number; // relative to building
  side: 'one' | 'both'; // seats on one side, or on two opposing sides
  seatSpacing: number; // distance between seat centres along the row
  seatRadius: number;
  tableWidth: number; // table body thickness; 0 = bare line of seats
  tableStyle?: { fill?: string; stroke?: string; strokeWidth?: number; cornerRadius?: number };
  seats: Seat[];
  data?: Record<string, unknown>;
}

interface Seat {
  id: string; // stable forever: hosts reserve against this
  index: number; // slot along the row
  side: 'a' | 'b'; // 'b' only valid when row.side === 'both'
  label: string; // e.g. "A-1-3", shown to users
  data?: Record<string, unknown>;
}
```

### Why seats are records, not purely derived

Seat **positions** are derived from the row (index and side), so rows stay small and cannot contain overlapping seats. But each seat keeps its own record so its `id` stays stable when other seats are deleted or renumbered. Absent indexes simply mean a gap.

### Row geometry

The row axis runs through the centre of the table body.

- Seat position along the axis: `index * seatSpacing`.
- Seat `a` sits at `-(tableWidth/2 + seatRadius)` across the axis; seat `b` at `+(tableWidth/2 + seatRadius)`. One-sided rows use only `a`. Opposing seats share an `index`.
- Table body length: `maxIndex * seatSpacing + 2 * seatRadius`.
- **Row footprint** (used by every overlap/containment check): rotated rectangle covering body plus seats. Width is `tableWidth + 2r` for one side, `tableWidth + 4r` for both.
- **ASSUMED, confirm with maintainer:** every row draws the same table body regardless of `side` (the maintainer said "tables should have the same style if they have side both or single"). One-sided and two-sided rows look identical except for the missing seat line; `tableWidth: 0` means no visible body.

### Schema validation

- Use Zod or Valibot (pick one, keep it consistent); export inferred types.
- Refinement: seats with `side: 'b'` are only valid when `row.side === 'both'`.
- Unknown optional fields must be tolerated on load (forward compatibility, for example future zone seating).

## 6. Layout invariants **DECIDED**

| #   | Rule                                                  | Scope                                          |
| --- | ----------------------------------------------------- | ---------------------------------------------- |
| 1   | Buildings must not overlap                            | Between buildings                              |
| 2   | Zones must not overlap                                | Within a building                              |
| 3   | Rows (tables, including their seats) must not overlap | Within a building                              |
| 4   | Zones and rows must not overlap                       | Within a building                              |
| 5   | Seats in a row must not overlap                       | `seatSpacing >= 2 * seatRadius`                |
| 6   | Rows and zones must lie fully inside their building   | Containment                                    |
| 7   | Polygons are valid                                    | ≥3 points, non-zero area, no self-intersection |

Consequences:

- Because of rules 1 and 6, **cross-building checks are never needed** except building vs building. Check zones/rows only against siblings in the same building.
- **Touching edges are valid.** All tests use a tolerance (default `0.01` units, configurable).
- Containment in a concave building is **not** just "all vertices inside". Also require that no edge of the inner shape crosses an edge of the outer one (an L-shaped building must reject a row that bridges the notch). Holes in polygons are not supported in v1.
- Normalise polygon winding on load.

### API (in `core`)

```ts
interface Violation {
  rule: 'building-overlap' | 'zone-overlap' | 'row-overlap'
      | 'zone-row-overlap' | 'seat-overlap' | 'out-of-bounds' | 'invalid-polygon';
  ids: string[];
}
validateLayout(floorplan, opts?: { tolerance?: number }): Violation[]      // full check: load/export
canPlace(floorplan, nodeId, proposedTransform, opts?): Violation[]          // incremental: moves/edits in the editor
```

`canPlace` checks only the moved node against its siblings (via a grid spatial index) and its container. Never revalidate the whole plan per mouse move.

### Behaviour by mode

- **Editor: strict.** Invalid moves/resizes/rotations/seat-count changes/`side` toggles are rejected (node returns to its last valid state); show a red outline on offenders while dragging. Every undo-stack command must leave the plan valid, so an editor-exported file is always valid.
- **Viewer/import: lenient.** Render whatever is loaded; expose `viewer.violations` and let the host decide.
- Config: `rules: { enforce: boolean; tolerance: number }`, with enforcement on by default. No per-rule toggles for now.

## 7. Statuses **DECIDED**

An extensible registry, not an enum. Statuses live in the viewer and are supplied by the host.

```ts
interface SeatStatusDefinition {
  key: string; // 'available' | 'reserved' | 'locked' | any custom key
  label?: string;
  style: { fill: string; stroke?: string; opacity?: number; icon?: string };
  selectable: boolean;
  hoverable?: boolean;
}
const DEFAULT_STATUSES = [
  { key: 'available', style: { fill: '#4caf50' }, selectable: true },
  { key: 'reserved', style: { fill: '#9e9e9e' }, selectable: false },
  { key: 'locked', style: { fill: '#f44336' }, selectable: false },
];
createViewer(el, { statuses: [...DEFAULT_STATUSES, customStatus], defaultStatus: 'available' });
viewer.setStatuses({ 'seat-id-1': 'reserved' }); // also setStatus(seatId, key)
```

- "Selected" is a **UI state with its own style**, not a status.
- Unknown status keys render with a fallback style and log a warning. They must never throw.
- Statuses never apply to zones.

## 8. Viewer and editor behaviour

### Viewer

- `load(floorplan)`, `setStatuses`, `setStatus`, `selectSeats`, `clearSelection`, `maxSelectable`, pan/zoom (mouse and touch pinch), `destroy()`.
- Events: `ready`, `seatHovered`, `seatHoverEnded`, `seatSelected`, `seatDeselected`, `selectionChanged`. Payload includes `{ seat, row, building }`.
- **Hover → more info flow:** option `tooltipProvider: (ctx) => Promise<TooltipInfo>` with debounce and a per-seat cache. The raw `seatHovered` event remains for hosts that prefer to handle it themselves.

### Editor

- Tools: select, pan, create building (polygon), create zone (polygon), draw row (click-drag; drag length ÷ spacing gives seat count), add seat to a row.
- **A "single seat" is a one-seat row.** There are no loose seats; "add seat" on empty canvas creates a one-seat row.
- Vertex editing for buildings/zones (drag vertex, add vertex on edge, delete vertex). No resize handles on polygons.
- Reparenting: move a row into another building (apply the coordinate transform first, then validate containment at the drop position, otherwise reject). Move a seat into another row (keeps its `id`, gets a new index/label).
- Reject any building reshape that would push a child out of bounds. Do not clip or auto-move children.
- Toggling row `side` or changing `tableWidth`/`seatCount` goes through `canPlace`.
- Multi-select, move, rotate, grid snapping, alignment guides.
- **Undo/redo through a command stack. Build this before adding many tools.**
- Numbering schemes (for example letters for rows, numbers for seats; separate prefixes or continuation across sides `a`/`b`) with **ID stability on edits**.
- Background image setter. API: `getFloorplan()`, `loadFloorplan()`, `change` event.
- Preview mode embeds the viewer.

### Angular wrapper

- `<seats-viewer>` and `<seats-editor>`. Inputs: floorplan, statuses, options. Outputs: one per library event.
- Create library instances inside `ngZone.runOutsideAngular()`; re-enter the zone only when emitting events. Call `destroy()` in `ngOnDestroy`.
- Build with `@nx/angular` / ng-packagr.

## 9. Mapping of existing issues

| Old issue                               | New work                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| View-only or edit mode                  | Separate viewer/editor bundles; editor has a preview mode embedding the viewer |
| Set a background image                  | `Floorplan.background` plus a background layer and editor setter               |
| Import / Export the floorplan           | `loadFloorplan()` / `getFloorplan()` plus `validateLayout`                     |
| Set/change the status of a seat         | `viewer.setStatuses()` / `setStatus()` and the status registry                 |
| Host application aware of selected item | `selectionChanged` and related events                                          |
| Assign tables to areas                  | Move a **row** into a **building** (with coordinate transform and validation)  |
| Assign a seat to a table                | Move a **seat** into another **row**                                           |
| Create an area                          | Create a **building** tool                                                     |
| Create tables                           | **Row** tool                                                                   |
| Create a seat                           | Add seat to a row (lone seat = one-seat row)                                   |

**Not covered by old issues (new work):** zone tool (polygon, color, text), the overlap/containment rules, and the hover tooltip flow.

## 10. Phases

### Phase 0: housekeeping

- [ ] Decide the final name (repo "Seated" vs packages "open-seats") and rename folders/packages consistently. **Maintainer decision.**
- [ ] Remove Jest config/preset; standardise on Vitest.
- [ ] Rename `steated.ts`. Fix the `dimentions` typo (the field is replaced anyway).
- [ ] Triage the 11 issues using section 9 (close, relabel, or rewrite in the new vocabulary).
- [ ] Add `apps/demo-vanilla`; rename the Angular demo.

### Phase 1: `core` (no DOM, no Konva)

1. Types plus Zod/Valibot schema (section 5), including the `side` refinement.
2. Geometry primitives: Vec2 math, transform composition (local↔world), polygon area/centroid, winding normalisation, point-in-polygon, segment intersection, self-intersection detection.
3. Footprints: `rowFootprint`, `buildingFootprint`, `zoneFootprint`, and `seatPosition(row, seat)`.
4. `polygonsOverlap(a, b, tol)` (bounding-box reject → edge-crossing test → containment in both directions) and `polygonContains(outer, inner, tol)` (all vertices inside **and** no edge crossings).
5. `validateLayout()` and `canPlace()` with a grid spatial index.
6. Status registry with `DEFAULT_STATUSES` and the unknown-key fallback.
7. Typed event emitter (replaces RxJS).
8. **Tests (Vitest):**
   - touching edges are valid; row exactly filling a building is valid
   - L-shaped building: row bridging the notch is rejected
   - concave zone: row inside the bounding box but outside the polygon is valid
   - rotated rows; one-sided vs two-sided footprints; `tableWidth: 0`
   - bow-tie (self-intersecting) polygon → `invalid-polygon`
   - `seatSpacing < 2 * seatRadius` → `seat-overlap`
   - seat `b` in a one-sided row → schema error
   - unknown status key → fallback, no throw
   - polygon fully inside another with no edge crossings → overlap detected

### Phase 2: `renderer`

1. Extract stage, layer, and wheel zoom/pan from `KonvaMediator`.
2. Scene builder: floorplan → background, buildings → zones (under rows) → rows (table body plus seats). Nested Konva groups using relative coordinates.
3. Hit-testing and hover/click dispatch resolving to `{ seat, row, building }`.
4. Status styling, background image layer, devicePixelRatio handling, touch pinch zoom.
5. Define the `Renderer` interface; nothing outside this package imports Konva.

### Phase 3: `viewer`

- `createViewer`, `load`, statuses, selection and `maxSelectable`, the full event list, tooltip provider, `violations`, `destroy()`.

### Phase 4: `editor`

- Command stack (undo/redo) first, then tools in the order: select/pan → building → row → zone → add seat → reparenting → numbering → background → import/export.
- Strict rule enforcement through `canPlace` throughout.

### Phase 5: `angular`

- Wrapper components, zone handling, demo-angular integration.

### Phase 6: hardening and release

- Performance with 10k–20k seats (spatial index, viewport culling, layered canvases; evaluate the custom row `sceneFunc` renderer).
- `nx release`, API docs, a sample floorplan JSON, keyboard/ARIA accessibility pass.

## 11. Conventions for agents

- Work **one phase at a time**, in order. Phase 1 has no dependencies and can start immediately.
- `core` must not import DOM or Konva. Only `renderer` imports Konva.
- Every geometry/validation function needs unit tests before it is used elsewhere.
- Keep public APIs imperative and framework-agnostic; framework code lives only in `angular`.
- Do not store runtime state (statuses, selection) in the floorplan JSON.
- Do not add pricing, categories, holds, or backend concepts.
- Do not add loose seats (seats not in a row) or hole-in-polygon support.
- When a requirement is unclear or marked **ASSUMED**, ask the maintainer instead of guessing.

## 12. Open items for the maintainer

1. Final project/package name.
2. Confirm the table-body interpretation in section 5 (every row has a body of thickness `tableWidth`, possibly 0, and one-sided rows place their single seat line beside it).
3. Confirm that zones must also lie fully inside their building (assumed yes, from "zones live in buildings").
4. Choose Zod vs Valibot.
