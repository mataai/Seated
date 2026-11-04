# Events

<<< @/snippets/viewer/events.ts#subscribe

## All events

<<< @/snippets/viewer/events.ts#all

| Event                             | Payload                                | When                                                                 |
| :-------------------------------- | :------------------------------------- | :------------------------------------------------------------------- |
| `ready`                           |                                        | The first render finished.                                           |
| `floorplanLoaded`                 | `Floorplan`                            | A floorplan was loaded.                                              |
| `violationsUpdated`               | `Violation[]`                          | Layout problems were found in the loaded floorplan.                  |
| `seatHovered` / `seatHoverEnded`  | `RenderSeatContext`                    | Pointer or keyboard focus entered / left a seat.                     |
| `seatSelected` / `seatDeselected` | `RenderSeatContext`                    | A single seat was selected / deselected.                             |
| `selectionChanged`                | `{ selectedSeatIds, selectedSeats }`   | The selection changed for any reason.                                |
| `selectionInvalidated`            | `{ seatIds, seats, reason: 'status' }` | Selected seats became unavailable and were deselected.               |
| `statusesChanged`                 | `{ changes, replaced }`                | Statuses changed; `replaced` for snapshots.                          |
| `seatDataChanged`                 | `{ changes, replaced, source }`        | Seat data changed; `source` is `'app'` or `'live'`.                  |
| `connectionStateChanged`          | `{ state, error? }`                    | Live source state: `'connecting'`, `'live'`, `'offline'`, or `null`. |

A `RenderSeatContext` is `{ seat, row, building }`, taken straight from the floorplan.
