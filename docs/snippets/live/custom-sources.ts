import { SAMPLE_FLOORPLAN } from '@open-seats/core';
import {
  createViewer,
  type StatusChanges,
  type StatusSource,
} from '@open-seats/viewer';

// #region polling
/** Polls `GET <url>` for `{ rev, statuses }` and reports a snapshot each time. */
function pollingStatusSource(url: string, intervalMs = 5000): StatusSource {
  return {
    subscribe(sink) {
      let stopped = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const poll = async () => {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const { rev, statuses } = await res.json();
          if (stopped) return;
          sink.snapshot(statuses, rev);
          sink.connectionState('live');
        } catch (error) {
          if (!stopped) sink.connectionState('connecting', error);
        }
        if (!stopped) timer = setTimeout(poll, intervalMs);
      };

      sink.connectionState('connecting');
      void poll();

      // Returned function: stop delivering updates.
      return () => {
        stopped = true;
        clearTimeout(timer);
      };
    },
  };
}

createViewer(document.getElementById('seat-map')!, {
  floorplan: SAMPLE_FLOORPLAN,
  statusSource: pollingStatusSource('/api/floorplans/grand-hall/seats'),
});
// #endregion polling

// #region sse
/** Server-sent events: one `snapshot` event, then `patch` events. */
function sseStatusSource(url: string): StatusSource {
  return {
    subscribe(sink) {
      const events = new EventSource(url);
      sink.connectionState('connecting');

      events.addEventListener('snapshot', (e) => {
        const { rev, statuses, data } = JSON.parse((e as MessageEvent).data);
        sink.snapshot(statuses, rev, data);
        sink.connectionState('live');
      });
      events.addEventListener('patch', (e) => {
        const { rev, changes, data } = JSON.parse((e as MessageEvent).data);
        sink.patch(changes as StatusChanges, rev, data);
      });
      events.onerror = () => sink.connectionState('connecting');

      return () => events.close();
    },
  };
}
// #endregion sse

// #region direct
// Without a source: feed updates yourself from any transport.
const viewer = createViewer(document.getElementById('other-map')!, {
  floorplan: SAMPLE_FLOORPLAN,
});

declare const channel: {
  on(
    event: string,
    cb: (msg: { rev: number; changes: StatusChanges }) => void
  ): void;
};
channel.on('seats', ({ rev, changes }) => {
  viewer.applyStatusPatch(changes, { revision: rev });
});
// #endregion direct

export { sseStatusSource };
