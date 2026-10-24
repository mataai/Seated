import Konva from 'konva';
import {
  polygonCentroid,
  seatPosition,
  StatusRegistry,
  type Building,
  type Floorplan,
  type Row,
  type Vec2,
  type Zone,
} from '@open-seats/core';
import type {
  HoverStyle,
  Renderer,
  RendererOptions,
  RenderSeatContext,
  SelectedStyle,
} from './renderer.interface';

const DEFAULT_SELECTED_STYLE: Required<SelectedStyle> = {
  fill: '#2196f3',
  stroke: '#ffffff',
  strokeWidth: 2,
};

const DEFAULT_HOVER_STYLE: Required<HoverStyle> = {
  stroke: '#ffffff',
  strokeWidth: 2,
};

export class KonvaRenderer implements Renderer {
  private container: HTMLElement;
  private stage: Konva.Stage;
  private backgroundLayer: Konva.Layer;
  private sceneLayer: Konva.Layer;
  private overlayLayer: Konva.Layer;

  private floorplan: Floorplan | null = null;
  private statusRegistry: StatusRegistry;
  private seatStatuses = new Map<string, string>(); // seatId -> statusKey
  private selectedSeatIds = new Set<string>();
  private hoveredSeatId: string | null = null;

  private seatCircles = new Map<string, Konva.Circle>();
  private seatContexts = new Map<string, RenderSeatContext>();
  private buildingGroups = new Map<string, Konva.Group>();
  private zoneGroups = new Map<string, Konva.Group>();
  private rowGroups = new Map<string, Konva.Group>();
  private rowRects = new Map<string, Konva.Rect>();
  private rowModels = new Map<string, Row>();
  private buildingLines = new Map<string, Konva.Line>();
  private zoneLines = new Map<string, Konva.Line>();
  private selectedNodeIds = new Set<string>();
  private draggableNodes = false;

  private options: RendererOptions;
  private resizeObserver?: ResizeObserver;

  // Background image cache; the token discards loads superseded by a newer load()
  private backgroundImage: HTMLImageElement | null = null;
  private backgroundSrc: string | null = null;
  private backgroundToken = 0;

  // Touch pinch zoom state
  private lastTouchDist = 0;
  private lastTouchCenter: Vec2 = { x: 0, y: 0 };

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
    this.overlayLayer = new Konva.Layer({ name: 'overlay' });

    this.stage.add(this.backgroundLayer);
    this.stage.add(this.sceneLayer);
    this.stage.add(this.overlayLayer);

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

    this.stage.on('click tap', (e) => {
      const worldPos = this.getPointerWorldPosition();
      if (worldPos && this.options.onStageClick) {
        this.options.onStageClick(worldPos, e.evt as MouseEvent | TouchEvent, e.target);
      }
    });

    this.stage.on('mousemove', (e) => {
      const worldPos = this.getPointerWorldPosition();
      if (worldPos && this.options.onStageMouseMove) {
        this.options.onStageMouseMove(worldPos, e.evt as MouseEvent);
      }
    });
  }

  public load(floorplan: Floorplan): void {
    this.floorplan = floorplan;
    this.seatCircles.clear();
    this.seatContexts.clear();
    this.buildingGroups.clear();
    this.zoneGroups.clear();
    this.rowGroups.clear();
    this.rowRects.clear();
    this.buildingLines.clear();
    this.zoneLines.clear();
    this.rowModels.clear();

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
    const token = ++this.backgroundToken;
    if (!floorplan.background?.src) return;

    const bg = floorplan.background;
    const addImage = (imgObj: HTMLImageElement) => {
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

    const cached = this.backgroundImage;
    if (cached && this.backgroundSrc === bg.src) {
      if (cached.complete && cached.naturalWidth > 0) {
        addImage(cached);
      } else {
        cached.addEventListener(
          'load',
          () => {
            if (token === this.backgroundToken) addImage(cached);
          },
          { once: true }
        );
      }
      return;
    }

    const imgObj = new Image();
    imgObj.crossOrigin = 'Anonymous';
    this.backgroundImage = imgObj;
    this.backgroundSrc = bg.src;
    imgObj.addEventListener(
      'load',
      () => {
        if (token === this.backgroundToken) addImage(imgObj);
      },
      { once: true }
    );
    imgObj.src = bg.src;
  }

  private flattenPoints(points: Vec2[]): number[] {
    const flat: number[] = new Array(points.length * 2);
    let idx = 0;
    for (let i = 0; i < points.length; i++) {
      flat[idx++] = points[i].x;
      flat[idx++] = points[i].y;
    }
    return flat;
  }

  private bindNodeDrag(
    group: Konva.Group,
    nodeId: string,
    nodeType: 'building' | 'zone' | 'row'
  ): void {
    group.on('dragstart', (e) => {
      e.cancelBubble = true;
      this.stage.draggable(false);
      this.options.onNodeDragStart?.(nodeId, nodeType);
    });

    group.on('dragmove', (e) => {
      e.cancelBubble = true;
      this.options.onNodeDragMove?.(nodeId, nodeType, group.position());
    });

    group.on('dragend', (e) => {
      e.cancelBubble = true;
      this.stage.draggable(true);
      this.options.onNodeDragEnd?.(
        nodeId,
        nodeType,
        group.position(),
        e.evt as MouseEvent
      );
    });
  }

  private bindNodeInteractions(
    target: Konva.Node,
    group: Konva.Group,
    nodeId: string,
    nodeType: 'building' | 'zone' | 'row'
  ): void {
    target.on('mouseenter', () => {
      if (this.draggableNodes) {
        this.stage.container().style.cursor = this.selectedNodeIds.has(nodeId)
          ? 'move'
          : 'pointer';
      }
    });

    target.on('mouseleave', () => {
      if (this.draggableNodes) {
        this.stage.container().style.cursor = 'default';
      }
    });

    target.on('pointerdown', (e) => {
      if (this.draggableNodes) {
        e.cancelBubble = true;
        if (!this.selectedNodeIds.has(nodeId)) {
          this.options.onNodeClick?.(nodeId, nodeType, e.evt as MouseEvent);
          group.draggable(true);
        }
      }
    });

    target.on('click tap', (e) => {
      this.options.onNodeClick?.(nodeId, nodeType, e.evt as MouseEvent);
    });
  }

  private renderScene(floorplan: Floorplan): void {
    for (const building of floorplan.buildings) {
      const isBuildingSelected = this.selectedNodeIds.has(building.id);
      const bGroup = new Konva.Group({
        id: `building-${building.id}`,
        x: building.position.x,
        y: building.position.y,
        rotation: building.rotation,
        draggable: this.draggableNodes && isBuildingSelected,
      });
      this.buildingGroups.set(building.id, bGroup);
      this.bindNodeDrag(bGroup, building.id, 'building');

      const bLine = new Konva.Line({
        points: this.flattenPoints(building.points),
        closed: true,
        stroke: isBuildingSelected ? '#3b82f6' : '#4a4a4a',
        strokeWidth: isBuildingSelected ? 3 : 2,
        fill: isBuildingSelected
          ? 'rgba(59, 130, 246, 0.15)'
          : 'rgba(30, 30, 30, 0.4)',
        listening: true,
      });

      this.bindNodeInteractions(bLine, bGroup, building.id, 'building');

      this.buildingLines.set(building.id, bLine);
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
    const isZoneSelected = this.selectedNodeIds.has(zone.id);
    const zGroup = new Konva.Group({
      id: `zone-${zone.id}`,
      x: zone.position.x,
      y: zone.position.y,
      rotation: zone.rotation,
      draggable: this.draggableNodes && isZoneSelected,
    });
    this.zoneGroups.set(zone.id, zGroup);
    this.bindNodeDrag(zGroup, zone.id, 'zone');

    let strokeColor = 'transparent';
    if (isZoneSelected) {
      strokeColor = '#3b82f6';
    } else if (zone.stroke) {
      strokeColor = zone.stroke;
    }

    let strokeWidth = 0;
    if (isZoneSelected) {
      strokeWidth = 3;
    } else if (zone.stroke) {
      strokeWidth = 1;
    }

    const zLine = new Konva.Line({
      points: this.flattenPoints(zone.points),
      closed: true,
      fill: zone.fill,
      stroke: strokeColor,
      strokeWidth,
      opacity: zone.opacity ?? 1,
      listening: true,
    });

    this.bindNodeInteractions(zLine, zGroup, zone.id, 'zone');

    this.zoneLines.set(zone.id, zLine);
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
    const isRowSelected = this.selectedNodeIds.has(row.id);
    const rGroup = new Konva.Group({
      id: `row-${row.id}`,
      x: row.position.x,
      y: row.position.y,
      rotation: row.rotation,
      draggable: this.draggableNodes && isRowSelected,
    });
    this.rowGroups.set(row.id, rGroup);
    this.rowModels.set(row.id, row);
    this.bindNodeDrag(rGroup, row.id, 'row');
    this.bindNodeInteractions(rGroup, rGroup, row.id, 'row');

    let maxIndex = 0;
    for (const seat of row.seats ?? []) {
      if (seat.index > maxIndex) {
        maxIndex = seat.index;
      }
    }

    // Row Table Body / Bounding Rect
    const hasTable = row.tableWidth > 0;
    const bodyWidth = maxIndex * row.seatSpacing + 2 * row.seatRadius;
    const bodyHeight = hasTable ? row.tableWidth : row.seatRadius * 2 + 10;
    const yOffset = hasTable ? -row.tableWidth / 2 : -bodyHeight / 2;

    let tableFill = 'transparent';
    if (hasTable) {
      tableFill = row.tableStyle?.fill ?? '#2c2c2c';
    } else if (isRowSelected) {
      tableFill = 'rgba(59, 130, 246, 0.08)';
    }

    let tableStroke = 'transparent';
    if (isRowSelected) {
      tableStroke = '#3b82f6';
    } else if (hasTable) {
      tableStroke = row.tableStyle?.stroke ?? '#444444';
    }

    let tableStrokeWidth = 0;
    if (isRowSelected) {
      tableStrokeWidth = 2.5;
    } else if (hasTable) {
      tableStrokeWidth = row.tableStyle?.strokeWidth ?? 1;
    }

    const tableRect = new Konva.Rect({
      x: -row.seatRadius - (hasTable ? 0 : 4),
      y: yOffset,
      width: bodyWidth + (hasTable ? 0 : 8),
      height: bodyHeight,
      fill: tableFill,
      stroke: tableStroke,
      strokeWidth: tableStrokeWidth,
      dash: hasTable ? [] : [5, 4],
      cornerRadius: row.tableStyle?.cornerRadius ?? 4,
      listening: true,
    });

    this.bindNodeInteractions(tableRect, rGroup, row.id, 'row');

    this.rowRects.set(row.id, tableRect);
    rGroup.add(tableRect);

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

      seatCircle.on('pointerdown', (e) => {
        if (this.draggableNodes) {
          e.cancelBubble = true;
          if (!this.selectedNodeIds.has(row.id)) {
            this.options.onNodeClick?.(row.id, 'row', e.evt as MouseEvent);
            rGroup.draggable(true);
          }
        }
      });

      seatCircle.on('click tap', (e) => {
        if (this.draggableNodes) {
          e.cancelBubble = true;
          this.options.onNodeClick?.(row.id, 'row', e.evt as MouseEvent);
        } else if (statusDef.selectable) {
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
      circle.fill(selStyle.fill ?? DEFAULT_SELECTED_STYLE.fill);
      circle.stroke(selStyle.stroke ?? DEFAULT_SELECTED_STYLE.stroke);
      circle.strokeWidth(selStyle.strokeWidth ?? DEFAULT_SELECTED_STYLE.strokeWidth);
      circle.opacity(1);
    } else {
      circle.fill(statusDef.style.fill);
      circle.stroke(statusDef.style.stroke ?? '#1a1a1a');
      circle.strokeWidth(1);
      circle.opacity(statusDef.style.opacity ?? 1);
    }

    if (isHovered && !isSelected) {
      circle.stroke(hovStyle.stroke ?? DEFAULT_HOVER_STYLE.stroke);
      circle.strokeWidth(hovStyle.strokeWidth ?? DEFAULT_HOVER_STYLE.strokeWidth);
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

  public setSelectedNodeIds(ids: string[]): void {
    this.selectedNodeIds = new Set(ids);

    // Update buildings
    for (const [id, line] of this.buildingLines) {
      const isSel = this.selectedNodeIds.has(id);
      line.stroke(isSel ? '#3b82f6' : '#4a4a4a');
      line.strokeWidth(isSel ? 3 : 2);
      line.fill(isSel ? 'rgba(59, 130, 246, 0.15)' : 'rgba(30, 30, 30, 0.4)');
      const group = this.buildingGroups.get(id);
      if (group) {
        group.draggable(this.draggableNodes && isSel);
      }
    }

    // Update zones
    for (const [id, line] of this.zoneLines) {
      const isSel = this.selectedNodeIds.has(id);
      line.stroke(isSel ? '#3b82f6' : 'transparent');
      line.strokeWidth(isSel ? 3 : 0);
      const group = this.zoneGroups.get(id);
      if (group) {
        group.draggable(this.draggableNodes && isSel);
      }
    }

    // Update rows
    for (const [id, rect] of this.rowRects) {
      const isSel = this.selectedNodeIds.has(id);
      const row = this.rowModels.get(id);
      const hasTable = !!row && row.tableWidth > 0;

      let stroke = 'transparent';
      let strokeWidth = 0;
      let fill = isSel ? 'rgba(59, 130, 246, 0.08)' : 'transparent';

      if (isSel) {
        stroke = '#3b82f6';
        strokeWidth = 2.5;
      } else if (hasTable) {
        stroke = row?.tableStyle?.stroke ?? '#444444';
        strokeWidth = row?.tableStyle?.strokeWidth ?? 1;
        fill = row?.tableStyle?.fill ?? '#2c2c2c';
      }

      rect.stroke(stroke);
      rect.strokeWidth(strokeWidth);
      rect.fill(fill);

      const group = this.rowGroups.get(id);
      if (group) {
        group.draggable(this.draggableNodes && isSel);
      }
    }

    this.sceneLayer.batchDraw();
  }

  public getSelectedNodeIds(): string[] {
    return Array.from(this.selectedNodeIds);
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

  public getPosition(): Vec2 {
    return this.stage.position();
  }

  public getHoveredSeatId(): string | null {
    return this.hoveredSeatId;
  }

  public setDraggableNodes(enabled: boolean): void {
    this.draggableNodes = enabled;
    this.setSelectedNodeIds(Array.from(this.selectedNodeIds));
  }

  public setStageDraggable(enabled: boolean): void {
    this.stage.draggable(enabled);
  }

  public setCursor(cursor: string): void {
    this.stage.container().style.cursor = cursor;
  }

  public getPointerWorldPosition(): Vec2 | null {
    const pointer = this.stage.getPointerPosition();
    if (!pointer) return null;
    const scale = this.stage.scaleX() || 1;
    return {
      x: (pointer.x - this.stage.x()) / scale,
      y: (pointer.y - this.stage.y()) / scale,
    };
  }

  public clearDraftPolygon(): void {
    this.overlayLayer.destroyChildren();
    this.overlayLayer.batchDraw();
  }

  public renderDraftPolygon(points: Vec2[], previewPoint?: Vec2 | null): void {
    this.overlayLayer.destroyChildren();
    if (!points || points.length === 0) {
      this.overlayLayer.batchDraw();
      return;
    }

    const scale = this.stage.scaleX() || 1;
    const allPts = previewPoint ? [...points, previewPoint] : [...points];

    const isClosing =
      points.length >= 3 &&
      previewPoint &&
      points.some(
        (p) => Math.hypot(p.x - previewPoint.x, p.y - previewPoint.y) <= 14 / scale
      );

    // 1. Translucent fill preview if >= 3 points
    if (allPts.length >= 3) {
      const fillPoly = new Konva.Line({
        points: this.flattenPoints(allPts),
        closed: true,
        fill: isClosing ? 'rgba(16, 185, 129, 0.22)' : 'rgba(99, 102, 241, 0.12)',
        listening: false,
      });
      this.overlayLayer.add(fillPoly);
    }

    // 2. Solid edges between confirmed points
    if (points.length >= 2) {
      const confirmedLine = new Konva.Line({
        points: this.flattenPoints(points),
        stroke: '#4f46e5',
        strokeWidth: 2.5 / scale,
        lineCap: 'round',
        lineJoin: 'round',
        shadowColor: '#4f46e5',
        shadowBlur: 4,
        shadowOpacity: 0.35,
        listening: false,
      });
      this.overlayLayer.add(confirmedLine);
    }

    // 3. Dynamic rubberband edge to preview point
    if (previewPoint && points.length > 0) {
      const lastPt = points[points.length - 1];
      const previewLine = new Konva.Line({
        points: [lastPt.x, lastPt.y, previewPoint.x, previewPoint.y],
        stroke: isClosing ? '#10b981' : '#6366f1',
        strokeWidth: 2 / scale,
        dash: [6 / scale, 4 / scale],
        lineCap: 'round',
        listening: false,
      });
      this.overlayLayer.add(previewLine);

      // Closing guide line back to first point
      if (points.length >= 2 && !isClosing) {
        const firstPt = points[0];
        const closingGuide = new Konva.Line({
          points: [previewPoint.x, previewPoint.y, firstPt.x, firstPt.y],
          stroke: 'rgba(99, 102, 241, 0.45)',
          strokeWidth: 1.5 / scale,
          dash: [4 / scale, 4 / scale],
          listening: false,
        });
        this.overlayLayer.add(closingGuide);
      }
    }

    // 4. Vertex handles
    points.forEach((pt, idx) => {
      const isFirst = idx === 0;
      const canClose = isFirst && points.length >= 3;

      if (canClose) {
        const ring = new Konva.Circle({
          x: pt.x,
          y: pt.y,
          radius: (isClosing ? 12 : 9) / scale,
          stroke: '#10b981',
          strokeWidth: 2 / scale,
          dash: [4 / scale, 3 / scale],
          listening: false,
        });
        this.overlayLayer.add(ring);
      }

      const circle = new Konva.Circle({
        x: pt.x,
        y: pt.y,
        radius: (canClose ? 6 : 5) / scale,
        fill: canClose ? '#10b981' : '#ffffff',
        stroke: canClose ? '#ffffff' : '#4f46e5',
        strokeWidth: 2 / scale,
        shadowColor: '#000000',
        shadowBlur: 3,
        shadowOpacity: 0.25,
        listening: false,
      });
      this.overlayLayer.add(circle);
    });

    this.overlayLayer.batchDraw();
  }

  public renderDraftRectangle(
    corner1: Vec2,
    currentCorner: Vec2,
    isInvalid = false
  ): void {
    this.overlayLayer.destroyChildren();

    const scale = this.stage.scaleX() || 1;
    const minX = Math.min(corner1.x, currentCorner.x);
    const minY = Math.min(corner1.y, currentCorner.y);
    const width = Math.abs(currentCorner.x - corner1.x);
    const height = Math.abs(currentCorner.y - corner1.y);

    const fillColor = isInvalid
      ? 'rgba(239, 68, 68, 0.2)'
      : 'rgba(99, 102, 241, 0.15)';
    const strokeColor = isInvalid ? '#ef4444' : '#4f46e5';

    // 1. Translucent fill rectangle
    const rect = new Konva.Rect({
      x: minX,
      y: minY,
      width,
      height,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth: 2 / scale,
      dash: isInvalid ? [4 / scale, 4 / scale] : [6 / scale, 4 / scale],
      listening: false,
    });
    this.overlayLayer.add(rect);

    // 2. Corner markers
    const corners = [
      { x: corner1.x, y: corner1.y, isStart: true },
      { x: currentCorner.x, y: currentCorner.y, isStart: false },
    ];
    for (const c of corners) {
      let cornerFill = '#ffffff';
      let cornerStroke = '#4f46e5';

      if (isInvalid) {
        cornerFill = '#ef4444';
        cornerStroke = '#ffffff';
      } else if (c.isStart) {
        cornerFill = '#10b981';
        cornerStroke = '#ffffff';
      }

      const circle = new Konva.Circle({
        x: c.x,
        y: c.y,
        radius: (c.isStart ? 6 : 5) / scale,
        fill: cornerFill,
        stroke: cornerStroke,
        strokeWidth: 2 / scale,
        shadowColor: '#000000',
        shadowBlur: 3,
        shadowOpacity: 0.25,
        listening: false,
      });
      this.overlayLayer.add(circle);
    }

    // 3. Live dimensions badge
    if (width > 20 && height > 15) {
      const textVal = isInvalid
        ? `${Math.round(width)} × ${Math.round(height)} px (overlaps building)`
        : `${Math.round(width)} × ${Math.round(height)} px`;
      const text = new Konva.Text({
        x: minX + 8 / scale,
        y: minY + 8 / scale,
        text: textVal,
        fontSize: 11 / scale,
        fontFamily: 'sans-serif',
        fontStyle: 'bold',
        fill: isInvalid ? '#f87171' : '#38bdf8',
        listening: false,
      });
      this.overlayLayer.add(text);
    }

    this.overlayLayer.batchDraw();
  }

  public getScale(): number {
    return this.stage.scaleX();
  }

  public getStageElement(): HTMLElement {
    return this.stage.container();
  }

  public destroy(): void {
    this.backgroundToken++;
    this.backgroundImage = null;
    this.backgroundSrc = null;
    this.resizeObserver?.disconnect();
    this.stage.destroy();
    this.seatCircles.clear();
    this.seatContexts.clear();
    this.buildingGroups.clear();
    this.zoneGroups.clear();
    this.rowGroups.clear();
    this.rowRects.clear();
    this.rowModels.clear();
    this.buildingLines.clear();
    this.zoneLines.clear();
    this.seatStatuses.clear();
    this.selectedSeatIds.clear();
    this.selectedNodeIds.clear();
  }
}

export function createRenderer(options: RendererOptions): Renderer {
  return new KonvaRenderer(options);
}
