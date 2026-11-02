# Reference servers for live seat updates

Minimal Socket.IO servers implementing [`protocol.md`](./protocol.md). They are examples to copy into your backend, not published packages: replace the in-memory store with your database and the `authorize` hook with a real check.

| Server    | Protocol                   | Run                                           |
| :-------- | :------------------------- | :-------------------------------------------- |
| `node/`   | `socket.io` v4             | `cd servers/node && npm install && npm start` |
| `python/` | `python-socketio` 5 (ASGI) | `cd servers/python && uv run server.py`       |

Each has two parts:

- `seats-hub.mjs` / `seats_hub.py`: the protocol (`attachSeatsHub(io)` / `SeatsHub(sio)`), with a `publish(floorplanId, changes)` to call after a booking.
- `server.mjs` / `server.py`: a runnable example on port `3030` with `POST /floorplans/<id>/seats` `{"changes": {...}}` to publish changes by hand. Set `SIMULATE_FLOORPLAN=<floorplan.json>` (and optionally `FLOORPLAN_ID`, default `demo`) to book random seats every 2 seconds.

## Scaling out

With more than one server instance, broadcasts must reach clients connected to other instances. Use the Redis adapter ([Node](https://socket.io/docs/v4/redis-adapter/): `io.adapter(createAdapter(pub, sub))`; Python: `socketio.AsyncRedisManager(url)` as `client_manager`) and keep statuses in a shared store.

## Contract tests

`libs/viewer/tests/live-server.contract.spec.ts` runs the real client and `socketIoStatusSource` against both servers. The Node server runs as part of `npm test`; the Python server runs when `OPEN_SEATS_PYTHON=1` is set (needs [`uv`](https://docs.astral.sh/uv/)):

```sh
OPEN_SEATS_PYTHON=1 npx nx test viewer --skip-nx-cache
```
