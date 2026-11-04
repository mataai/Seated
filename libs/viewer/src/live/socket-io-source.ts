import type {
  SeatData,
  SeatDataChanges,
  StatusChanges,
  StatusConnectionState,
  StatusSink,
  StatusSource,
} from './status-source';

/**
 * Wire protocol version. Bump only for breaking changes; servers should reject
 * versions they don't understand with an error reply.
 */
export const LIVE_PROTOCOL_VERSION = 1;

/** Client -> server, with acknowledgement. Reply: snapshot or error. */
export const SEATS_SYNC_EVENT = 'seats:sync';
/** Server -> client broadcast of changed seats. */
export const SEATS_PATCH_EVENT = 'seats:patch';

export interface SeatsSyncRequest {
  v: number;
}

export type SeatsSyncReply =
  | {
      v: number;
      rev?: number;
      statuses: Record<string, string>;
      /** Live data of every seat that has some. Optional. */
      data?: Record<string, SeatData>;
    }
  | { v: number; error: string };

/** At least one of `changes` and `data` is present. */
export interface SeatsPatchMessage {
  v: number;
  rev?: number;
  changes?: StatusChanges;
  /** New data for changed seats (replaces it); `null` removes it. */
  data?: SeatDataChanges;
}

interface ParsedPatch {
  changes: StatusChanges;
  rev?: number;
  data?: SeatDataChanges;
}

/**
 * The subset of a socket.io-client v4 `Socket` this adapter uses. Declared
 * structurally so the library has no dependency on socket.io-client: the app
 * creates the socket (URL, auth, path, transports) and passes it in.
 */
export interface SocketIoLike {
  readonly connected: boolean;
  /** False once the socket will no longer reconnect on its own. */
  readonly active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(event: string, listener: (...args: any[]) => void): unknown;
  emit(event: string, ...args: unknown[]): unknown;
}

export interface SocketIoStatusSourceOptions {
  /**
   * How long to wait for the `seats:sync` reply before giving up and reporting
   * `offline`. The next (re)connect syncs again. Defaults to 10000 ms.
   */
  syncTimeoutMs?: number;
}

export const DEFAULT_SYNC_TIMEOUT_MS = 10_000;

/**
 * Live seat statuses over Socket.IO.
 *
 * On every (re)connect the adapter asks the server for a snapshot of the
 * floorplan the socket was opened for, then applies `seats:patch` broadcasts.
 * Patches that arrive while the snapshot is in flight are held and replayed
 * after it; the viewer drops those already included (revision <= snapshot's).
 * Reconnection, back-off and the long-polling fallback are handled by
 * Socket.IO itself. If the sync fails (error reply or no reply within
 * `syncTimeoutMs`) the adapter reports `offline` and ignores patches until the
 * next successful sync, since they can't be applied without a snapshot.
 *
 * ```ts
 * const socket = io(url, { auth: { token, floorplanId } });
 * viewer.setStatusSource(socketIoStatusSource(socket));
 * ```
 */
export function socketIoStatusSource(
  socket: SocketIoLike,
  options: SocketIoStatusSourceOptions = {}
): StatusSource {
  const syncTimeoutMs = options.syncTimeoutMs ?? DEFAULT_SYNC_TIMEOUT_MS;
  return {
    subscribe(sink: StatusSink): () => void {
      let disposed = false;
      let syncGeneration = 0;
      /** Patches received while a sync is in flight; null when not syncing. */
      let heldPatches: ParsedPatch[] | null = null;
      /** True once a snapshot was applied on the current connection. */
      let synced = false;
      let syncTimer: ReturnType<typeof setTimeout> | undefined;

      const clearSyncTimer = (): void => {
        if (syncTimer !== undefined) clearTimeout(syncTimer);
        syncTimer = undefined;
      };

      /** Stops the current sync (if any); patches are dropped until the next one. */
      const resetSync = (): void => {
        syncGeneration++;
        clearSyncTimer();
        heldPatches = null;
        synced = false;
      };

      const reconnectState = (): StatusConnectionState =>
        socket.active === false ? 'offline' : 'connecting';

      const sync = (): void => {
        resetSync();
        const generation = syncGeneration;
        heldPatches = [];
        sink.connectionState('connecting');
        syncTimer = setTimeout(() => {
          if (disposed || generation !== syncGeneration) return;
          resetSync();
          sink.connectionState(
            'offline',
            new Error(`${SEATS_SYNC_EVENT} timed out after ${syncTimeoutMs} ms`)
          );
        }, syncTimeoutMs);
        const request: SeatsSyncRequest = { v: LIVE_PROTOCOL_VERSION };
        socket.emit(SEATS_SYNC_EVENT, request, (reply: unknown) => {
          // Ignore replies for an older connection, after a timeout or after
          // unsubscribe.
          if (disposed || generation !== syncGeneration) return;
          clearSyncTimer();
          const snapshot = parseSyncReply(reply);
          const held = heldPatches ?? [];
          heldPatches = null;
          if ('error' in snapshot) {
            resetSync();
            sink.connectionState('offline', new Error(snapshot.error));
            return;
          }
          synced = true;
          sink.snapshot(snapshot.statuses, snapshot.rev, snapshot.data);
          for (const patch of held) {
            sink.patch(patch.changes, patch.rev, patch.data);
          }
          sink.connectionState('live');
        });
      };

      const onPatch = (message: unknown): void => {
        const patch = parsePatch(message);
        if (!patch) {
          console.warn('[OpenSeats] Ignoring malformed seats:patch', message);
          return;
        }
        if (heldPatches) {
          heldPatches.push(patch);
        } else if (synced) {
          sink.patch(patch.changes, patch.rev, patch.data);
        }
        // Otherwise there is no snapshot to apply it to; the next sync
        // includes it.
      };

      const onDisconnect = (): void => {
        resetSync();
        sink.connectionState(reconnectState());
      };

      const onConnectError = (error: unknown): void => {
        sink.connectionState(reconnectState(), error);
      };

      socket.on('connect', sync);
      socket.on('disconnect', onDisconnect);
      socket.on('connect_error', onConnectError);
      socket.on(SEATS_PATCH_EVENT, onPatch);

      if (socket.connected) {
        sync();
      } else {
        sink.connectionState(reconnectState());
      }

      return () => {
        disposed = true;
        resetSync();
        socket.off('connect', sync);
        socket.off('disconnect', onDisconnect);
        socket.off('connect_error', onConnectError);
        socket.off(SEATS_PATCH_EVENT, onPatch);
      };
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRevision(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && isFinite(value));
}

/** Seat id -> data object (or `null` when `allowNull`). */
function isSeatDataMap(value: unknown, allowNull: boolean): boolean {
  return (
    isRecord(value) &&
    Object.values(value).every((d) => (allowNull && d === null) || isRecord(d))
  );
}

function parseSyncReply(reply: unknown):
  | {
      statuses: Record<string, string>;
      rev?: number;
      data?: Record<string, SeatData>;
    }
  | { error: string } {
  if (!isRecord(reply)) return { error: 'Invalid seats:sync reply' };
  if (reply['v'] !== LIVE_PROTOCOL_VERSION) {
    return {
      error: `Unsupported live protocol version: ${String(reply['v'])}`,
    };
  }
  if (typeof reply['error'] === 'string') return { error: reply['error'] };
  const statuses = reply['statuses'];
  const rev = reply['rev'];
  const data = reply['data'];
  if (
    !isRecord(statuses) ||
    !isRevision(rev) ||
    !Object.values(statuses).every((s) => typeof s === 'string') ||
    (data !== undefined && !isSeatDataMap(data, false))
  ) {
    return { error: 'Invalid seats:sync reply' };
  }
  return {
    statuses: statuses as Record<string, string>,
    rev,
    data: data as Record<string, SeatData> | undefined,
  };
}

function parsePatch(message: unknown): ParsedPatch | null {
  if (!isRecord(message) || message['v'] !== LIVE_PROTOCOL_VERSION) {
    return null;
  }
  const changes = message['changes'];
  const rev = message['rev'];
  const data = message['data'];
  if (changes === undefined && data === undefined) return null;
  if (
    (changes !== undefined &&
      (!isRecord(changes) ||
        !Object.values(changes).every(
          (s) => s === null || typeof s === 'string'
        ))) ||
    (data !== undefined && !isSeatDataMap(data, true)) ||
    !isRevision(rev)
  ) {
    return null;
  }
  return {
    changes: (changes ?? {}) as StatusChanges,
    rev,
    data: data as SeatDataChanges | undefined,
  };
}
