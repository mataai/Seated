import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Floorplan } from '@open-seats/core';
import {
  createViewer,
  type StatusSink,
  type StatusSource,
  type ViewerInstance,
} from '../src';

const plan: Floorplan = {
  schemaVersion: 1,
  dimensions: { width: 800, height: 600 },
  buildings: [
    {
      id: 'b-1',
      label: 'Hall',
      position: { x: 50, y: 50 },
      rotation: 0,
      points: [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 300 },
        { x: 0, y: 300 },
      ],
      zones: [],
      rows: [
        {
          id: 'r-1',
          label: 'A',
          position: { x: 100, y: 100 },
          rotation: 0,
          side: 'one',
          seatSpacing: 40,
          seatRadius: 15,
          tableWidth: 30,
          seats: [
            { id: 's-1', index: 0, side: 'a', label: 'Hall-A-1' },
            { id: 's-2', index: 1, side: 'a', label: 'Hall-A-2' },
            { id: 's-3', index: 2, side: 'a', label: 'Hall-A-3' },
          ],
        },
      ],
    },
  ],
};

/** A source the test drives by hand. */
function manualSource() {
  let sink: StatusSink | null = null;
  const stop = vi.fn(() => {
    sink = null;
  });
  const source: StatusSource = {
    subscribe: (s) => {
      sink = s;
      return stop;
    },
  };
  return {
    source,
    stop,
    get sink(): StatusSink {
      if (!sink) throw new Error('not subscribed');
      return sink;
    },
    get subscribed() {
      return sink !== null;
    },
  };
}

describe('Viewer live statuses', () => {
  let container: HTMLDivElement;
  let viewer: ViewerInstance | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.appendChild(container);
  });

  afterEach(() => {
    viewer?.destroy();
    viewer = null;
    container.remove();
    vi.useRealTimers();
  });

  it('a snapshot replaces all statuses; seats not listed get the default', () => {
    viewer = createViewer(container, {
      floorplan: plan,
      statuses: { 's-1': 'reserved', 's-2': 'locked' },
    });
    const changed = vi.fn();
    viewer.on('statusesChanged', changed);

    viewer.applyStatusSnapshot({ 's-3': 'reserved' });

    expect(['s-1', 's-2', 's-3'].map((id) => viewer!.getStatus(id))).toEqual([
      'available',
      'available',
      'reserved',
    ]);
    expect(changed).toHaveBeenCalledWith({
      changes: { 's-3': 'reserved' },
      replaced: true,
    });
  });

  it('patches merge, null resets, and stale revisions are ignored', () => {
    viewer = createViewer(container, { floorplan: plan });
    viewer.applyStatusSnapshot({ 's-1': 'reserved' }, { revision: 5 });

    expect(viewer.applyStatusPatch({ 's-2': 'locked' }, { revision: 5 })).toBe(
      false
    );
    expect(viewer.getStatus('s-2')).toBe('available');

    expect(
      viewer.applyStatusPatch({ 's-1': null, 's-2': 'locked' }, { revision: 6 })
    ).toBe(true);
    expect(viewer.getStatus('s-1')).toBe('available');
    expect(viewer.getStatus('s-2')).toBe('locked');

    expect(viewer.applyStatusPatch({ 's-2': null }, { revision: 4 })).toBe(
      false
    );
    expect(viewer.getStatus('s-2')).toBe('locked');

    // Patches without a revision always apply.
    expect(viewer.applyStatusPatch({ 's-3': 'reserved' })).toBe(true);
    expect(viewer.getStatus('s-3')).toBe('reserved');
  });

  it('a new snapshot resets revision ordering (e.g. server restarted)', () => {
    viewer = createViewer(container, { floorplan: plan });
    viewer.applyStatusSnapshot({}, { revision: 40 });
    viewer.applyStatusSnapshot({}, { revision: 2 });

    expect(
      viewer.applyStatusPatch({ 's-1': 'reserved' }, { revision: 3 })
    ).toBe(true);
  });

  it('deselects selected seats that become unavailable and announces it', () => {
    viewer = createViewer(container, { floorplan: plan });
    viewer.selectSeats(['s-1', 's-2']);
    const invalidated = vi.fn();
    const deselected = vi.fn();
    const selectionChanged = vi.fn();
    viewer.on('selectionInvalidated', invalidated);
    viewer.on('seatDeselected', deselected);
    viewer.on('selectionChanged', selectionChanged);

    viewer.applyStatusPatch({ 's-1': 'reserved', 's-3': 'reserved' });

    expect(viewer.getSelectedSeatIds()).toEqual(['s-2']);
    expect(invalidated).toHaveBeenCalledTimes(1);
    expect(invalidated.mock.calls[0][0]).toMatchObject({
      seatIds: ['s-1'],
      reason: 'status',
    });
    expect(invalidated.mock.calls[0][0].seats[0].seat.label).toBe('Hall-A-1');
    expect(deselected).toHaveBeenCalledTimes(1);
    expect(selectionChanged).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedSeatIds: ['s-2'] })
    );

    vi.advanceTimersByTime(100);
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      'Seat Hall-A-1 is no longer available and was removed from your selection.'
    );
  });

  it('manual setStatuses also releases unavailable selected seats', () => {
    viewer = createViewer(container, { floorplan: plan });
    viewer.selectSeats(['s-1']);
    viewer.setStatus('s-1', 'locked');
    expect(viewer.getSelectedSeatIds()).toEqual([]);
  });

  it('does not emit selectionInvalidated when selected seats stay selectable', () => {
    viewer = createViewer(container, { floorplan: plan });
    viewer.selectSeats(['s-1']);
    const invalidated = vi.fn();
    viewer.on('selectionInvalidated', invalidated);

    viewer.applyStatusPatch({ 's-1': 'available', 's-2': 'reserved' });

    expect(invalidated).not.toHaveBeenCalled();
    expect(viewer.getSelectedSeatIds()).toEqual(['s-1']);
  });

  it('applies snapshots and patches from a status source', async () => {
    const live = manualSource();
    viewer = createViewer(container, {
      floorplan: plan,
      statusSource: live.source,
    });
    const states: (string | null)[] = [];
    viewer.on('connectionStateChanged', ({ state }) => states.push(state));
    await Promise.resolve();

    live.sink.connectionState('connecting');
    live.sink.snapshot({ 's-1': 'reserved' }, 1);
    live.sink.connectionState('live');
    live.sink.connectionState('live'); // duplicates are not re-emitted
    live.sink.patch({ 's-2': 'reserved' }, 2);
    live.sink.patch({ 's-2': null }, 1); // stale

    expect(states).toEqual(['connecting', 'live']);
    expect(viewer.getConnectionState()).toBe('live');
    expect(viewer.getStatus('s-1')).toBe('reserved');
    expect(viewer.getStatus('s-2')).toBe('reserved');
  });

  it('replacing or removing the source stops the old one and drops its calls', () => {
    const first = manualSource();
    const second = manualSource();
    viewer = createViewer(container, { floorplan: plan });

    viewer.setStatusSource(first.source);
    const firstSink = first.sink;
    firstSink.snapshot({}, 10);

    viewer.setStatusSource(second.source);
    expect(first.stop).toHaveBeenCalledTimes(1);
    firstSink.patch({ 's-1': 'reserved' }, 11);
    expect(viewer.getStatus('s-1')).toBe('available');

    // Revision ordering starts over for the new source.
    second.sink.patch({ 's-2': 'reserved' }, 1);
    expect(viewer.getStatus('s-2')).toBe('reserved');

    viewer.setStatusSource(null);
    expect(second.stop).toHaveBeenCalledTimes(1);
    expect(viewer.getConnectionState()).toBeNull();
  });

  it('delivers the first events of an options source to listeners added after creation', async () => {
    const source: StatusSource = {
      subscribe: (sink) => {
        sink.connectionState('connecting');
        return () => undefined;
      },
    };
    viewer = createViewer(container, { floorplan: plan, statusSource: source });
    const states: (string | null)[] = [];
    viewer.on('connectionStateChanged', ({ state }) => states.push(state));
    await Promise.resolve();

    expect(states).toEqual(['connecting']);
  });

  it('never subscribes an options source when replaced before it connects', async () => {
    const fromOptions = manualSource();
    viewer = createViewer(container, {
      floorplan: plan,
      statusSource: fromOptions.source,
    });
    viewer.setStatusSource(null);
    await Promise.resolve();

    expect(fromOptions.subscribed).toBe(false);
  });

  it('emits a null state when the source is removed', () => {
    const live = manualSource();
    viewer = createViewer(container, { floorplan: plan });
    const states: (string | null)[] = [];
    viewer.on('connectionStateChanged', ({ state }) => states.push(state));

    viewer.setStatusSource(null); // nothing connected: no event
    viewer.setStatusSource(live.source);
    live.sink.connectionState('live');
    viewer.setStatusSource(null);

    expect(states).toEqual(['live', null]);
  });

  it('re-emits the same state when the error changes', () => {
    const live = manualSource();
    viewer = createViewer(container, { floorplan: plan });
    const errors: unknown[] = [];
    viewer.on('connectionStateChanged', ({ error }) => errors.push(error));
    viewer.setStatusSource(live.source);

    const expired = new Error('token expired');
    const down = new Error('server down');
    live.sink.connectionState('connecting', expired);
    live.sink.connectionState('connecting', expired);
    live.sink.connectionState('connecting', down);

    expect(errors).toEqual([expired, down]);
  });

  it('destroy stops the status source', async () => {
    const live = manualSource();
    viewer = createViewer(container, {
      floorplan: plan,
      statusSource: live.source,
    });
    await Promise.resolve();
    viewer.destroy();
    viewer = null;
    expect(live.stop).toHaveBeenCalledTimes(1);
    expect(live.subscribed).toBe(false);
  });

  describe('tooltips', () => {
    const seatCtx = (index: number) => ({
      seat: plan.buildings[0].rows[0].seats[index],
      row: plan.buildings[0].rows[0],
      building: plan.buildings[0],
    });
    const hover = (index: number) =>
      (viewer as any).tooltipManager.show(
        seatCtx(index),
        new MouseEvent('mousemove', { clientX: 10, clientY: 10 })
      );
    const tooltipText = () =>
      container.querySelector('.open-seats-tooltip')?.textContent;

    const createWithStatusTooltip = () => {
      const provider = vi.fn(async ({ seat }) => ({
        title: seat.label,
        content: viewer!.getStatus(seat.id),
      }));
      viewer = createViewer(container, {
        floorplan: plan,
        tooltipProvider: provider,
        tooltipDebounceMs: 10,
      });
      return provider;
    };

    it('refreshes an open tooltip when its seat changes status', async () => {
      const provider = createWithStatusTooltip();
      hover(0);
      await vi.advanceTimersByTimeAsync(20);
      expect(tooltipText()).toBe('Hall-A-1available');

      viewer!.applyStatusPatch({ 's-1': 'reserved' });
      await vi.advanceTimersByTimeAsync(0);
      expect(tooltipText()).toBe('Hall-A-1reserved');
      expect(provider).toHaveBeenCalledTimes(2);
    });

    it('only drops cached tooltips of seats that changed', async () => {
      const provider = createWithStatusTooltip();
      hover(0);
      await vi.advanceTimersByTimeAsync(20);
      hover(1);
      await vi.advanceTimersByTimeAsync(20);
      expect(provider).toHaveBeenCalledTimes(2);

      viewer!.applyStatusPatch({ 's-1': 'reserved' });
      hover(1); // unchanged -> cached
      expect(provider).toHaveBeenCalledTimes(2);
      hover(0); // changed -> fetched again
      await vi.advanceTimersByTimeAsync(20);
      expect(provider).toHaveBeenCalledTimes(3);
      expect(tooltipText()).toBe('Hall-A-1reserved');

      viewer!.applyStatusSnapshot({});
      viewer!.refreshTooltips();
      hover(1);
      await vi.advanceTimersByTimeAsync(20);
      expect(provider.mock.calls.length).toBeGreaterThan(3);
    });

    it('clears cached tooltips when a floorplan is loaded', async () => {
      const provider = createWithStatusTooltip();
      hover(0);
      await vi.advanceTimersByTimeAsync(20);
      viewer!.load(plan);
      hover(0);
      await vi.advanceTimersByTimeAsync(20);
      expect(provider).toHaveBeenCalledTimes(2);
    });
  });
});
