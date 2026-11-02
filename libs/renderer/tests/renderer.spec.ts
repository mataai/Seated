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

  it('renders draft row with red glow and dynamic reason badge when invalid', () => {
    renderer = createRenderer({ container });
    const end1 = { x: 100, y: 100 };
    const end2 = { x: 250, y: 100 };

    // Invalid draft row
    renderer.renderDraftRow?.(
      end1,
      end2,
      { tableWidth: 28 },
      true,
      'overlaps table'
    );
    const overlayLayer = (renderer as any).overlayLayer;
    const children = overlayLayer.getChildren();
    expect(children.length).toBeGreaterThan(0);

    // Group containing tableRect
    const group = children.find((c: any) => c.getClassName?.() === 'Group');
    expect(group).toBeDefined();
    const tableRect = group
      .getChildren()
      .find((c: any) => c.getClassName?.() === 'Rect');
    expect(tableRect).toBeDefined();
    expect(tableRect.fill()).toBe('rgba(239, 68, 68, 0.2)');
    expect(tableRect.stroke()).toBe('#ef4444');
    expect(tableRect.shadowEnabled()).toBe(true);
    expect(tableRect.shadowColor()).toBe('#ef4444');

    // Badge text
    const badgeText = children.find((c: any) => c.getClassName?.() === 'Text');
    expect(badgeText).toBeDefined();
    expect(badgeText.text()).toContain('(overlaps table)');

    // Valid draft row
    renderer.renderDraftRow?.(end1, end2, { tableWidth: 28 }, false);
    const validGroup = overlayLayer
      .getChildren()
      .find((c: any) => c.getClassName?.() === 'Group');
    const validTableRect = validGroup
      .getChildren()
      .find((c: any) => c.getClassName?.() === 'Rect');
    expect(validTableRect.fill()).toBe('rgba(99, 102, 241, 0.15)');
    expect(validTableRect.stroke()).toBe('#6366f1');
    expect(validTableRect.shadowEnabled()).toBe(false);
  });

  it('does not add a pending background image after the background is hidden', () => {
    renderer = createRenderer({ container });
    const bg = { src: 'data:image/png;base64,abc', locked: true };
    renderer.load({ ...testFloorplan, background: bg });
    const r = renderer as any;
    const pendingImg: HTMLImageElement = r.backgroundImage;
    expect(pendingImg).toBeTruthy();

    renderer.load({
      ...testFloorplan,
      background: { ...bg, visible: false },
    });
    // The original image finishes loading after the hide
    pendingImg.dispatchEvent(new Event('load'));
    expect(r.backgroundLayer.getChildren().length).toBe(0);
  });

  it('reports background drags without mutating the floorplan', () => {
    const onBackgroundChange = vi.fn();
    renderer = createRenderer({ container, onBackgroundChange });
    const plan: Floorplan = {
      ...testFloorplan,
      background: { src: 'data:image/png;base64,abc', locked: false },
    };
    renderer.load(plan);
    const r = renderer as any;
    r.backgroundImage.dispatchEvent(new Event('load'));
    const konvaImage = r.backgroundLayer.getChildren()[0];
    konvaImage.position({ x: 25.4, y: 10.6 });
    konvaImage.fire('dragend');

    expect(onBackgroundChange).toHaveBeenCalledWith(
      expect.objectContaining({ position: { x: 25, y: 11 } })
    );
    expect(plan.background?.position).toBeUndefined();
  });

  describe('default view fits all content', () => {
    // A building much larger than the 800x600 jsdom stage, offset from origin
    const bigPlan: Floorplan = {
      schemaVersion: 1,
      dimensions: { width: 800, height: 600 },
      buildings: [
        {
          ...testFloorplan.buildings[0],
          id: 'b-big',
          position: { x: 500, y: 300 },
          points: [
            { x: 0, y: 0 },
            { x: 2400, y: 0 },
            { x: 2400, y: 1200 },
            { x: 0, y: 1200 },
          ],
          zones: [],
          rows: [],
        },
      ],
    };

    const visibleWorldRect = (r: Renderer) => {
      const scale = r.getScale();
      const pos = r.getPosition();
      return {
        x1: -pos.x / scale,
        y1: -pos.y / scale,
        x2: (800 - pos.x) / scale,
        y2: (600 - pos.y) / scale,
      };
    };

    it('zooms out so a large floorplan is fully visible on load', () => {
      renderer = createRenderer({ container, floorplan: bigPlan });
      expect(renderer.getScale()).toBeLessThan(1);
      const view = visibleWorldRect(renderer);
      expect(view.x1).toBeLessThanOrEqual(500);
      expect(view.y1).toBeLessThanOrEqual(300);
      expect(view.x2).toBeGreaterThanOrEqual(2900);
      expect(view.y2).toBeGreaterThanOrEqual(1500);
    });

    it('does not zoom in past 1x for small plans', () => {
      renderer = createRenderer({ container, floorplan: testFloorplan });
      expect(renderer.getScale()).toBe(1);
    });

    it('keeps the user zoom across reloads, and resetZoom re-fits', () => {
      renderer = createRenderer({ container, floorplan: bigPlan });
      const fitted = renderer.getScale();
      renderer.zoomIn(2);
      renderer.load(bigPlan);
      expect(renderer.getScale()).toBeCloseTo(fitted * 2);

      renderer.resetZoom();
      expect(renderer.getScale()).toBeCloseTo(fitted);
    });

    it('re-fits on reload while the view is untouched', () => {
      renderer = createRenderer({ container, floorplan: testFloorplan });
      expect(renderer.getScale()).toBe(1);
      renderer.load(bigPlan);
      expect(renderer.getScale()).toBeLessThan(1);
    });
  });
});
