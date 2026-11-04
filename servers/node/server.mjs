// Runnable example around seats-hub.mjs.
//
//   node server.mjs                                  # listen on :3030
//   SIMULATE_FLOORPLAN=plan.json node server.mjs     # also book seats at random
//
// Publish changes from anywhere with:
//   curl -X POST localhost:3030/floorplans/demo/seats \
//     -H 'content-type: application/json' -d '{"changes":{"s-a-1a":"reserved"}}'
// and seat data (shared with every viewer of the floorplan) with:
//     -d '{"data":{"s-a-1a":{"price":120}}}'
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { attachSeatsHub } from './seats-hub.mjs';

const PORT = Number(process.env.PORT ?? 3030);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';
const CORS_HEADERS = {
  'access-control-allow-origin': CORS_ORIGIN,
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const httpServer = createServer(async (req, res) => {
  const match = req.url?.match(/^\/floorplans\/([^/]+)\/seats$/);
  if (!match) {
    res.writeHead(404).end();
    return;
  }
  // Browsers send a CORS preflight before a JSON POST from another origin.
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS).end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, CORS_HEADERS).end();
    return;
  }
  try {
    let body = '';
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body);
    if (
      typeof payload !== 'object' ||
      payload === null ||
      Array.isArray(payload) ||
      (!('changes' in payload) && !('data' in payload))
    ) {
      throw new TypeError('expected { changes?, data? }');
    }
    const { changes, data } = payload;
    const rev = await hub.publish(
      decodeURIComponent(match[1]),
      changes ?? {},
      data
    );
    res.writeHead(200, { ...CORS_HEADERS, 'content-type': 'application/json' });
    res.end(JSON.stringify({ rev }));
  } catch {
    res.writeHead(400, CORS_HEADERS).end();
  }
});

const io = new Server(httpServer, { cors: { origin: CORS_ORIGIN } });

const hub = attachSeatsHub(io, {
  // Replace with a real check, e.g. verify handshake.auth.token.
  authorize: (_handshake, _floorplanId) => true,
});

if (process.env.SIMULATE_FLOORPLAN) {
  simulateBookings(
    process.env.FLOORPLAN_ID ?? 'demo',
    JSON.parse(readFileSync(process.env.SIMULATE_FLOORPLAN, 'utf8'))
  );
}

httpServer.listen(PORT, () => {
  console.log(`OpenSeats live server on http://localhost:${PORT}`);
});

/**
 * Every 2s, reserves a random available seat or releases a reserved one, and
 * gives another random seat a new price (live seat data).
 */
function simulateBookings(floorplanId, floorplan) {
  const seatIds = floorplan.buildings.flatMap((b) =>
    b.rows.flatMap((r) => r.seats.map((s) => s.id))
  );
  const randomSeat = () => seatIds[Math.floor(Math.random() * seatIds.length)];
  setInterval(() => {
    const seatId = randomSeat();
    const current = hub.store.get(floorplanId).statuses[seatId];
    hub.publish(
      floorplanId,
      { [seatId]: current === 'reserved' ? null : 'reserved' },
      { [randomSeat()]: { price: 40 + 5 * Math.floor(Math.random() * 20) } }
    );
  }, 2000);
}
