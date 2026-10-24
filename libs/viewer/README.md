# @open-seats/viewer

Interactive seat selection and reservation viewer element for OpenSeats.

## Key Features

- **Imperative API**: Simple `createViewer(container, options)` with lifecycle `.destroy()`.
- **Selection Management**: Multi-seat selection, `maxSelectable` limits (e.g. single-selection auto-deselect), and selection event streams.
- **Dynamic Statuses**: `setStatuses({ [seatId]: statusKey })` and `setStatus(seatId, key)` for live reservation tracking.
- **Debounced Tooltip Flow**: Built-in floating tooltip with async `tooltipProvider` and per-seat caching.
- **ARIA & Keyboard Navigation**: Full WCAG compliance with 2D arrow-key seat navigation, live announcements, and touch support.
- **Lenient Mode**: Inspects and records layout violations in `viewer.violations` without interrupting rendering.

## Quick Start

```typescript
import { createViewer } from '@open-seats/viewer';

const viewer = createViewer(document.getElementById('map')!, {
  floorplan: myFloorplanJson,
  statuses: { 'seat-1': 'reserved' },
  maxSelectable: 2,
});

viewer.on('selectionChanged', ({ selectedSeatIds }) => {
  console.log('Selected:', selectedSeatIds);
});
```
