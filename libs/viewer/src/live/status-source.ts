/**
 * Live seat-status updates.
 *
 * A viewer shows one floorplan and receives updates for the whole floorplan.
 * A `StatusSource` delivers them; the viewer owns ordering, resets and
 * releasing selected seats that become unavailable. Sources only translate a
 * transport (Socket.IO, polling, ...) into these three calls.
 */

/**
 * - `connecting`: waiting for the first snapshot (initial connect or reconnect).
 * - `live`: a snapshot was applied and patches are flowing.
 * - `offline`: the source gave up (e.g. the server rejected the connection).
 */
export type StatusConnectionState = 'connecting' | 'live' | 'offline';

/** Seat id -> status key. `null` clears the seat back to the default status. */
export type StatusChanges = Record<string, string | null>;

export interface StatusSink {
  /** Full state for the floorplan. Seats not listed get the default status. */
  snapshot(statuses: Record<string, string>, revision?: number): void;
  /** Changed seats only. Ignored when `revision` is not newer than the last one. */
  patch(changes: StatusChanges, revision?: number): void;
  /** Connection state reported by the transport. */
  connectionState(state: StatusConnectionState, error?: unknown): void;
}

export interface StatusSource {
  /** Starts delivering updates to `sink`. Returns a function that stops it. */
  subscribe(sink: StatusSink): () => void;
}

export interface StatusUpdateOptions {
  revision?: number;
}
