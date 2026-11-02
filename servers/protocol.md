# OpenSeats live updates protocol (v1)

Socket.IO v4. One connection shows one floorplan and receives updates for the whole floorplan.

## Connecting

The client names the floorplan in the handshake:

```ts
io(url, { auth: { floorplanId: 'grand-hall', token } });
```

The server rejects the connection (Socket.IO middleware error, `connect_error` on the client) when `floorplanId` is missing or the client is not allowed to see it. Otherwise it joins the socket to the room `floorplan:<floorplanId>`.

## Events

| Direction       | Event         | Payload                                         |
| :-------------- | :------------ | :---------------------------------------------- |
| client → server | `seats:sync`  | `{ v: 1 }`, with an acknowledgement callback    |
| server → client | ack reply     | `{ v: 1, rev, statuses }` or `{ v: 1, error }`  |
| server → client | `seats:patch` | `{ v: 1, rev, changes }`, broadcast to the room |

- `statuses`: every seat that does not have the default status, as `seatId → status`. Seats not listed have the default status (usually `available`).
- `changes`: only the seats that changed. A `null` value resets the seat to the default status.
- `rev`: an integer that increases with every change to the floorplan. It's optional, but without it the client can't order messages.

The client sends `seats:sync` after every connect and reconnect, so a reconnecting client always gets the full current state. There is no history to replay.

## Ordering rules

- The server joins the socket to the room **before** answering `seats:sync`, so no change can fall between the snapshot and the first patch.
- The snapshot's `rev` must match its `statuses` (read both atomically).
- The client holds patches that arrive while a sync is in flight and applies them after the snapshot. Patches with `rev <= snapshot.rev` are ignored, because the snapshot already includes them.
- A snapshot always applies and resets ordering, so a server restart that resets `rev` is fine.

## Sync failures

- The server must always acknowledge `seats:sync`. The client waits `syncTimeoutMs` (10 s by default) for the reply; after that it ignores any late reply.
- On an error reply, an unsupported version or a timeout, the client reports `offline` and drops patches (including held ones) until a later sync succeeds. Patches can't be applied without a snapshot. The client syncs again on the next connect.

## Versioning

`v` is the protocol version. A server answers a `seats:sync` with an unknown `v` with `{ v: 1, error }`; the client goes `offline` on a sync reply with a version it doesn't support, and ignores (and logs) such patches. Additive changes (new optional fields) don't bump `v`.

## Out of scope

Booking, holding and releasing seats are your app's own API. After committing a change, the server calls `publish(floorplanId, changes)` to broadcast it.
