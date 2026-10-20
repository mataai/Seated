import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Floorplan } from '@open-seats/core';
import { createViewer, type ViewerInstance } from '../src';

describe('Viewer (@open-seats/viewer)', () => {
  let container: HTMLDivElement;
  let viewer: ViewerInstance | null = null;

  const validPlan: Floorplan = {
    schemaVersion: 1,
    dimensions: { width: 800, height: 600 },
    buildings: [
      {
        id: 'b-1',
        label: 'Building 1',
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
            label: 'Row 1',
            position: { x: 100, y: 100 },
            rotation: 0,
            side: 'both',
            seatSpacing: 40,
            seatRadius: 15,
            tableWidth: 30,
            seats: [
              { id: 's-1', index: 0, side: 'a', label: '1A' },
              { id: 's-2', index: 1, side: 'a', label: '2A' },
              { id: 's-3', index: 2, side: 'a', label: '3A' },
            ],
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (viewer) {
      viewer.destroy();
      viewer = null;
    }
    container.remove();
  });

  it('initializes, loads floorplan, and emits ready event', () => {
    const readyCb = vi.fn();
    viewer = createViewer(container);
    viewer.on('ready', readyCb);

    viewer.load(validPlan);
    expect(viewer.getFloorplan()?.schemaVersion).toBe(1);
    expect(viewer.violations.length).toBe(0);
  });

  it('leniently loads floorplan with violations without throwing', () => {
    const invalidPlan: Floorplan = {
      ...validPlan,
      buildings: [
        {
          ...validPlan.buildings[0],
          rows: [
            {
              ...validPlan.buildings[0].rows[0],
              seatSpacing: 10, // Invalid: < 2 * 15 (30) -> seat-overlap!
            },
          ],
        },
      ],
    };

    viewer = createViewer(container);
    expect(() => viewer!.load(invalidPlan)).not.toThrow();
    expect(viewer.violations.length).toBeGreaterThan(0);
    expect(viewer.violations[0].rule).toBe('seat-overlap');
  });

  it('enforces maxSelectable = 1 (single-selection mode auto-deselects previous)', () => {
    viewer = createViewer(container, {
      floorplan: validPlan,
      maxSelectable: 1,
    });

    const selectedCb = vi.fn();
    const deselectedCb = vi.fn();
    const changeCb = vi.fn();

    viewer.on('seatSelected', selectedCb);
    viewer.on('seatDeselected', deselectedCb);
    viewer.on('selectionChanged', changeCb);

    // Select seat 1
    viewer.selectSeats(['s-1']);
    expect(viewer.getSelectedSeatIds()).toEqual(['s-1']);
    expect(changeCb).toHaveBeenCalledWith(
      expect.objectContaining({ selectedSeatIds: ['s-1'] })
    );

    // Select seat 2
    viewer.selectSeats(['s-2']);
    expect(viewer.getSelectedSeatIds()).toEqual(['s-1', 's-2']);
  });

  it('manages statuses and updates correctly', () => {
    viewer = createViewer(container, {
      floorplan: validPlan,
    });

    expect(viewer.getStatus('s-1')).toBe('available');

    viewer.setStatus('s-1', 'reserved');
    expect(viewer.getStatus('s-1')).toBe('reserved');

    viewer.setStatuses({ 's-1': 'locked', 's-2': 'reserved' });
    expect(viewer.getStatus('s-1')).toBe('locked');
    expect(viewer.getStatus('s-2')).toBe('reserved');
  });

  it('handles tooltip provider with debounce and per-seat cache', async () => {
    vi.useFakeTimers();

    const provider = vi.fn(async (ctx) => ({
      title: `Seat ${ctx.seat.label}`,
      content: 'Standard seat',
    }));

    viewer = createViewer(container, {
      floorplan: validPlan,
      tooltipProvider: provider,
      tooltipDebounceMs: 100,
    });

    const ctx = viewer.getSelectedSeats();
    // Simulate hover
    const mouseEvt = new MouseEvent('mousemove', { clientX: 100, clientY: 100 });
    const seatCtx = {
      seat: validPlan.buildings[0].rows[0].seats[0],
      row: validPlan.buildings[0].rows[0],
      building: validPlan.buildings[0],
    };

    (viewer as any).tooltipManager.show(seatCtx, mouseEvt);
    expect(provider).not.toHaveBeenCalled(); // Debouncing

    // Advance timer by 100ms
    await vi.advanceTimersByTimeAsync(110);
    expect(provider).toHaveBeenCalledTimes(1);

    // Hover again on same seat -> should be served from cache immediately without calling provider
    (viewer as any).tooltipManager.show(seatCtx, mouseEvt);
    expect(provider).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('sanitizes unsafe HTML and event handlers in tooltipProvider', async () => {
    vi.useFakeTimers();

    const maliciousHtml = '<span class="safe">Hello</span><script>alert("xss")</script><img src="x" onerror="alert(1)">';
    const provider = vi.fn().mockImplementation(async () => ({
      html: maliciousHtml,
    }));

    viewer = createViewer(container, {
      floorplan: validPlan,
      tooltipProvider: provider,
      tooltipDebounceMs: 0,
    });

    const seatCtx = {
      seat: validPlan.buildings[0].rows[0].seats[0],
      row: validPlan.buildings[0].rows[0],
      building: validPlan.buildings[0],
    };

    const tooltipManager = (viewer as any).tooltipManager;
    tooltipManager.show(seatCtx, new MouseEvent('mousemove', { clientX: 10, clientY: 10 }));
    await vi.advanceTimersByTimeAsync(10);

    const tooltipEl = tooltipManager.tooltipEl as HTMLElement;
    expect(tooltipEl.querySelector('script')).toBeNull();
    const img = tooltipEl.querySelector('img');
    if (img) {
      expect(img.getAttribute('onerror')).toBeNull();
    }
    expect(tooltipEl.textContent).toContain('Hello');

    vi.useRealTimers();
  });

  it('sets up ARIA accessibility attributes and live region', () => {
    viewer = createViewer(container, {
      floorplan: validPlan,
      ariaLabel: 'Concert Hall Floorplan',
    });

    expect(container.getAttribute('role')).toBe('application');
    expect(container.getAttribute('aria-label')).toBe('Concert Hall Floorplan');
    expect(container.tabIndex).toBe(0);

    const liveRegion = container.querySelector('.open-seats-sr-only');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
  });

  it('navigates seats with arrow keys and selects with Space/Enter', () => {
    viewer = createViewer(container, {
      floorplan: validPlan,
    });

    // Press ArrowRight -> focuses first seat (s-1)
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect((viewer as any).renderer.getHoveredSeatId()).toBe('s-1');

    // Press ArrowRight again -> focuses next seat to the right (s-2)
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect((viewer as any).renderer.getHoveredSeatId()).toBe('s-2');

    // Press Space -> selects s-2
    container.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(viewer.getSelectedSeatIds()).toContain('s-2');

    // Press Space again -> deselects s-2
    container.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(viewer.getSelectedSeatIds()).not.toContain('s-2');

    // Press + -> zooms in
    const initialScale = viewer.getScale();
    container.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    expect(viewer.getScale()).toBeGreaterThan(initialScale);

    // Press 0 -> resets zoom
    container.dispatchEvent(new KeyboardEvent('keydown', { key: '0', bubbles: true }));
    expect(viewer.getScale()).toBe(1);
  });
});

