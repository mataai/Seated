import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Floorplan } from '@open-seats/core';
import { createRenderer, type Renderer } from '../src';

describe('Renderer (KonvaRenderer)', () => {
  let container: HTMLDivElement;
  let renderer: Renderer | null = null;

  const testFloorplan: Floorplan = {
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
        zones: [
          {
            id: 'z-1',
            position: { x: 10, y: 10 },
            rotation: 0,
            points: [
              { x: 0, y: 0 },
              { x: 60, y: 0 },
              { x: 60, y: 40 },
              { x: 0, y: 40 },
            ],
            fill: '#444444',
            text: { value: 'Bar' },
          },
        ],
        rows: [
          {
            id: 'r-1',
            label: 'Table 1',
            position: { x: 100, y: 100 },
            rotation: 0,
            side: 'both',
            seatSpacing: 40,
            seatRadius: 12,
            tableWidth: 24,
            seats: [
              { id: 's-1', index: 0, side: 'a', label: '1A' },
              { id: 's-2', index: 0, side: 'b', label: '1B' },
            ],
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', {
      value: 800,
      configurable: true,
    });
    Object.defineProperty(container, 'clientHeight', {
      value: 600,
      configurable: true,
    });
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (renderer) {
      renderer.destroy();
      renderer = null;
    }
    container.remove();
  });

  it('initializes and creates stage in container', () => {
    renderer = createRenderer({ container });
    expect(renderer.getStageElement()).toBeDefined();
    expect(container.children.length).toBeGreaterThan(0);
  });

  it('loads floorplan and emits onReady', () => {
    const onReady = vi.fn();
    renderer = createRenderer({ container, onReady });

    renderer.load(testFloorplan);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(renderer.getFloorplan()?.schemaVersion).toBe(1);
  });

  it('handles seat selection and triggers onSelectionChange with blue styling that persists across hover and leave', () => {
    const onSelectionChange = vi.fn();
    renderer = createRenderer({
      container,
      floorplan: testFloorplan,
      onSelectionChange,
    });

    const circle1 = (renderer as any).seatCircles.get('s-1');
    expect(circle1).toBeDefined();
    expect(circle1.fill()).toBe('#4caf50'); // default available status (green)

    // Select seat s-1 -> turns blue
    renderer.selectSeats(['s-1']);
    expect(renderer.getSelectedSeatIds()).toEqual(['s-1']);
    expect(onSelectionChange).toHaveBeenCalledWith(['s-1']);
    expect(circle1.fill()).toBe('#2196f3'); // selected color (blue)

    // Hover over selected seat -> stays blue
    circle1.fire('pointerenter', { evt: new MouseEvent('pointerenter') });
    expect(circle1.fill()).toBe('#2196f3');

    // Pointer leaves selected seat -> stays blue (does not revert to green)
    circle1.fire('pointerleave', { evt: new MouseEvent('pointerleave') });
    expect(circle1.fill()).toBe('#2196f3');

    renderer.selectSeats(['s-2']);
    expect(renderer.getSelectedSeatIds()).toContain('s-1');
    expect(renderer.getSelectedSeatIds()).toContain('s-2');

    renderer.deselectSeats(['s-1']);
    expect(renderer.getSelectedSeatIds()).toEqual(['s-2']);
    expect(circle1.fill()).toBe('#4caf50'); // reverted to green

    renderer.clearSelection();
    expect(renderer.getSelectedSeatIds()).toEqual([]);
  });

  it('updates seat statuses', () => {
    renderer = createRenderer({
      container,
      floorplan: testFloorplan,
    });

    expect(renderer.getStatus('s-1')).toBe('available');
    renderer.setStatus('s-1', 'reserved');
    expect(renderer.getStatus('s-1')).toBe('reserved');

    renderer.setStatuses({ 's-1': 'locked', 's-2': 'reserved' });
    expect(renderer.getStatus('s-1')).toBe('locked');
    expect(renderer.getStatus('s-2')).toBe('reserved');
  });

  it('handles zoom and pan controls', () => {
    renderer = createRenderer({
      container,
      floorplan: testFloorplan,
    });

    expect(renderer.getScale()).toBe(1);
    renderer.zoomIn(1.5);
    expect(renderer.getScale()).toBeCloseTo(1.5);

    renderer.zoomOut(1.5);
    expect(renderer.getScale()).toBeCloseTo(1);

    renderer.panTo(50, 100);
    renderer.resetZoom();
    expect(renderer.getScale()).toBe(1);
  });

  it('adds the background image once when loads overlap', () => {
    const images: FakeImage[] = [];
    class FakeImage {
      src = '';
      crossOrigin: string | null = null;
      complete = false;
      naturalWidth = 0;
      width = 100;
      height = 100;
      private listeners: (() => void)[] = [];
      constructor() {
        images.push(this);
      }
      addEventListener(_type: string, cb: () => void) {
        this.listeners.push(cb);
      }
      fireLoad() {
        this.complete = true;
        this.naturalWidth = 100;
        const cbs = this.listeners;
        this.listeners = [];
        cbs.forEach((cb) => cb());
      }
    }
    vi.stubGlobal('Image', FakeImage);

    try {
      const plan: Floorplan = {
        ...testFloorplan,
        background: { src: 'plan.png' },
      };
      renderer = createRenderer({ container, floorplan: plan });
      renderer.load(plan);
      renderer.load(plan);

      // The image element is reused across loads and only the latest load adds it
      expect(images.length).toBe(1);
      images[0].fireLoad();
      const layer = (renderer as any).backgroundLayer;
      expect(layer.getChildren().length).toBe(1);

      // Once loaded, subsequent loads add it synchronously, still exactly once
      renderer.load(plan);
      expect(layer.getChildren().length).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
