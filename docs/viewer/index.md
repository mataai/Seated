# Viewer

`@open-seats/viewer` renders a floorplan as an interactive seat map for customers: seats are coloured by status, can be selected up to a limit, show tooltips, and update live.

## Create a viewer

The container needs a size; the map fits itself inside it and follows resizes.

<<< @/snippets/viewer/basic.ts#create

## Load another floorplan

<<< @/snippets/viewer/basic.ts#load

The viewer never refuses a floorplan. Layout problems are listed in [`viewer.violations`](/guide/layout-rules#in-the-viewer).

## Clean up

<<< @/snippets/viewer/basic.ts#destroy

## Options

| Option                     | Type                       | Default                                  | Description                                                                      |
| :------------------------- | :------------------------- | :--------------------------------------- | :------------------------------------------------------------------------------- |
| `floorplan`                | `Floorplan`                |                                          | Floorplan to render. You can also call `load()` later.                           |
| `statuses`                 | `Record<string, string>`   | `{}`                                     | Initial status per seat id. See [Seat statuses](./statuses).                     |
| `statusDefinitions`        | `SeatStatusDefinition[]`   | available, reserved, locked              | Colours and selectability per status.                                            |
| `defaultStatus`            | `string`                   | `'available'`                            | Status of seats not listed in `statuses`.                                        |
| `maxSelectable`            | `number`                   | unlimited                                | Selection limit; `1` switches to single-seat mode. See [Selection](./selection). |
| `selectedSeatIds`          | `string[]`                 | `[]`                                     | Initially selected seats.                                                        |
| `seatData`                 | `Record<string, SeatData>` | `{}`                                     | Runtime data per seat (prices, tickets). See [Seat data](./seat-data).           |
| `tooltipProvider`          | `TooltipProvider`          |                                          | Async tooltip content. See [Tooltips](./tooltips).                               |
| `tooltipRenderer`          | `TooltipRenderer`          |                                          | Custom tooltip DOM; wins over `tooltipProvider`.                                 |
| `tooltipDebounceMs`        | `number`                   | `150`                                    | Hover delay before a tooltip appears.                                            |
| `statusSource`             | `StatusSource`             |                                          | Live updates, e.g. `socketIoStatusSource(socket)`. See [Live updates](/live/).   |
| `selectedStyle`            | `SelectedStyle`            | blue                                     | Fill and stroke of selected seats. See [Styling](./styling).                     |
| `hoverStyle`               | `HoverStyle`               |                                          | Stroke of the hovered seat.                                                      |
| `showBackground`           | `boolean`                  | `true`                                   | Render the floorplan's blueprint image.                                          |
| `ariaLabel`                | `string`                   | `'Interactive Floorplan Seat Selection'` | Accessible name of the map.                                                      |
| `enableKeyboardNavigation` | `boolean`                  | `true`                                   | Arrow-key navigation and shortcuts. See [Accessibility](./accessibility).        |
| `tolerance`                | `number`                   | `0.01`                                   | Tolerance used when validating the layout.                                       |

## Methods

| Method                                                                          | Description                                     |
| :------------------------------------------------------------------------------ | :---------------------------------------------- |
| `load(floorplan)` / `getFloorplan()`                                            | Replace or read the floorplan.                  |
| `setStatus(id, key)` / `setStatuses(map)` / `getStatus(id)`                     | Seat statuses.                                  |
| `applyStatusSnapshot(map, opts)` / `applyStatusPatch(map, opts)`                | Ordered bulk updates, used by live sources.     |
| `selectSeats(ids)` / `deselectSeats(ids)` / `clearSelection()`                  | Change the selection.                           |
| `getSelectedSeatIds()` / `getSelectedSeats()`                                   | Read the selection.                             |
| `setMaxSelectable(n)` / `getMaxSelectable()`                                    | Selection limit.                                |
| `setSeatData(map, opts)` / `getSeatData(id)`                                    | Runtime seat data.                              |
| `refreshTooltips(ids?)` / `setTooltipRenderer(fn)`                              | Tooltips.                                       |
| `setStatusSource(source)` / `getConnectionState()`                              | Live updates.                                   |
| `zoomIn()` / `zoomOut()` / `resetZoom()` / `panTo()` / `panBy()` / `getScale()` | Viewport.                                       |
| `on(event, fn)` / `off(event, fn)`                                              | [Events](./events).                             |
| `violations`                                                                    | Layout problems found in the current floorplan. |
| `destroy()`                                                                     | Remove everything the viewer added.             |
