// @vitest-environment node
/**
 * Contract test: the real socket.io-client + `socketIoStatusSource` against the
 * reference servers in /servers, started as subprocesses.
 *
 * The Node server always runs. The Python server needs `uv` and network access
 * for its first install, so it runs only with OPEN_SEATS_PYTHON=1.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import {
  socketIoStatusSource,
  type StatusConnectionState,
  type StatusSink,
} from '../src';

const serversDir = fileURLToPath(new URL('../../../servers/', import.meta.url));

const SERVERS = [
  {
    name: 'node',
    enabled: true,
    command: (port: number) =>
      spawn(process.execPath, ['server.mjs'], {
        cwd: `${serversDir}node`,
        env: { ...process.env, PORT: String(port) },
      }),
  },
  {
    name: 'python',
    enabled: process.env['OPEN_SEATS_PYTHON'] === '1',
    command: (port: number) =>
      spawn('uv', ['run', '--quiet', '--script', 'server.py'], {
        cwd: `${serversDir}python`,
        env: { ...process.env, PORT: String(port) },
      }),
  },
];

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const address = srv.address();
      srv.close(() =>
        typeof address === 'object' && address
          ? resolve(address.port)
          : reject(new Error('no port'))
      );
    });
  });
}

async function waitFor<T>(
  check: () => T | undefined | false,
  timeoutMs = 5000
): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = check();
    if (value) return value;
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
}

/** Mirrors the viewer's snapshot/patch rules so the test needs no DOM. */
function modelSink() {
  const model = {
    statuses: {} as Record<string, string>,
    data: {} as Record<string, unknown>,
    rev: undefined as number | undefined,
    states: [] as StatusConnectionState[],
    errors: [] as string[],
    snapshots: 0,
  };
  const sink: StatusSink = {
    snapshot(statuses, rev, data) {
      model.statuses = { ...statuses };
      model.data = { ...data };
      model.rev = rev;
      model.snapshots++;
    },
    patch(changes, rev, data) {
      if (rev !== undefined && model.rev !== undefined && rev <= model.rev) {
        return;
      }
      if (rev !== undefined) model.rev = rev;
      for (const [id, status] of Object.entries(changes)) {
        if (status === null) delete model.statuses[id];
        else model.statuses[id] = status;
      }
      for (const [id, value] of Object.entries(data ?? {})) {
        if (value === null) delete model.data[id];
        else model.data[id] = value;
      }
    },
    connectionState(state, error) {
      model.states.push(state);
      if (error instanceof Error) model.errors.push(error.message);
    },
  };
  return { sink, model };
}

for (const server of SERVERS) {
  describe.skipIf(!server.enabled)(`reference server: ${server.name}`, () => {
    let child: ChildProcess;
    let baseUrl: string;
    const sockets: Socket[] = [];

    const connect = (auth: Record<string, unknown>) => {
      const socket = io(baseUrl, {
        auth,
        transports: ['websocket'],
        reconnectionDelay: 50,
        reconnectionDelayMax: 100,
      });
      sockets.push(socket);
      return socket;
    };

    const publish = async (
      floorplanId: string,
      changes?: Record<string, string | null>,
      data?: Record<string, Record<string, unknown> | null>
    ) => {
      const res = await fetch(`${baseUrl}/floorplans/${floorplanId}/seats`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ changes, data }),
      });
      expect(res.status).toBe(200);
      return ((await res.json()) as { rev: number }).rev;
    };

    beforeAll(async () => {
      const port = await freePort();
      baseUrl = `http://127.0.0.1:${port}`;
      child = server.command(port);
      let output = '';
      child.stdout?.on('data', (d) => (output += d));
      child.stderr?.on('data', (d) => (output += d));
      // Any HTTP response (404 included) means the server is listening.
      for (let attempt = 0; ; attempt++) {
        try {
          await fetch(baseUrl);
          break;
        } catch {
          if (attempt > 600) {
            throw new Error(`${server.name} server did not start:\n${output}`);
          }
          await new Promise((r) => setTimeout(r, 100));
        }
      }
    }, 90_000);

    afterAll(() => {
      for (const s of sockets) s.disconnect();
      child?.kill();
    });

    it('sends a snapshot on connect and patches afterwards', async () => {
      const id = `plan-${server.name}-1`;
      await publish(id, { 's-1': 'reserved', 's-2': 'locked' });

      const { sink, model } = modelSink();
      socketIoStatusSource(connect({ floorplanId: id })).subscribe(sink);
      await waitFor(() => model.states.at(-1) === 'live');
      expect(model.statuses).toEqual({ 's-1': 'reserved', 's-2': 'locked' });
      expect(model.rev).toBe(1);

      const rev = await publish(id, { 's-1': null, 's-3': 'reserved' });
      await waitFor(() => model.rev === rev);
      expect(model.statuses).toEqual({ 's-2': 'locked', 's-3': 'reserved' });
    });

    it('only delivers patches for the connected floorplan', async () => {
      const { sink, model } = modelSink();
      socketIoStatusSource(
        connect({ floorplanId: `plan-${server.name}-a` })
      ).subscribe(sink);
      await waitFor(() => model.states.at(-1) === 'live');

      await publish(`plan-${server.name}-b`, { 's-1': 'reserved' });
      const rev = await publish(`plan-${server.name}-a`, { 's-9': 'locked' });
      await waitFor(() => model.rev === rev);
      expect(model.statuses).toEqual({ 's-9': 'locked' });
    });

    it('re-syncs after the connection drops, including missed changes', async () => {
      const id = `plan-${server.name}-2`;
      const socket = connect({ floorplanId: id });
      const { sink, model } = modelSink();
      socketIoStatusSource(socket).subscribe(sink);
      await waitFor(() => model.states.at(-1) === 'live');

      // Drop the transport, publish while the client is away.
      socket.io.engine.close();
      await waitFor(() => model.states.at(-1) === 'connecting');
      const rev = await publish(id, { 's-5': 'reserved' });

      await waitFor(() => model.states.at(-1) === 'live' && model.rev === rev);
      expect(model.snapshots).toBe(2);
      expect(model.statuses).toEqual({ 's-5': 'reserved' });
    });

    it('delivers seat data in the snapshot and in patches', async () => {
      const id = `plan-${server.name}-data`;
      await publish(id, { 's-1': 'reserved' }, { 's-1': { price: 95 } });

      const { sink, model } = modelSink();
      socketIoStatusSource(connect({ floorplanId: id })).subscribe(sink);
      await waitFor(() => model.states.at(-1) === 'live');
      expect(model.data).toEqual({ 's-1': { price: 95 } });

      // Data-only patch: statuses stay as they are.
      let rev = await publish(id, undefined, { 's-2': { price: 40 } });
      await waitFor(() => model.rev === rev);
      expect(model.data).toEqual({
        's-1': { price: 95 },
        's-2': { price: 40 },
      });
      expect(model.statuses).toEqual({ 's-1': 'reserved' });

      rev = await publish(id, { 's-1': null }, { 's-1': null });
      await waitFor(() => model.rev === rev);
      expect(model.data).toEqual({ 's-2': { price: 40 } });
      expect(model.statuses).toEqual({});
    });

    it('rejects malformed changes without storing any of them', async () => {
      const id = `plan-${server.name}-invalid`;
      const url = `${baseUrl}/floorplans/${id}/seats`;
      for (const body of [
        { data: { 's-1': 5 } },
        { data: { 's-1': 'x' } },
        { changes: { 's-1': 'reserved' }, data: [1] },
        { changes: { 's-1': 7 } },
        'changes',
      ]) {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        expect(res.status).toBe(400);
      }

      const { sink, model } = modelSink();
      socketIoStatusSource(connect({ floorplanId: id })).subscribe(sink);
      await waitFor(() => model.states.at(-1) === 'live');
      expect(model.statuses).toEqual({});
      expect(model.data ?? {}).toEqual({});
    });

    it('answers the CORS preflight browsers send before publishing', async () => {
      const url = `${baseUrl}/floorplans/plan-${server.name}-cors/seats`;
      const preflight = await fetch(url, {
        method: 'OPTIONS',
        headers: {
          origin: 'http://localhost:4200',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type',
        },
      });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get('access-control-allow-origin')).toBe('*');
      expect(preflight.headers.get('access-control-allow-headers')).toBe(
        'content-type'
      );

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          origin: 'http://localhost:4200',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ changes: { 's-1': 'reserved' } }),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
    });

    it('rejects connections without a floorplanId', async () => {
      const { sink, model } = modelSink();
      socketIoStatusSource(connect({})).subscribe(sink);
      await waitFor(() => model.states.at(-1) === 'offline');
      expect(model.errors.at(-1)).toBe('floorplanId is required');
    });
  });
}
