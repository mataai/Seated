# Custom sources

A `StatusSource` connects the viewer to any transport. It has one method: `subscribe(sink)`, which starts delivering updates and returns a function that stops them.

```ts
interface StatusSource {
  subscribe(sink: StatusSink): () => void;
}

interface StatusSink {
  snapshot(statuses, revision?, data?): void; // full state: replaces everything
  patch(changes, revision?, data?): void; // changed seats only
  connectionState(state, error?): void; // 'connecting' | 'live' | 'offline'
}
```

The viewer handles everything else: ordering by revision, resetting seats missing from a snapshot, releasing selected seats that were taken, and refreshing tooltips.

## Polling

<<< @/snippets/live/custom-sources.ts#polling

Each poll sends a snapshot, so no revision bookkeeping is needed. Use `If-None-Match` / ETags on your endpoint to keep unchanged responses small.

## Server-sent events

<<< @/snippets/live/custom-sources.ts#sse

## Without a source

If updates already reach your code another way, apply them directly:

<<< @/snippets/live/custom-sources.ts#direct

## Rules for sources

- Send a **snapshot first**, and again after every reconnect.
- In a snapshot, seats that aren't listed get the default status, and the `data` you pass replaces all live seat data.
- In a patch, `null` resets a seat's status (or removes its data).
- Patches with a `revision` at or below the last one are ignored. A snapshot resets the revision, so a server restart is fine.
- After the returned stop function runs, the viewer ignores the sink.
