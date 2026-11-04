# `<seats-viewer>`

## Seat picker

<<< @/snippets/angular/viewer.component.ts#component

Changing `[statuses]` merges the new values into the viewer, and `[floorplan]` reloads the map.

## Live updates

<<< @/snippets/angular/live.component.ts#live

`[statusSource]` wins over `options.statusSource`. Once you've given it a value, including `null` to disconnect, `options.statusSource` is ignored.

## Inputs

| Input              | Type                       | Description                                                                   |
| :----------------- | :------------------------- | :---------------------------------------------------------------------------- |
| `floorplan`        | `Floorplan`                | Floorplan to render; changes reload it.                                       |
| `statuses`         | `Record<string, string>`   | Seat statuses; changes are merged in.                                         |
| `seatData`         | `Record<string, SeatData>` | App [seat data](/viewer/seat-data); replaces the previous app data on change. |
| `maxSelectable`    | `number`                   | Selection limit.                                                              |
| `statusSource`     | `StatusSource \| null`     | [Live updates](/live/).                                                       |
| `tooltipComponent` | `Type<unknown>`            | Component used as the tooltip. See [Custom tooltips](./tooltips).             |
| `options`          | `Partial<ViewerOptions>`   | Any other [viewer option](/viewer/#options), read at creation.                |

## Outputs

`ready`, `seatHovered`, `seatHoverEnded`, `seatSelected`, `seatDeselected`, `selectionChanged`, `floorplanLoaded`, `violationsUpdated`, `statusesChanged`, `seatDataChanged`, `selectionInvalidated`, `connectionStateChanged`. Payloads are the same as the [viewer events](/viewer/events).

## Methods

`selectSeats`, `deselectSeats`, `clearSelection`, `setStatus`, `setStatuses`, `getStatus`, `setSeatData`, `getSeatData`, `getSelectedSeatIds`, `getSelectedSeats`, `getConnectionState`, `zoomIn`, `zoomOut`, `resetZoom`, `panTo`, `panBy`, and the `violations` getter.
