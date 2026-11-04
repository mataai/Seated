import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Floorplan } from '@open-seats/core';
import { createViewer, type ViewerInstance } from '../src';

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
          ],
        },
      ],
    },
  ],
};

describe('Viewer seat data', () => {
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

  it('merges, removes with null and replaces seat data', () => {
    viewer = createViewer(container, {
      floorplan: plan,
      seatData: { 's-1': { price: 50 } },
    });
    const changed = vi.fn();
    viewer.on('seatDataChanged', changed);

    viewer.setSeatData({ 's-2': { price: 70 } });
    expect(viewer.getSeatData('s-1')).toEqual({ price: 50 });
    expect(viewer.getSeatData('s-2')).toEqual({ price: 70 });

    viewer.setSeatData({ 's-1': null });
    expect(viewer.getSeatData('s-1')).toBeUndefined();

    viewer.setSeatData({ 's-1': { ticket: 'T-1' } }, { replace: true });
    expect(viewer.getSeatData('s-1')).toEqual({ ticket: 'T-1' });
    expect(viewer.getSeatData('s-2')).toBeUndefined();
    expect(changed).toHaveBeenLastCalledWith({
      changes: { 's-1': { ticket: 'T-1' } },
      replaced: true,
      source: 'app',
    });
  });

  it('is never written into the floorplan', () => {
    viewer = createViewer(container, { floorplan: plan });
    viewer.setSeatData({ 's-1': { holder: 'Ada' } });
    expect(JSON.stringify(viewer.getFloorplan())).not.toContain('Ada');
  });

  it('gives the tooltip provider the seat status and data, and refreshes on change', async () => {
    const provider = vi.fn(async ({ seat, status, data }) => ({
      title: seat.label,
      content: `${status}:${String(data?.['ticket'] ?? '-')}`,
    }));
    viewer = createViewer(container, {
      floorplan: plan,
      statuses: { 's-1': 'reserved' },
      tooltipProvider: provider,
      tooltipDebounceMs: 10,
    });
    const tooltipText = () =>
      container.querySelector('.open-seats-tooltip')?.textContent;

    (viewer as any).tooltipManager.show(
      {
        seat: plan.buildings[0].rows[0].seats[0],
        row: plan.buildings[0].rows[0],
        building: plan.buildings[0],
      },
      new MouseEvent('mousemove', { clientX: 10, clientY: 10 })
    );
    await vi.advanceTimersByTimeAsync(20);
    expect(tooltipText()).toBe('Hall-A-1reserved:-');

    viewer.setSeatData({ 's-1': { ticket: 'T-7' } });
    await vi.advanceTimersByTimeAsync(0);
    expect(tooltipText()).toBe('Hall-A-1reserved:T-7');
  });

  describe('live data', () => {
    it('merges live data under app data; app fields win', () => {
      viewer = createViewer(container, {
        floorplan: plan,
        seatData: { 's-1': { ticket: 'T-1', price: 10 } },
      });
      viewer.applyStatusSnapshot(
        {},
        { data: { 's-1': { price: 95, tier: 'Front' }, 's-2': { price: 65 } } }
      );
      expect(viewer.getSeatData('s-1')).toEqual({
        price: 10,
        tier: 'Front',
        ticket: 'T-1',
      });
      expect(viewer.getSeatData('s-2')).toEqual({ price: 65 });
    });

    it('a snapshot replaces live data only, never app data', () => {
      viewer = createViewer(container, {
        floorplan: plan,
        seatData: { 's-1': { ticket: 'T-1' } },
      });
      viewer.applyStatusSnapshot({}, { data: { 's-2': { price: 65 } } });
      viewer.applyStatusSnapshot({}); // no data: live data is cleared
      expect(viewer.getSeatData('s-2')).toBeUndefined();
      expect(viewer.getSeatData('s-1')).toEqual({ ticket: 'T-1' });
    });

    it('patches update live data, honour revisions and tag the source', () => {
      viewer = createViewer(container, { floorplan: plan });
      const changed = vi.fn();
      const statusesChanged = vi.fn();
      viewer.on('seatDataChanged', changed);
      viewer.on('statusesChanged', statusesChanged);
      viewer.applyStatusSnapshot({}, { revision: 1 });
      statusesChanged.mockClear();

      expect(
        viewer.applyStatusPatch(
          {},
          { revision: 2, data: { 's-1': { price: 5 } } }
        )
      ).toBe(true);
      expect(viewer.getSeatData('s-1')).toEqual({ price: 5 });
      // A data-only patch doesn't report a status change.
      expect(statusesChanged).not.toHaveBeenCalled();
      expect(changed).toHaveBeenLastCalledWith({
        changes: { 's-1': { price: 5 } },
        replaced: false,
        source: 'live',
      });

      expect(
        viewer.applyStatusPatch({}, { revision: 2, data: { 's-1': null } })
      ).toBe(false);
      expect(viewer.getSeatData('s-1')).toEqual({ price: 5 });

      viewer.setSeatData({ 's-2': { ticket: 'T-9' } });
      expect(changed).toHaveBeenLastCalledWith({
        changes: { 's-2': { ticket: 'T-9' } },
        replaced: false,
        source: 'app',
      });
    });

    it('delivers data from a status source to the viewer', () => {
      let sink: import('../src').StatusSink | undefined;
      viewer = createViewer(container, { floorplan: plan });
      viewer.setStatusSource({
        subscribe: (s) => {
          sink = s;
          return () => undefined;
        },
      });
      sink!.snapshot({ 's-1': 'reserved' }, 1, { 's-1': { price: 95 } });
      sink!.patch({}, 2, { 's-2': { price: 40 } });
      expect(viewer.getSeatData('s-1')).toEqual({ price: 95 });
      expect(viewer.getSeatData('s-2')).toEqual({ price: 40 });
    });
  });

  describe('custom tooltip renderer', () => {
    const hover = (index = 0) =>
      (viewer as any).tooltipManager.show(
        {
          seat: plan.buildings[0].rows[0].seats[index],
          row: plan.buildings[0].rows[0],
          building: plan.buildings[0],
        },
        new MouseEvent('mousemove', { clientX: 10, clientY: 10 })
      );
    const host = () =>
      container.querySelector<HTMLElement>('.open-seats-tooltip')!;

    const createWithRenderer = () => {
      const cleanup = vi.fn();
      const renderer = vi.fn((ctx, el: HTMLElement) => {
        const card = document.createElement('my-card');
        card.textContent = `${ctx.seat.label}:${ctx.status}:${String(
          ctx.data?.['price'] ?? '-'
        )}`;
        el.appendChild(card);
        return cleanup;
      });
      const provider = vi.fn(async () => ({ title: 'unused' }));
      viewer = createViewer(container, {
        floorplan: plan,
        tooltipRenderer: renderer,
        tooltipProvider: provider,
        tooltipDebounceMs: 10,
      });
      return { renderer, cleanup, provider };
    };

    it('renders into an unstyled host after the hover delay', async () => {
      const { renderer, provider } = createWithRenderer();
      hover();
      expect(renderer).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(20);

      expect(host().textContent).toBe('Hall-A-1:available:-');
      expect(host().classList).toContain('open-seats-tooltip--custom');
      expect(host().style.background).toBe('');
      expect(provider).not.toHaveBeenCalled(); // renderer wins
    });

    it('re-renders on status or data changes and cleans up on hide', async () => {
      const { renderer, cleanup } = createWithRenderer();
      hover();
      await vi.advanceTimersByTimeAsync(20);

      viewer!.applyStatusPatch({ 's-1': 'reserved' });
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(host().textContent).toBe('Hall-A-1:reserved:-');

      viewer!.setSeatData({ 's-1': { price: 120 } });
      expect(host().textContent).toBe('Hall-A-1:reserved:120');

      // Other seats changing leaves the open tooltip alone.
      viewer!.applyStatusPatch({ 's-2': 'reserved' });
      expect(renderer).toHaveBeenCalledTimes(3);

      (viewer as any).tooltipManager.hide();
      // Content stays while the tooltip fades out, then is torn down.
      expect(cleanup).toHaveBeenCalledTimes(2);
      expect(host().textContent).toBe('Hall-A-1:reserved:120');
      await vi.advanceTimersByTimeAsync(150);
      expect(cleanup).toHaveBeenCalledTimes(3);
      expect(host().textContent).toBe('');
    });

    it('keeps the rendered content while the pointer stays on the seat', async () => {
      const { renderer } = createWithRenderer();
      hover();
      await vi.advanceTimersByTimeAsync(20);
      hover();
      await vi.advanceTimersByTimeAsync(20);
      expect(renderer).toHaveBeenCalledTimes(1);
    });

    it('renders once, with the new status, for a patch with status and data', async () => {
      const { renderer } = createWithRenderer();
      hover();
      await vi.advanceTimersByTimeAsync(20);
      viewer!.applyStatusPatch(
        { 's-1': 'reserved' },
        { data: { 's-1': { price: 90 } } }
      );
      expect(renderer).toHaveBeenCalledTimes(2);
      expect(host().textContent).toBe('Hall-A-1:reserved:90');
    });

    it('updates the shown content in place when the renderer returns update', async () => {
      const update = vi.fn();
      const destroy = vi.fn();
      const renderer = vi.fn(() => ({ update, destroy }));
      viewer = createViewer(container, {
        floorplan: plan,
        tooltipRenderer: renderer,
        tooltipDebounceMs: 10,
      });
      hover();
      await vi.advanceTimersByTimeAsync(20);
      viewer.setSeatData({ 's-1': { price: 7 } });
      expect(renderer).toHaveBeenCalledTimes(1);
      expect(destroy).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'available', data: { price: 7 } })
      );
    });

    it('refreshes the shown seat while another seat is debouncing', async () => {
      const { renderer } = createWithRenderer();
      hover(0);
      await vi.advanceTimersByTimeAsync(20);
      hover(1); // starts a debounce for the second seat
      hover(0); // back before it fires: content for the first is reused
      viewer!.setSeatData({ 's-1': { price: 33 } });
      expect(renderer).toHaveBeenCalledTimes(2);
      expect(host().textContent).toBe('Hall-A-1:available:33');
    });

    it('re-renders content that changed while fading out when hovered again', async () => {
      const { renderer } = createWithRenderer();
      hover();
      await vi.advanceTimersByTimeAsync(20);
      (viewer as any).tooltipManager.hide();
      viewer!.setSeatData({ 's-1': { price: 12 } });
      hover();
      await vi.advanceTimersByTimeAsync(20);
      expect(renderer).toHaveBeenCalledTimes(2);
      expect(host().textContent).toBe('Hall-A-1:available:12');
    });

    it('can swap the renderer at runtime', async () => {
      const { renderer } = createWithRenderer();
      const next = vi.fn((_ctx, el: HTMLElement) => {
        el.textContent = 'next';
      });
      viewer!.setTooltipRenderer(next);
      hover();
      await vi.advanceTimersByTimeAsync(20);
      expect(renderer).not.toHaveBeenCalled();
      expect(host().textContent).toBe('next');

      viewer!.setTooltipRenderer(null);
      expect(host().classList).not.toContain('open-seats-tooltip--custom');
      expect(host().textContent).toBe('');
    });
  });

  describe('tooltip provider', () => {
    const hover = () =>
      (viewer as any).tooltipManager.show(
        {
          seat: plan.buildings[0].rows[0].seats[0],
          row: plan.buildings[0].rows[0],
          building: plan.buildings[0],
        },
        new MouseEvent('mousemove', { clientX: 10, clientY: 10 })
      );

    it('ignores a response superseded by a newer request', async () => {
      const pending: ((title: string) => void)[] = [];
      viewer = createViewer(container, {
        floorplan: plan,
        tooltipDebounceMs: 10,
        tooltipProvider: () =>
          new Promise((resolve) => pending.push((title) => resolve({ title }))),
      });
      hover();
      await vi.advanceTimersByTimeAsync(20);
      viewer.setSeatData({ 's-1': { price: 100 } });
      expect(pending).toHaveLength(2);
      pending[1]!('new');
      await vi.advanceTimersByTimeAsync(0);
      pending[0]!('old');
      await vi.advanceTimersByTimeAsync(0);
      expect(container.querySelector('.open-seats-tooltip')!.textContent).toBe(
        'new'
      );
    });
  });

  it('does not report an empty snapshot over empty live data', () => {
    viewer = createViewer(container, { floorplan: plan });
    const changed = vi.fn();
    viewer.on('seatDataChanged', changed);
    viewer.applyStatusSnapshot({ 's-1': 'reserved' });
    expect(changed).not.toHaveBeenCalled();
    viewer.applyStatusSnapshot({}, { data: { 's-1': { price: 1 } } });
    viewer.applyStatusSnapshot({});
    expect(changed).toHaveBeenCalledTimes(2);
  });
});
