// OpenSeats live seat updates: reference Socket.IO server (Node.js).
//
// Copy this file into your backend and adapt it. It implements the protocol in
// ../protocol.md and nothing else: who may connect, where statuses are stored
// and when seats change are decided by your app.

export const PROTOCOL_VERSION = 1;
export const SYNC_EVENT = 'seats:sync';
export const PATCH_EVENT = 'seats:patch';

const roomFor = (floorplanId) => `floorplan:${floorplanId}`;

/**
 * In-memory store, one entry per floorplan. Replace with your database; keep
 * `get` and `apply` atomic so a snapshot's `rev` matches its `statuses`.
 */
export function createMemoryStore(initial = {}) {
  const floorplans = new Map();
  for (const [id, statuses] of Object.entries(initial)) {
    floorplans.set(id, { rev: 0, statuses: { ...statuses } });
  }
  const entry = (id) => {
    if (!floorplans.has(id)) floorplans.set(id, { rev: 0, statuses: {} });
    return floorplans.get(id);
  };
  return {
    /** @returns {{ rev: number, statuses: Record<string, string> }} */
    get(floorplanId) {
      const { rev, statuses } = entry(floorplanId);
      return { rev, statuses: { ...statuses } };
    },
    /**
     * @param {Record<string, string | null>} changes `null` resets a seat.
     * @returns {number} the new revision
     */
    apply(floorplanId, changes) {
      const state = entry(floorplanId);
      for (const [seatId, status] of Object.entries(changes)) {
        if (status === null) delete state.statuses[seatId];
        else state.statuses[seatId] = status;
      }
      state.rev += 1;
      return state.rev;
    },
  };
}

/**
 * Attaches the protocol to a Socket.IO server.
 *
 * @param {import('socket.io').Server} io
 * @param {{
 *   store?: ReturnType<typeof createMemoryStore>,
 *   authorize?: (handshake: import('socket.io').Socket['handshake'], floorplanId: string) => boolean | Promise<boolean>,
 * }} [options]
 */
export function attachSeatsHub(io, options = {}) {
  const store = options.store ?? createMemoryStore();
  const authorize = options.authorize ?? (() => true);

  // One floorplan per connection, named in the handshake:
  //   io(url, { auth: { floorplanId, token } })
  io.use(async (socket, next) => {
    const floorplanId = socket.handshake.auth?.floorplanId;
    if (typeof floorplanId !== 'string' || floorplanId === '') {
      return next(new Error('floorplanId is required'));
    }
    try {
      if (!(await authorize(socket.handshake, floorplanId))) {
        return next(new Error('Forbidden'));
      }
    } catch {
      return next(new Error('Forbidden'));
    }
    socket.data.floorplanId = floorplanId;
    next();
  });

  io.on('connection', (socket) => {
    // Join before answering any sync, so no patch can fall between the two.
    socket.join(roomFor(socket.data.floorplanId));

    socket.on(SYNC_EVENT, async (request, ack) => {
      if (typeof ack !== 'function') return;
      if (request?.v !== PROTOCOL_VERSION) {
        return ack({
          v: PROTOCOL_VERSION,
          error: `Unsupported protocol version: ${request?.v}`,
        });
      }
      try {
        const { rev, statuses } = await store.get(socket.data.floorplanId);
        ack({ v: PROTOCOL_VERSION, rev, statuses });
      } catch {
        ack({ v: PROTOCOL_VERSION, error: 'Could not load seat statuses' });
      }
    });
  });

  return {
    store,
    /**
     * Call after a booking, cancellation, hold, etc. has been committed.
     * @param {string} floorplanId
     * @param {Record<string, string | null>} changes
     */
    async publish(floorplanId, changes) {
      const rev = await store.apply(floorplanId, changes);
      io.to(roomFor(floorplanId)).emit(PATCH_EVENT, {
        v: PROTOCOL_VERSION,
        rev,
        changes,
      });
      return rev;
    },
  };
}
