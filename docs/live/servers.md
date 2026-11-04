# Reference servers

The repository includes two small Socket.IO servers that implement the [protocol](./protocol). They're examples to copy into your backend, not packages: swap the in-memory store for your database and the `authorize` hook for a real check.

|                  | Node.js         | Python                     |
| :--------------- | :-------------- | :------------------------- |
| Location         | `servers/node/` | `servers/python/`          |
| Library          | `socket.io` v4  | `python-socketio` 5 (ASGI) |
| Protocol module  | `seats-hub.mjs` | `seats_hub.py`             |
| Runnable example | `server.mjs`    | `server.py`                |

## Run

::: code-group

```sh [Node.js]
cd servers/node
npm install
npm start            # http://localhost:3030
```

```sh [Python]
cd servers/python
uv run server.py     # http://localhost:3030
```

:::

Set `SIMULATE_FLOORPLAN=plan.json` (and optionally `FLOORPLAN_ID`, default `demo`) to book random seats every 2 seconds. From the repository root, `npm run start:live-server` does this for the Angular demo.

## Use it in your backend

::: code-group

```js [Node.js]
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { attachSeatsHub, createMemoryStore } from './seats-hub.mjs';

const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: 'https://shop.example.com' } });

const hub = attachSeatsHub(io, {
  store: createMemoryStore(), // replace with your database
  authorize: async (handshake, floorplanId) => verifyToken(handshake.auth.token, floorplanId),
});

// After your booking API has committed a change:
await hub.publish('grand-hall', { 's-a-1a': 'reserved' });
// Release a seat (null = default status) and update a shared price:
await hub.publish('grand-hall', { 's-a-1a': null }, { 's-a-1a': { price: 80 } });

httpServer.listen(3030);
```

```python [Python]
import socketio
from seats_hub import MemoryStore, SeatsHub

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="https://shop.example.com")
hub = SeatsHub(
    sio,
    store=MemoryStore(),  # replace with your database
    authorize=lambda environ, auth, floorplan_id: verify_token(auth.get("token"), floorplan_id),
)
app = socketio.ASGIApp(sio)

# After your booking API has committed a change:
await hub.publish("grand-hall", {"s-a-1a": "reserved"})
# Release a seat (None = default status) and update a shared price:
await hub.publish("grand-hall", {"s-a-1a": None}, {"s-a-1a": {"price": 80}})
```

:::

`publish` validates its input first and throws a `TypeError` (Node) or `ValueError` (Python) if `changes` doesn't map seat ids to a status string or `null`, or `data` doesn't map them to an object or `null`. Nothing malformed reaches the store, so one bad call can't break every viewer's next snapshot.

## Publishing from scripts

The runnable examples also accept `POST /floorplans/<id>/seats`:

```sh
curl -X POST localhost:3030/floorplans/demo/seats \
  -H 'content-type: application/json' \
  -d '{"changes": {"s-a-1a": "reserved"}, "data": {"s-a-2a": {"price": 120}}}'
```

This endpoint has no authentication. Keep it for local development.

## Your store

A store needs two operations, and each must be atomic so that a snapshot's revision matches its contents:

| Operation                            | Returns                   |
| :----------------------------------- | :------------------------ |
| `get(floorplanId)`                   | `{ rev, statuses, data }` |
| `apply(floorplanId, changes, data?)` | the new `rev`             |

## Running several instances

Broadcasts must reach clients connected to other instances. Use the Socket.IO Redis adapter (Node: `io.adapter(createAdapter(pub, sub))`; Python: `socketio.AsyncRedisManager(url)` as `client_manager`) and a shared store.

## Contract tests

`libs/viewer/tests/live-server.contract.spec.ts` runs the real client against both servers. The Node server runs with `npm test`; the Python server runs when `OPEN_SEATS_PYTHON=1` is set and needs [`uv`](https://docs.astral.sh/uv/).
