# Live updates

When a customer books a seat, everyone else looking at the map should see it immediately, and anyone who had that seat selected should lose it. Live updates do both.

```
 your booking API ──publish()──▶ live server ──seats:patch──▶ every viewer
                                    ▲                            │
                                    └──── seats:sync (snapshot) ─┘ on every (re)connect
```

## What the viewer does for you

- **Snapshots on (re)connect.** After every connect and reconnect the viewer receives the full state, so missed updates are never lost.
- **Ordering.** Each change has a revision; late or duplicate messages are ignored.
- **Releasing taken seats.** Selected seats that become unavailable are deselected, announced to screen readers, and reported with [`selectionInvalidated`](/viewer/selection#react-to-changes).
- **Connection state.** `connectionStateChanged` tells you whether the map is `connecting`, `live` or `offline`.
- **Seat data.** The server can also send shared [seat data](/viewer/seat-data), such as current prices.

Reserving or holding seats stays your own API call. The live server only broadcasts the result.

## Choose a transport

| You have…                                      | Use                                                                         |
| :--------------------------------------------- | :-------------------------------------------------------------------------- |
| A Socket.IO server, or are free to add one     | [`socketIoStatusSource`](./socket-io) with a [reference server](./servers). |
| WebSocket, SSE, polling, Firebase, Supabase, … | A [custom `StatusSource`](./custom-sources) (about 30 lines).               |
| Updates arriving through your own code         | Call [`applyStatusPatch`](/viewer/statuses#snapshots-and-patches) directly. |

## In five lines

<<< @/snippets/live/socket-io.ts#connect

The library has no dependency on `socket.io-client`; you install it and create the socket.
