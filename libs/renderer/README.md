# @open-seats/renderer

The 2D canvas scene builder and hit-testing engine for OpenSeats, wrapping Konva behind a framework-agnostic `Renderer` interface.

## Key Features

- **Strict Abstraction**: Konva is never exposed outside of `@open-seats/renderer`.
- **Scene Hierarchy**: Nested groups using relative coordinates (Stage -> Background Layer -> Scene Layer -> Buildings -> Zones & Rows -> Seats).
- **Smooth Interactions**: Pointer-centered mouse wheel zoom, touch pinch-to-zoom, pan, hit-testing, and hover/click dispatch.
- **Dynamic Resize**: Responsive ResizeObserver tracking host container dimensions.
- **Status & Selection Styling**: Renders selectable, reserved, locked, and custom status visual styles.

## Installation

```bash
npm install @open-seats/renderer
```
