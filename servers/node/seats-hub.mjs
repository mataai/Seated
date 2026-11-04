// OpenSeats live seat updates: reference Socket.IO server (Node.js).
//
// Copy this file into your backend and adapt it. It implements the protocol in
// ../protocol.md and nothing else: who may connect, where statuses are stored
// and when seats change are decided by your app.

export const PROTOCOL_VERSION = 1;
export const SYNC_EVENT = 'seats:sync';
export const PATCH_EVENT = 'seats:patch';

const roomFor = (floorplanId) => `floorplan:${floorplanId}`;

const isRecord = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Throws a TypeError unless `changes`/`data` match the protocol. Clients reject
 * a whole patch or snapshot containing a malformed entry, so nothing invalid
 * may reach the store.
 */
export function validateChanges(changes, data) {
  if (
    changes !== undefined &&
    (!isRecord(changes) ||
      !Object.values(changes).every((s) => s === null || typeof s === 'string'))
  ) {
    throw new TypeError('changes must map seat ids to a status or null');
  }
  if (
    data !== undefined &&
    (!isRecord(data) ||
      !Object.values(data).every((d) => d === null || isRecord(d)))
  ) {
    throw new TypeError('data must map seat ids to an object or null');
  }
}

/**
 * In-memory store, one entry per floorplan. Replace with your database; keep
 * `get` and `apply` atomic so a snapshot's `rev` matches its contents.
 *
 * Seat data is broadcast to every client viewing the floorplan: only store
 * data that all of them may see (prices, categories), never per-user data.
 */
export function createMemoryStore(initial = {}) {
  const floorplans = new Map();
  for (const [id, statuses] of Object.entries(initial)) {
    floorplans.set(id, { rev: 0, statuses: { ...statuses }, data: {} });
  }
  const entry = (id) => {
    if (!floorplans.has(id)) {
      floorplans.set(id, { rev: 0, statuses: {}, data: {} });
    }
    return floorplans.get(id);
  };
  const applyTo = (target, changes) => {
    for (const [seatId, value] of Object.entries(changes)) {
      if (value === null) delete target[seatId];
      else target[seatId] = value;
    }
  };
  return {
    /**
     * @returns {{ rev: number, statuses: Record<string, string>, data: Record<string, object> }}
     */
    get(floorplanId) {
      const { rev, statuses, data } = entry(floorplanId);
      return { rev, statuses: { ...statuses }, data: { ...data } };
    },
    /**
     * @param {Record<string, string | null>} changes `null` resets a seat.
     * @param {Record<string, object | null>} [data] replaces a seat's data;
     *   `null` removes it.
     * @returns {number} the new revision
     */
    apply(floorplanId, changes, data = {}) {
      const state = entry(floorplanId);
      applyTo(state.statuses, changes);
      applyTo(state.data, data);
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
        const { rev, statuses, data } = await store.get(
          socket.data.floorplanId
        );
        ack({ v: PROTOCOL_VERSION, rev, statuses, data });
      } catch {
        ack({ v: PROTOCOL_VERSION, error: 'Could not load seat statuses' });
      }
    });
  });

  return {
    store,
    /**
     * Call after a booking, cancellation, hold, price change, etc. has been
     * committed. Throws a TypeError, before anything is stored, if the
     * changes are malformed.
     * @param {string} floorplanId
     * @param {Record<string, string | null>} [changes] status changes
     * @param {Record<string, object | null>} [data] seat data changes
     */
    async publish(floorplanId, changes = {}, data) {
      validateChanges(changes, data ?? undefined);
      const rev = await store.apply(floorplanId, changes, data);
      const message = { v: PROTOCOL_VERSION, rev, changes };
      if (data) message.data = data;
      io.to(roomFor(floorplanId)).emit(PATCH_EVENT, message);
      return rev;
    },
  };
}
