import Konva from 'konva';
import {
  polygonCentroid,
  seatPosition,
  StatusRegistry,
  type Building,
  type Floorplan,
  type Row,
  type Seat,
  type Zone,
} from '@open-seats/core';
import type {
  HoverStyle,
  Renderer,
  RendererOptions,
  RenderSeatContext,
  SelectedStyle,
} from './renderer.interface';

const DEFAULT_SELECTED_STYLE: SelectedStyle = {
  fill: '#2196f3',
  stroke: '#ffffff',
  strokeWidth: 2,
};

const DEFAULT_HOVER_STYLE: HoverStyle = {
  stroke: '#ffffff',
  strokeWidth: 2,
};

export class KonvaRenderer implements Renderer {
  private container: HTMLElement;
  private stage: Konva.Stage;
  private backgroundLayer: Konva.Layer;
  private sceneLayer: Konva.Layer;

  private floorplan: Floorplan | null = null;
  private statusRegistry: StatusRegistry;
  private seatStatuses = new Map<string, string>(); // seatId -> statusKey
  private selectedSeatIds = new Set<string>();
  private hoveredSeatId: string | null = null;

  private seatCircles = new Map<string, Konva.Circle>();
  private seatContexts = new Map<string, RenderSeatContext>();
  private rowGroups = new Map<string, Konva.Group>();
  private draggableNodes = false;

  private options: RendererOptions;
  private resizeObserver?: ResizeObserver;

  // Touch pinch zoom state
  private lastTouchDist = 0;
  private lastTouchCenter = { x: 0, y: 0 };

  constructor(options: RendererOptions) {
    this.options = options;
    this.draggableNodes = options.draggableNodes ?? false;
    this.container = options.container;
    this.statusRegistry = options.statusRegistry ?? new StatusRegistry();

    if (options.statuses) {
      for (const [seatId, key] of Object.entries(options.statuses)) {
        this.seatStatuses.set(seatId, key);
      }
    }

    if (options.selectedSeatIds) {
      for (const id of options.selectedSeatIds) {
        this.selectedSeatIds.add(id);
      }
    }

    const width = Math.max(this.container.clientWidth || 800, 100);
    const height = Math.max(this.container.clientHeight || 600, 100);

    this.stage = new Konva.Stage({
      container: this.container as HTMLDivElement,
      width,
      height,
      draggable: true,
    });

    this.backgroundLayer = new Konva.Layer({ name: 'background' });
    this.sceneLayer = new Konva.Layer({ name: 'scene' });

    this.stage.add(this.backgroundLayer);
    this.stage.add(this.sceneLayer);

    this.setupInteractions();
    this.setupResizeObserver();

    if (options.floorplan) {
      this.load(options.floorplan);
    }
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            this.stage.width(width);
            this.stage.height(height);
            this.stage.batchDraw();
          }
        }
      });
      this.resizeObserver.observe(this.container);
    }
  }

  private setupInteractions(): void {
    // Wheel zoom centered on pointer
    this.stage.on('wheel', (e) => {
      e.evt.preventDefault();
      const scaleBy = 1.08;
      const oldScale = this.stage.scaleX();
      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - this.stage.x()) / oldScale,
        y: (pointer.y - this.stage.y()) / oldScale,
      };

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
      const clampedScale = Math.max(0.1, Math.min(newScale, 10));

      this.stage.scale({ x: clampedScale, y: clampedScale });
      this.stage.position({
        x: pointer.x - mousePointTo.x * clampedScale,
        y: pointer.y - mousePointTo.y * clampedScale,
      });
      this.stage.batchDraw();
    });

    // Touch pinch-to-zoom
    this.stage.on('touchmove', (e) => {
      const touch1 = e.evt.touches[0];
      const touch2 = e.evt.touches[1];

      if (touch1 && touch2) {
        if (this.stage.isDragging()) {
          this.stage.stopDrag();
        }

        const p1 = { x: touch1.clientX, y: touch1.clientY };
        const p2 = { x: touch2.clientX, y: touch2.clientY };
        const dist = Math.sqrt(
          Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
        );

        if (!this.lastTouchDist) {
          this.lastTouchDist = dist;
        }

        const center = {
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2,
        };

        const oldScale = this.stage.scaleX();
        const stagePos = this.stage.position();

        const pointTo = {
          x: (center.x - stagePos.x) / oldScale,
          y: (center.y - stagePos.y) / oldScale,
        };

        const scale = (dist / this.lastTouchDist) * oldScale;
        const clampedScale = Math.max(0.1, Math.min(scale, 10));

        this.stage.scale({ x: clampedScale, y: clampedScale });
        this.stage.position({
          x: center.x - pointTo.x * clampedScale,
          y: center.y - pointTo.y * clampedScale,
        });

        this.lastTouchDist = dist;
        this.stage.batchDraw();
      }
    });

    this.stage.on('touchend', () => {
      this.lastTouchDist = 0;
    });
  }

  public load(floorplan: Floorplan): void {
    this.floorplan = floorplan;
    this.seatCircles.clear();
    this.seatContexts.clear();
    this.rowGroups.clear();

    this.backgroundLayer.destroyChildren();
    this.sceneLayer.destroyChildren();

    this.renderBackground(floorplan);
    this.renderScene(floorplan);

    this.stage.batchDraw();
    this.options.onReady?.();
  }

  public getFloorplan(): Floorplan | null {
    return this.floorplan;
  }

  private renderBackground(floorplan: Floorplan): void {
    if (!floorplan.background?.src) return;

    const bg = floorplan.background;
    const imgObj = new Image();
    imgObj.crossOrigin = 'Anonymous';
    imgObj.src = bg.src;

    imgObj.onload = () => {
      const konvaImage = new Konva.Image({
        image: imgObj,
        x: bg.position?.x ?? 0,
        y: bg.position?.y ?? 0,
        scaleX: bg.scale ?? 1,
        scaleY: bg.scale ?? 1,
        opacity: bg.opacity ?? 1,
        listening: !bg.locked,
      });

      this.backgroundLayer.add(konvaImage);
      this.backgroundLayer.batchDraw();
    };
  }

  private renderScene(floorplan: Floorplan): void {
    for (const building of floorplan.buildings) {
      const bGroup = new Konva.Group({
        id: `building-${building.id}`,
        x: building.position.x,
        y: building.position.y,
        rotation: building.rotation,
      });

      // Building boundary polygon
      const bPointsFlattened: number[] = [];
      for (const pt of building.points) {
        bPointsFlattened.push(pt.x, pt.y);
      }

      const bLine = new Konva.Line({
        points: bPointsFlattened,
        closed: true,
        stroke: '#4a4a4a',
        strokeWidth: 2,
        fill: 'rgba(30, 30, 30, 0.4)',
        listening: false,
      });
      bGroup.add(bLine);

      // Render Zones (under rows)
      for (const zone of building.zones) {
        this.renderZone(bGroup, zone);
      }

      // Render Rows
      for (const row of building.rows) {
        this.renderRow(bGroup, row, building);
      }

      this.sceneLayer.add(bGroup);
    }
  }

  private renderZone(parentGroup: Konva.Group, zone: Zone): void {
    const zGroup = new Konva.Group({
      id: `zone-${zone.id}`,
      x: zone.position.x,
      y: zone.position.y,
      rotation: zone.rotation,
    });

    const flattened: number[] = [];
    for (const pt of zone.points) {
      flattened.push(pt.x, pt.y);
    }

    const zLine = new Konva.Line({
      points: flattened,
      closed: true,
      fill: zone.fill,
      stroke: zone.stroke ?? 'transparent',
      strokeWidth: zone.stroke ? 1 : 0,
      opacity: zone.opacity ?? 1,
      listening: false,
    });
    zGroup.add(zLine);

    if (zone.text?.value) {
      const centroid = polygonCentroid(zone.points);
      const offsetX = zone.text.offset?.x ?? 0;
      const offsetY = zone.text.offset?.y ?? 0;

      const zText = new Konva.Text({
        text: zone.text.value,
        x: centroid.x + offsetX,
        y: centroid.y + offsetY,
        fill: zone.text.color ?? '#ffffff',
        fontSize: zone.text.fontSize ?? 14,
        fontFamily: zone.text.fontFamily ?? 'system-ui, sans-serif',
        align: zone.text.align ?? 'center',
        listening: false,
      });
      // Center align text bounding box on point
      zText.offsetX(zText.width() / 2);
      zText.offsetY(zText.height() / 2);
      zGroup.add(zText);
    }

    parentGroup.add(zGroup);
  }

  private renderRow(
    parentGroup: Konva.Group,
    row: Row,
    building: Building
  ): void {
    const rGroup = new Konva.Group({
      id: `row-${row.id}`,
      x: row.position.x,
      y: row.position.y,
      rotation: row.rotation,
      draggable: this.draggableNodes,
    });
    this.rowGroups.set(row.id, rGroup);

    rGroup.on('dragstart', () => {
      this.options.onNodeDragStart?.(row.id, 'row');
    });

    rGroup.on('dragmove', () => {
      this.options.onNodeDragMove?.(row.id, 'row', rGroup.position());
    });

    rGroup.on('dragend', (e) => {
      this.options.onNodeDragEnd?.(
        row.id,
        'row',
        rGroup.position(),
        e.evt as MouseEvent
      );
    });

    rGroup.on('click tap', (e) => {
      this.options.onNodeClick?.(row.id, 'row', e.evt as MouseEvent);
    });

    let maxIndex = 0;
    if (row.seats && row.seats.length > 0) {
      for (const seat of row.seats) {
        if (seat.index > maxIndex) {
          maxIndex = seat.index;
        }
      }
    }

    // Table body: if tableWidth > 0, draw table body
    if (row.tableWidth > 0) {
      const bodyWidth = maxIndex * row.seatSpacing + 2 * row.seatRadius;
      const bodyHeight = row.tableWidth;

      const tableRect = new Konva.Rect({
        x: -row.seatRadius,
        y: -row.tableWidth / 2,
        width: bodyWidth,
        height: bodyHeight,
        fill: row.tableStyle?.fill ?? '#2c2c2c',
        stroke: row.tableStyle?.stroke ?? '#444444',
        strokeWidth: row.tableStyle?.strokeWidth ?? 1,
        cornerRadius: row.tableStyle?.cornerRadius ?? 4,
        listening: true,
      });

      tableRect.on('mouseenter', () => {
        if (this.draggableNodes) {
          this.stage.container().style.cursor = 'move';
        }
      });

      tableRect.on('mouseleave', () => {
        this.stage.container().style.cursor = 'default';
      });

      rGroup.add(tableRect);
    }

    // Seats
    for (const seat of row.seats) {
      const ctx: RenderSeatContext = { seat, row, building };
      this.seatContexts.set(seat.id, ctx);

      const localPos = seatPosition(row, seat);
      const isSelected = this.selectedSeatIds.has(seat.id);
      const isHovered = this.hoveredSeatId === seat.id;
      const statusKey =
        this.seatStatuses.get(seat.id) ?? this.options.defaultStatus ?? 'available';
      const statusDef = this.statusRegistry.get(statusKey);

      const seatCircle = new Konva.Circle({
        id: `seat-${seat.id}`,
        x: localPos.x,
        y: localPos.y,
        radius: row.seatRadius,
        listening: true,
      });

      this.applySeatStyle(seatCircle, statusDef, isSelected, isHovered);

      // Event wiring
      seatCircle.on('pointerenter', (e) => {
        if (statusDef.hoverable !== false) {
          this.hoveredSeatId = seat.id;
          this.applySeatStyle(seatCircle, statusDef, isSelected, true);
          this.sceneLayer.batchDraw();
          this.options.onSeatHover?.(ctx, e.evt as MouseEvent);
        }
      });

      seatCircle.on('pointerleave', (e) => {
        if (this.hoveredSeatId === seat.id) {
          this.hoveredSeatId = null;
          this.applySeatStyle(seatCircle, statusDef, isSelected, false);
          this.sceneLayer.batchDraw();
          this.options.onSeatHoverEnd?.(ctx, e.evt as MouseEvent);
        }
      });

      seatCircle.on('click tap', (e) => {
        if (statusDef.selectable) {
          this.options.onSeatClick?.(ctx, e.evt as MouseEvent | TouchEvent);
        }
      });

      this.seatCircles.set(seat.id, seatCircle);
      rGroup.add(seatCircle);
    }

    parentGroup.add(rGroup);
  }

  private applySeatStyle(
    circle: Konva.Circle,
    statusDef: ReturnType<StatusRegistry['get']>,
    isSelected: boolean,
    isHovered: boolean
  ): void {
    const selStyle = this.options.selectedStyle ?? DEFAULT_SELECTED_STYLE;
    const hovStyle = this.options.hoverStyle ?? DEFAULT_HOVER_STYLE;

    if (isSelected) {
      circle.fill(selStyle.fill ?? DEFAULT_SELECTED_STYLE.fill!);
      circle.stroke(selStyle.stroke ?? DEFAULT_SELECTED_STYLE.stroke!);
      circle.strokeWidth(selStyle.strokeWidth ?? DEFAULT_SELECTED_STYLE.strokeWidth!);
      circle.opacity(1);
    } else {
      circle.fill(statusDef.style.fill);
      circle.stroke(statusDef.style.stroke ?? '#1a1a1a');
      circle.strokeWidth(1);
      circle.opacity(statusDef.style.opacity ?? 1);
    }

    if (isHovered && !isSelected) {
      circle.stroke(hovStyle.stroke ?? DEFAULT_HOVER_STYLE.stroke!);
      circle.strokeWidth(hovStyle.strokeWidth ?? DEFAULT_HOVER_STYLE.strokeWidth!);
    }
  }

  public setStatus(seatId: string, statusKey: string): void {
    this.seatStatuses.set(seatId, statusKey);
    const circle = this.seatCircles.get(seatId);
    if (circle) {
      const statusDef = this.statusRegistry.get(statusKey);
      const isSelected = this.selectedSeatIds.has(seatId);
      const isHovered = this.hoveredSeatId === seatId;
      this.applySeatStyle(circle, statusDef, isSelected, isHovered);
      this.sceneLayer.batchDraw();
    }
  }

  public setStatuses(statuses: Record<string, string>): void {
    for (const [seatId, key] of Object.entries(statuses)) {
      this.seatStatuses.set(seatId, key);
      const circle = this.seatCircles.get(seatId);
      if (circle) {
        const statusDef = this.statusRegistry.get(key);
        const isSelected = this.selectedSeatIds.has(seatId);
        const isHovered = this.hoveredSeatId === seatId;
        this.applySeatStyle(circle, statusDef, isSelected, isHovered);
      }
    }
    this.sceneLayer.batchDraw();
  }

  public getStatus(seatId: string): string {
    return (
      this.seatStatuses.get(seatId) ??
      this.options.defaultStatus ??
      'available'
    );
  }

  public selectSeats(seatIds: string[]): void {
    for (const id of seatIds) {
      this.selectedSeatIds.add(id);
      const circle = this.seatCircles.get(id);
      if (circle) {
        const statusDef = this.statusRegistry.get(this.getStatus(id));
        this.applySeatStyle(circle, statusDef, true, this.hoveredSeatId === id);
      }
    }
    this.sceneLayer.batchDraw();
    this.options.onSelectionChange?.(Array.from(this.selectedSeatIds));
  }

  public deselectSeats(seatIds: string[]): void {
    for (const id of seatIds) {
      this.selectedSeatIds.delete(id);
      const circle = this.seatCircles.get(id);
      if (circle) {
        const statusDef = this.statusRegistry.get(this.getStatus(id));
        this.applySeatStyle(circle, statusDef, false, this.hoveredSeatId === id);
      }
    }
    this.sceneLayer.batchDraw();
    this.options.onSelectionChange?.(Array.from(this.selectedSeatIds));
  }

  public clearSelection(): void {
    for (const id of this.selectedSeatIds) {
      const circle = this.seatCircles.get(id);
      if (circle) {
        const statusDef = this.statusRegistry.get(this.getStatus(id));
        this.applySeatStyle(circle, statusDef, false, this.hoveredSeatId === id);
      }
    }
    this.selectedSeatIds.clear();
    this.sceneLayer.batchDraw();
    this.options.onSelectionChange?.([]);
  }

  public getSelectedSeatIds(): string[] {
    return Array.from(this.selectedSeatIds);
  }

  public setHoveredSeat(seatId: string | null): void {
    if (this.hoveredSeatId === seatId) return;

    if (this.hoveredSeatId) {
      const prevCircle = this.seatCircles.get(this.hoveredSeatId);
      if (prevCircle) {
        const statusDef = this.statusRegistry.get(this.getStatus(this.hoveredSeatId));
        const isSelected = this.selectedSeatIds.has(this.hoveredSeatId);
        this.applySeatStyle(prevCircle, statusDef, isSelected, false);
      }
    }

    this.hoveredSeatId = seatId;

    if (seatId) {
      const nextCircle = this.seatCircles.get(seatId);
      if (nextCircle) {
        const statusDef = this.statusRegistry.get(this.getStatus(seatId));
        const isSelected = this.selectedSeatIds.has(seatId);
        this.applySeatStyle(nextCircle, statusDef, isSelected, true);
      }
    }

    this.sceneLayer.batchDraw();
  }

  public zoomIn(factor = 1.2): void {
    const oldScale = this.stage.scaleX();
    const newScale = Math.min(oldScale * factor, 10);
    this.stage.scale({ x: newScale, y: newScale });
    this.stage.batchDraw();
  }

  public zoomOut(factor = 1.2): void {
    const oldScale = this.stage.scaleX();
    const newScale = Math.max(oldScale / factor, 0.1);
    this.stage.scale({ x: newScale, y: newScale });
    this.stage.batchDraw();
  }

  public resetZoom(): void {
    this.stage.scale({ x: 1, y: 1 });
    this.stage.position({ x: 0, y: 0 });
    this.stage.batchDraw();
  }

  public panTo(x: number, y: number): void {
    this.stage.position({ x, y });
    this.stage.batchDraw();
  }

  public panBy(dx: number, dy: number): void {
    const current = this.stage.position();
    this.stage.position({ x: current.x + dx, y: current.y + dy });
    this.stage.batchDraw();
  }

  public getPosition(): { x: number; y: number } {
    return this.stage.position();
  }

  public getHoveredSeatId(): string | null {
    return this.hoveredSeatId;
  }

  public setDraggableNodes(enabled: boolean): void {
    this.draggableNodes = enabled;
    for (const group of this.rowGroups.values()) {
      group.draggable(enabled);
    }
  }

  public getScale(): number {
    return this.stage.scaleX();
  }

  public getStageElement(): HTMLElement {
    return this.stage.container();
  }

  public destroy(): void {
    this.resizeObserver?.disconnect();
    this.stage.destroy();
    this.seatCircles.clear();
    this.seatContexts.clear();
    this.rowGroups.clear();
    this.selectedSeatIds.clear();
  }
}

export function createRenderer(options: RendererOptions): Renderer {
  return new KonvaRenderer(options);
}
