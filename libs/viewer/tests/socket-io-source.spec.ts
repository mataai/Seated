import { describe, expect, it, vi } from 'vitest';
import {
  socketIoStatusSource,
  type SocketIoLike,
  type StatusSink,
} from '../src';

type Listener = (...args: unknown[]) => void;

/** Minimal stand-in for a socket.io-client Socket. */
class FakeSocket implements SocketIoLike {
  connected = false;
  active = true;
  listeners = new Map<string, Set<Listener>>();
  emitted: { event: string; args: unknown[] }[] = [];

  on(event: string, listener: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return this;
  }
  off(event: string, listener: Listener) {
    this.listeners.get(event)?.delete(listener);
    return this;
  }
  emit(event: string, ...args: unknown[]) {
    this.emitted.push({ event, args });
    return this;
  }
  /** Simulates a message from the server. */
  receive(event: string, ...args: unknown[]) {
    for (const l of [...(this.listeners.get(event) ?? [])]) l(...args);
  }
  connect() {
    this.connected = true;
    this.receive('connect');
  }
  disconnect(active = true) {
    this.connected = false;
    this.active = active;
    this.receive('disconnect', 'transport close');
  }
  /** Answers the latest seats:sync request. */
  replySync(reply: unknown, index = -1) {
    const syncs = this.emitted.filter((e) => e.event === 'seats:sync');
    const ack = syncs.at(index)!.args[1] as (r: unknown) => void;
    ack(reply);
  }
  listenerCount() {
    return [...this.listeners.values()].reduce((n, s) => n + s.size, 0);
  }
}

function recordingSink() {
  const calls: unknown[][] = [];
  const sink: StatusSink = {
    snapshot: (statuses, rev) => calls.push(['snapshot', statuses, rev]),
    patch: (changes, rev) => calls.push(['patch', changes, rev]),
    connectionState: (state, error) =>
      calls.push(
        error === undefined
          ? ['state', state]
          : ['state', state, (error as Error).message]
      ),
  };
  return { sink, calls };
}

describe('socketIoStatusSource', () => {
  it('requests a snapshot on connect, then applies patches', () => {
    const socket = new FakeSocket();
    const { sink, calls } = recordingSink();
    socketIoStatusSource(socket).subscribe(sink);

    socket.connect();
    expect(socket.emitted[0].event).toBe('seats:sync');
    expect(socket.emitted[0].args[0]).toEqual({ v: 1 });

    socket.replySync({ v: 1, rev: 3, statuses: { 's-1': 'reserved' } });
    socket.receive('seats:patch', { v: 1, rev: 4, changes: { 's-2': null } });

    expect(calls).toEqual([
      ['state', 'connecting'],
      ['state', 'connecting'],
      ['snapshot', { 's-1': 'reserved' }, 3],
      ['state', 'live'],
      ['patch', { 's-2': null }, 4],
    ]);
  });

  it('syncs immediately when the socket is already connected', () => {
    const socket = new FakeSocket();
    socket.connected = true;
    socketIoStatusSource(socket).subscribe(recordingSink().sink);
    expect(socket.emitted.map((e) => e.event)).toEqual(['seats:sync']);
  });

  it('holds patches received during a sync and replays them after the snapshot', () => {
    const socket = new FakeSocket();
    const { sink, calls } = recordingSink();
    socketIoStatusSource(socket).subscribe(sink);
    socket.connect();

    socket.receive('seats:patch', { v: 1, rev: 8, changes: { 's-1': 'x' } });
    expect(calls.some((c) => c[0] === 'patch')).toBe(false);

    socket.replySync({ v: 1, rev: 7, statuses: {} });
    expect(calls.slice(-3)).toEqual([
      ['snapshot', {}, 7],
      ['patch', { 's-1': 'x' }, 8],
      ['state', 'live'],
    ]);
  });

  it('re-syncs after a reconnect and ignores the old sync reply', () => {
    const socket = new FakeSocket();
    const { sink, calls } = recordingSink();
    socketIoStatusSource(socket).subscribe(sink);
    socket.connect();
    socket.disconnect();
    socket.connect();

    socket.replySync({ v: 1, rev: 1, statuses: { old: 'reserved' } }, 0);
    socket.replySync({ v: 1, rev: 9, statuses: { new: 'reserved' } }, 1);

    const snapshots = calls.filter((c) => c[0] === 'snapshot');
    expect(snapshots).toEqual([['snapshot', { new: 'reserved' }, 9]]);
  });

  it('reports offline when the socket stops reconnecting', () => {
    const socket = new FakeSocket();
    const { sink, calls } = recordingSink();
    socketIoStatusSource(socket).subscribe(sink);

    socket.active = false;
    socket.receive('connect_error', new Error('Forbidden'));
    expect(calls.at(-1)).toEqual(['state', 'offline', 'Forbidden']);

    socket.active = true;
    socket.receive('connect_error', new Error('timeout'));
    expect(calls.at(-1)).toEqual(['state', 'connecting', 'timeout']);

    socket.connect();
    socket.disconnect(false);
    expect(calls.at(-1)).toEqual(['state', 'offline']);
  });

  it('reports offline for error and unsupported-version replies', () => {
    const socket = new FakeSocket();
    const { sink, calls } = recordingSink();
    socketIoStatusSource(socket).subscribe(sink);

    socket.connect();
    socket.replySync({ v: 1, error: 'Unknown floorplan' });
    expect(calls.at(-1)).toEqual(['state', 'offline', 'Unknown floorplan']);

    socket.disconnect();
    socket.connect();
    socket.replySync({ v: 2, rev: 1, statuses: {} });
    expect(calls.at(-1)).toEqual([
      'state',
      'offline',
      'Unsupported live protocol version: 2',
    ]);
  });

  it('ignores patches after a failed sync until the next successful one', () => {
    const socket = new FakeSocket();
    const { sink, calls } = recordingSink();
    socketIoStatusSource(socket).subscribe(sink);

    socket.connect();
    socket.receive('seats:patch', { v: 1, rev: 1, changes: { 's-1': 'a' } });
    socket.replySync({ v: 1, error: 'forbidden' });
    socket.receive('seats:patch', { v: 1, rev: 2, changes: { 's-2': 'b' } });
    expect(calls.filter((c) => c[0] === 'patch')).toEqual([]);

    socket.disconnect();
    socket.connect();
    socket.replySync({ v: 1, rev: 2, statuses: {} });
    socket.receive('seats:patch', { v: 1, rev: 3, changes: { 's-3': 'c' } });
    expect(calls.filter((c) => c[0] === 'patch')).toEqual([
      ['patch', { 's-3': 'c' }, 3],
    ]);
  });

  it('reports offline and drops held patches when the sync reply times out', () => {
    vi.useFakeTimers();
    try {
      const socket = new FakeSocket();
      const { sink, calls } = recordingSink();
      socketIoStatusSource(socket, { syncTimeoutMs: 500 }).subscribe(sink);

      socket.connect();
      socket.receive('seats:patch', { v: 1, rev: 1, changes: { 's-1': 'a' } });
      vi.advanceTimersByTime(500);
      expect(calls.at(-1)).toEqual([
        'state',
        'offline',
        'seats:sync timed out after 500 ms',
      ]);

      // A late reply and later patches are ignored.
      socket.replySync({ v: 1, rev: 1, statuses: {} });
      socket.receive('seats:patch', { v: 1, rev: 2, changes: { 's-2': 'b' } });
      expect(calls.filter((c) => c[0] !== 'state')).toEqual([]);

      // The next connection syncs again.
      socket.disconnect();
      socket.connect();
      socket.replySync({ v: 1, rev: 2, statuses: {} });
      vi.advanceTimersByTime(1000);
      expect(calls.at(-1)).toEqual(['state', 'live']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores malformed patches', () => {
    const socket = new FakeSocket();
    const { sink, calls } = recordingSink();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    socketIoStatusSource(socket).subscribe(sink);
    socket.connect();
    socket.replySync({ v: 1, statuses: {} });

    socket.receive('seats:patch', { v: 1, changes: { 's-1': 42 } });
    socket.receive('seats:patch', { v: 2, changes: {} });
    socket.receive('seats:patch', 'nope');

    expect(calls.filter((c) => c[0] === 'patch')).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it('unsubscribe removes every listener and drops pending replies', () => {
    const socket = new FakeSocket();
    const { sink, calls } = recordingSink();
    const stop = socketIoStatusSource(socket).subscribe(sink);
    socket.connect();
    stop();

    expect(socket.listenerCount()).toBe(0);
    const before = calls.length;
    socket.replySync({ v: 1, rev: 1, statuses: {} });
    expect(calls.length).toBe(before);
  });
});
