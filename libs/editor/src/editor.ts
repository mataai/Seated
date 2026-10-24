import {
  buildingFootprint,
  canPlace,
  flipPolygon,
  inverseTransformPoint,
  parseFloorplan,
  polygonBoundingBox,
  polygonCentroid,
  polygonsOverlap,
  scalePolygon,
  transformPoint,
  TypedEventEmitter,
  validateLayout,
  type Building,
  type Floorplan,
  type FloorplanBackground,
  type Row,
  type Seat,
  type Vec2,
  type Zone,
} from '@open-seats/core';
import { createRenderer, type Renderer } from '@open-seats/renderer';
import { createViewer, type ViewerInstance } from '@open-seats/viewer';
import type { Command } from './history/command-stack';
import { CommandStack } from './history/command-stack';
import { NumberingService } from './numbering/numbering-service';
import type {
  BuildingCreationMode,
  EditorEvents,
  EditorInstance,
  EditorOptions,
  EditorRulesConfig,
  GridSnappingConfig,
  ToolType,
} from './types';

type EditableNode =
  | { kind: 'building'; node: Building; parent: null }
  | { kind: 'zone'; node: Zone; parent: Building }
  | { kind: 'row'; node: Row; parent: Building };

export class Editor implements EditorInstance {
  private container: HTMLElement;
  private floorplan: Floorplan;
  private commandStack = new CommandStack();
  private emitter = new TypedEventEmitter<EditorEvents>();

  private activeTool: ToolType = 'select';
  private selectedNodeIds: string[] = [];
  private isPreviewMode = false;
  private clipboard:
    | { type: 'building'; data: Building }
    | { type: 'zone'; data: Zone }
    | { type: 'row'; data: Row }
    | null = null;

  private isDrawingBuilding = false;
  private buildingCreationMode: BuildingCreationMode = 'outline';
  private draftBuildingPoints: Vec2[] = [];
  private draftBuildingLabel?: string;

  private rules: EditorRulesConfig;
  private grid: GridSnappingConfig;

  private batchDepth = 0;
  private changePending = false;

  private renderer?: Renderer;
  private embeddedViewer?: ViewerInstance;
  private editorCanvasContainer: HTMLDivElement;

  constructor(container: HTMLElement, options: EditorOptions = {}) {
    this.container = container;
    this.rules = {
      enforce: options.rules?.enforce ?? true,
      tolerance: options.rules?.tolerance ?? 0.01,
    };
    this.grid = {
      enabled: options.gridSnapping?.enabled ?? false,
      size: options.gridSnapping?.size ?? 10,
    };

    // parseFloorplan validates the input and returns a fresh copy
    this.floorplan = options.floorplan
      ? parseFloorplan(options.floorplan)
      : {
          schemaVersion: 1,
          dimensions: { width: 1200, height: 800 },
          buildings: [],
        };

    if (getComputedStyle(this.container).position === 'static') {
      this.container.style.position = 'relative';
    }

    if (!this.container.hasAttribute('tabindex')) {
      this.container.tabIndex = 0;
    }
    this.container.addEventListener('keydown', this.onKeyDown);

    this.editorCanvasContainer = document.createElement('div');
    this.editorCanvasContainer.className = 'open-seats-editor-canvas';
    this.editorCanvasContainer.style.width = '100%';
    this.editorCanvasContainer.style.height = '100%';
    this.container.appendChild(this.editorCanvasContainer);

    this.renderer = createRenderer({
      container: this.editorCanvasContainer,
      floorplan: this.floorplan,
      draggableNodes: this.activeTool === 'select',
      onNodeClick: (nodeId) => {
        if (this.activeTool === 'select') {
          this.selectNodes([nodeId]);
        }
      },
      onNodeDragStart: (nodeId) => {
        if (this.activeTool === 'select') {
          if (!this.selectedNodeIds.includes(nodeId)) {
            this.selectNodes([nodeId]);
          }
        }
      },
      onNodeDragEnd: (nodeId, _nodeType, pos) => {
        if (this.activeTool === 'select') {
          queueMicrotask(() => {
            const success = this.moveNode(nodeId, pos);
            if (!success) {
              // Revert visually to valid position if rejected by canPlace
              this.renderer?.load(this.floorplan);
              if (this.selectedNodeIds.length > 0) {
                this.renderer?.setSelectedNodeIds?.(this.selectedNodeIds);
              }
            }
          });
        }
      },
      onStageClick: (worldPos, evt) => {
        this.handleStageClick(worldPos, evt);
      },
      onStageMouseMove: (worldPos, evt) => {
        this.handleStageMouseMove(worldPos, evt);
      },
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.defaultPrevented) return;

    const activeEl =
      typeof document !== 'undefined' ? document.activeElement : null;
    const isTextInputActive =
      activeEl &&
      (activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        (activeEl as HTMLElement).isContentEditable);

    if (isTextInputActive) return;

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    if (isCtrlOrCmd && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
      return;
    }

    if (isCtrlOrCmd && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      this.redo();
      return;
    }

    if (isCtrlOrCmd && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      this.copySelection();
      return;
    }

    if (isCtrlOrCmd && (e.key === 'x' || e.key === 'X')) {
      e.preventDefault();
      this.cutSelection();
      return;
    }

    if (isCtrlOrCmd && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      this.paste();
      return;
    }

    if (isCtrlOrCmd && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      if (this.selectedNodeIds.length > 0) {
        this.duplicateNode(this.selectedNodeIds[0]);
      }
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selectedNodeIds.length > 0) {
        e.preventDefault();
        const ids = [...this.selectedNodeIds];
        this.batch(`Delete ${ids.length} items`, () => {
          for (const id of ids) {
            this.deleteNode(id);
          }
        });
        this.clearSelection();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.isDrawingBuilding || this.activeTool === 'building') {
        this.cancelBuildingCreation();
        return;
      }
      this.clearSelection();
      return;
    }

    // Arrow keys: move/nudge selected items
    if (this.selectedNodeIds.length > 0) {
      let dx = 0;
      let dy = 0;
      const defaultStep = e.shiftKey ? 10 : 2;
      const step = this.grid.enabled ? this.grid.size : defaultStep;

      if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;

      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        const ids = [...this.selectedNodeIds];
        this.batch(`Nudge ${ids.length} items`, () => {
          for (const id of ids) {
            this.nudgeNode(id, dx, dy);
          }
        });
        return;
      }
    }
  };

  private snap(pt: Vec2): Vec2 {
    if (!this.grid.enabled || this.grid.size <= 0) return pt;
    const s = this.grid.size;
    return {
      x: Math.round(pt.x / s) * s,
      y: Math.round(pt.y / s) * s,
    };
  }

  /**
   * Runs `fn` as a single undo step and emits at most one change at the end.
   */
  private batch<T>(name: string, fn: () => T): T {
    this.batchDepth++;
    try {
      return this.commandStack.group(name, fn);
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.changePending) {
        this.changePending = false;
        this.emitChange();
      }
    }
  }

  private emitChange(): void {
    if (this.batchDepth > 0) {
      this.changePending = true;
      return;
    }
    if (this.renderer) {
      this.renderer.load(this.floorplan);
      if (this.selectedNodeIds.length > 0) {
        this.renderer.setSelectedNodeIds?.(this.selectedNodeIds);
      }
    }
    const violations = validateLayout(this.floorplan, {
      tolerance: this.rules.tolerance,
    });
    this.emitter.emit('violationsUpdated', violations);
    this.emitter.emit('change', this.getFloorplan());
  }

  public loadFloorplan(floorplan: Floorplan): void {
    // Validate first so an invalid plan leaves the editor untouched
    const parsed = parseFloorplan(floorplan);
    if (this.isDrawingBuilding) {
      this.cancelBuildingCreation();
    }
    this.floorplan = parsed;
    this.commandStack.clear();
    this.selectedNodeIds = [];
    this.emitChange();
  }

  public getFloorplan(): Floorplan {
    return structuredClone(this.floorplan);
  }

  public setTool(tool: ToolType): void {
    if (tool === 'building') {
      this.startBuildingCreation();
      return;
    }
    if (this.isDrawingBuilding) {
      this.cancelBuildingCreation();
    }
    this.activeTool = tool;
    this.renderer?.setDraggableNodes(tool === 'select');
    this.renderer?.setStageDraggable(true);
    this.renderer?.setCursor(tool === 'pan' ? 'grab' : 'default');
    this.emitter.emit('toolChange', tool);
  }

  public getTool(): ToolType {
    return this.activeTool;
  }

  public startBuildingCreation(
    label?: string,
    mode: BuildingCreationMode = 'outline'
  ): void {
    this.isDrawingBuilding = true;
    this.buildingCreationMode = mode;
    this.draftBuildingPoints = [];
    this.draftBuildingLabel = label;
    this.activeTool = 'building';
    this.clearSelection();
    this.renderer?.setDraggableNodes(false);
    this.renderer?.setStageDraggable(false);
    this.renderer?.setCursor('crosshair');
    this.renderer?.clearDraftPolygon();
    this.emitter.emit('toolChange', 'building');
    this.emitter.emit('buildingCreationStarted', mode);
  }

  public getBuildingCreationMode(): BuildingCreationMode {
    return this.buildingCreationMode;
  }

  public cancelBuildingCreation(): void {
    const wasDrawing = this.isDrawingBuilding || this.activeTool === 'building';
    this.isDrawingBuilding = false;
    this.draftBuildingPoints = [];
    this.draftBuildingLabel = undefined;
    this.renderer?.clearDraftPolygon();
    this.renderer?.setStageDraggable(true);
    this.renderer?.setCursor('default');
    this.activeTool = 'select';
    this.renderer?.setDraggableNodes(true);
    this.emitter.emit('toolChange', 'select');
    if (wasDrawing) {
      this.emitter.emit('buildingCreationCancelled', undefined);
    }
  }

  public finishBuildingCreation(): Building | null {
    if (!this.isDrawingBuilding || this.draftBuildingPoints.length < 3) {
      return null;
    }

    const rawPoints = [...this.draftBuildingPoints];
    const minX = Math.min(...rawPoints.map((p) => p.x));
    const minY = Math.min(...rawPoints.map((p) => p.y));

    const localPoints = rawPoints.map((p) => ({
      x: Math.round((p.x - minX) * 100) / 100,
      y: Math.round((p.y - minY) * 100) / 100,
    }));
    const position = {
      x: Math.round(minX * 100) / 100,
      y: Math.round(minY * 100) / 100,
    };

    const label = this.draftBuildingLabel;
    const createdBuilding = this.createBuilding(localPoints, label, position);
    if (createdBuilding) {
      this.isDrawingBuilding = false;
      this.draftBuildingPoints = [];
      this.draftBuildingLabel = undefined;
      this.renderer?.clearDraftPolygon();
      this.renderer?.setStageDraggable(true);
      this.renderer?.setCursor('default');
      this.activeTool = 'select';
      this.renderer?.setDraggableNodes(true);
      this.emitter.emit('toolChange', 'select');
      this.selectNodes([createdBuilding.id]);
      this.emitter.emit('buildingCreationCompleted', createdBuilding);
    } else {
      this.emitter.emit('buildingCreationFailed', {
        reason:
          'Cannot create building: outline overlaps with an existing building.',
      });
    }
    return createdBuilding;
  }

  public isCreatingBuilding(): boolean {
    return this.isDrawingBuilding;
  }

  public getDraftBuildingPoints(): Vec2[] {
    return [...this.draftBuildingPoints];
  }

  private handleStageClick(
    worldPos: Vec2,
    _evt: MouseEvent | TouchEvent
  ): void {
    if (!this.isDrawingBuilding) return;

    if (this.buildingCreationMode === 'rectangle') {
      const snappedPos = this.snap(worldPos);

      // Corner 1: set starting corner
      if (this.draftBuildingPoints.length === 0) {
        this.draftBuildingPoints.push(snappedPos);
        this.emitter.emit('buildingCreationPointsChange', [
          ...this.draftBuildingPoints,
        ]);
        this.renderer?.renderDraftRectangle(snappedPos, snappedPos);
        return;
      }

      // Corner 2: opposite corner
      const corner1 = this.draftBuildingPoints[0];
      const corner2 = snappedPos;
      const width = Math.abs(corner2.x - corner1.x);
      const height = Math.abs(corner2.y - corner1.y);

      // Ignore if dimensions too small (e.g. accidental click in place)
      if (width < 10 || height < 10) {
        return;
      }

      const minX = Math.min(corner1.x, corner2.x);
      const minY = Math.min(corner1.y, corner2.y);
      const localPoints: Vec2[] = [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height },
      ];
      const position: Vec2 = {
        x: Math.round(minX * 100) / 100,
        y: Math.round(minY * 100) / 100,
      };

      const label = this.draftBuildingLabel;
      const createdBuilding = this.createBuilding(localPoints, label, position);
      if (createdBuilding) {
        this.isDrawingBuilding = false;
        this.draftBuildingPoints = [];
        this.draftBuildingLabel = undefined;
        this.renderer?.clearDraftPolygon();
        this.renderer?.setStageDraggable(true);
        this.renderer?.setCursor('default');
        this.activeTool = 'select';
        this.renderer?.setDraggableNodes(true);
        this.emitter.emit('toolChange', 'select');
        this.selectNodes([createdBuilding.id]);
        this.emitter.emit('buildingCreationCompleted', createdBuilding);
      } else {
        // Creation failed (e.g. overlap with another building).
        // Reset corner placement so user can immediately click new corners without being stuck!
        this.draftBuildingPoints = [];
        this.renderer?.clearDraftPolygon();
        this.emitter.emit('buildingCreationPointsChange', []);
        this.emitter.emit('buildingCreationFailed', {
          reason: 'Cannot create building: overlaps with an existing building.',
        });
      }
      return;
    }

    // Outline mode
    const scale = this.renderer?.getScale() ?? 1;
    const hitThreshold = 14 / scale;

    const existingIndex = this.draftBuildingPoints.findIndex(
      (pt) => Math.hypot(pt.x - worldPos.x, pt.y - worldPos.y) <= hitThreshold
    );

    // If clicked on an existing point:
    // If 3 or more points exist -> complete and save building!
    // If fewer than 3 points exist -> ignore click on existing point (avoid duplicate point)
    if (existingIndex !== -1) {
      if (this.draftBuildingPoints.length >= 3) {
        this.finishBuildingCreation();
      }
      return;
    }

    // Add new point (snapped to grid)
    const ptToAdd = this.snap(worldPos);

    if (this.draftBuildingPoints.length > 0) {
      const lastPt =
        this.draftBuildingPoints[this.draftBuildingPoints.length - 1];
      if (Math.hypot(lastPt.x - ptToAdd.x, lastPt.y - ptToAdd.y) <= 2) {
        return;
      }
    }

    this.draftBuildingPoints.push(ptToAdd);
    this.emitter.emit('buildingCreationPointsChange', [
      ...this.draftBuildingPoints,
    ]);
    this.renderer?.renderDraftPolygon(this.draftBuildingPoints, ptToAdd);
  }

  private handleStageMouseMove(worldPos: Vec2, _evt: MouseEvent): void {
    if (!this.isDrawingBuilding) return;
    if (this.draftBuildingPoints.length === 0) return;

    if (this.buildingCreationMode === 'rectangle') {
      const corner1 = this.draftBuildingPoints[0];
      const corner2 = this.snap(worldPos);

      let isInvalid = false;
      if (this.rules.enforce) {
        const width = Math.abs(corner2.x - corner1.x);
        const height = Math.abs(corner2.y - corner1.y);
        if (width >= 10 && height >= 10) {
          const minX = Math.min(corner1.x, corner2.x);
          const minY = Math.min(corner1.y, corner2.y);
          const proposedPoly: Vec2[] = [
            { x: minX, y: minY },
            { x: minX + width, y: minY },
            { x: minX + width, y: minY + height },
            { x: minX, y: minY + height },
          ];
          for (const b of this.floorplan.buildings) {
            const bPoly = buildingFootprint(b);
            if (polygonsOverlap(proposedPoly, bPoly, this.rules.tolerance)) {
              isInvalid = true;
              break;
            }
          }
        }
      }

      this.renderer?.renderDraftRectangle(corner1, corner2, isInvalid);
      return;
    }

    const scale = this.renderer?.getScale() ?? 1;
    const hitThreshold = 14 / scale;

    const nearbyPt = this.draftBuildingPoints.find(
      (pt) => Math.hypot(pt.x - worldPos.x, pt.y - worldPos.y) <= hitThreshold
    );

    const preview = nearbyPt ?? this.snap(worldPos);
    this.renderer?.renderDraftPolygon(this.draftBuildingPoints, preview);
  }

  public setGridSnapping(enabled: boolean, size?: number): void {
    this.grid.enabled = enabled;
    if (size !== undefined && size > 0) {
      this.grid.size = size;
    }
  }

  public isGridSnappingEnabled(): boolean {
    return this.grid.enabled;
  }

  public undo(): boolean {
    const success = this.commandStack.undo();
    if (success) {
      this.emitChange();
    }
    return success;
  }

  public redo(): boolean {
    const success = this.commandStack.redo();
    if (success) {
      this.emitChange();
    }
    return success;
  }

  public canUndo(): boolean {
    return this.commandStack.canUndo();
  }

  public canRedo(): boolean {
    return this.commandStack.canRedo();
  }

  public togglePreview(enabled?: boolean): boolean {
    const target = enabled !== undefined ? enabled : !this.isPreviewMode;
    if (this.isPreviewMode === target) return this.isPreviewMode;

    this.isPreviewMode = target;

    if (this.isPreviewMode) {
      // Hide editor canvas and mount viewer
      this.editorCanvasContainer.style.display = 'none';
      const viewerContainer = document.createElement('div');
      viewerContainer.className = 'open-seats-preview-viewer';
      viewerContainer.style.width = '100%';
      viewerContainer.style.height = '100%';
      this.container.appendChild(viewerContainer);

      this.embeddedViewer = createViewer(viewerContainer, {
        floorplan: this.getFloorplan(),
      });
    } else {
      // Destroy embedded viewer and unhide editor canvas
      if (this.embeddedViewer) {
        this.embeddedViewer.destroy();
        this.embeddedViewer = undefined;
      }
      const previewEl = this.container.querySelector(
        '.open-seats-preview-viewer'
      );
      if (previewEl) {
        previewEl.remove();
      }
      this.editorCanvasContainer.style.display = 'block';
      this.renderer?.load(this.floorplan);
    }

    this.emitter.emit('previewToggle', this.isPreviewMode);
    return this.isPreviewMode;
  }

  public isPreview(): boolean {
    return this.isPreviewMode;
  }

  public setBackground(bg: FloorplanBackground | undefined): void {
    const oldBg = this.floorplan.background;
    const command: Command = {
      name: 'Set Background',
      execute: () => {
        this.floorplan.background = bg;
      },
      undo: () => {
        this.floorplan.background = oldBg;
      },
    };

    this.commandStack.execute(command);
    this.emitChange();
  }

  public getSelectedNodeIds(): string[] {
    return [...this.selectedNodeIds];
  }

  public selectNodes(ids: string[]): void {
    this.selectedNodeIds = [...ids];
    this.renderer?.setSelectedNodeIds?.(this.selectedNodeIds);
    this.emitter.emit('selectionChange', this.getSelectedNodeIds());
  }

  public clearSelection(): void {
    this.selectedNodeIds = [];
    this.renderer?.setSelectedNodeIds?.([]);
    this.emitter.emit('selectionChange', []);
  }

  // Viewport / Zoom & Pan
  public zoomIn(factor = 1.2): void {
    if (this.isPreviewMode && this.embeddedViewer) {
      this.embeddedViewer.zoomIn(factor);
    } else {
      this.renderer?.zoomIn(factor);
    }
  }

  public zoomOut(factor = 1.2): void {
    if (this.isPreviewMode && this.embeddedViewer) {
      this.embeddedViewer.zoomOut(factor);
    } else {
      this.renderer?.zoomOut(factor);
    }
  }

  public resetZoom(): void {
    if (this.isPreviewMode && this.embeddedViewer) {
      this.embeddedViewer.resetZoom();
    } else {
      this.renderer?.resetZoom();
    }
  }

  public panTo(x: number, y: number): void {
    if (this.isPreviewMode && this.embeddedViewer) {
      this.embeddedViewer.panTo(x, y);
    } else {
      this.renderer?.panTo(x, y);
    }
  }

  public panBy(dx: number, dy: number): void {
    if (this.isPreviewMode && this.embeddedViewer) {
      this.embeddedViewer.panBy(dx, dy);
    } else {
      this.renderer?.panBy(dx, dy);
    }
  }

  public getScale(): number {
    if (this.isPreviewMode && this.embeddedViewer) {
      return this.embeddedViewer.getScale();
    }
    return this.renderer?.getScale() ?? 1;
  }

  // ----------------------------------------------------
  // Shape Creation & Modifications with Strict Validation
  // ----------------------------------------------------

  public createBuilding(
    points: Vec2[],
    label?: string,
    position: Vec2 = { x: 0, y: 0 }
  ): Building | null {
    const id = NumberingService.nextBuildingId();
    const snappedPoints = points.map((p) => this.snap(p));
    const snappedPos = this.snap(position);

    const bCount = this.floorplan.buildings.length;
    const bLabel = label || `Building ${bCount + 1}`;

    const newBuilding: Building = {
      id,
      label: bLabel,
      position: snappedPos,
      rotation: 0,
      points: snappedPoints,
      zones: [],
      rows: [],
    };

    if (this.rules.enforce) {
      // Validate proposal against existing buildings
      const testPlan: Floorplan = {
        ...this.floorplan,
        buildings: [...this.floorplan.buildings, newBuilding],
      };
      const violations = canPlace(
        testPlan,
        id,
        {},
        { tolerance: this.rules.tolerance }
      );
      if (violations.length > 0) {
        this.emitter.emit('violationsUpdated', violations);
        return null;
      }
    }

    const command: Command = {
      name: `Create Building ${bLabel}`,
      execute: () => {
        this.floorplan.buildings.push(newBuilding);
      },
      undo: () => {
        const idx = this.floorplan.buildings.findIndex((b) => b.id === id);
        if (idx >= 0) this.floorplan.buildings.splice(idx, 1);
      },
    };

    this.commandStack.execute(command);
    this.emitChange();
    return newBuilding;
  }

  public createZone(
    buildingId: string,
    points: Vec2[],
    fill = '#555555',
    position: Vec2 = { x: 0, y: 0 }
  ): Zone | null {
    const building = this.floorplan.buildings.find((b) => b.id === buildingId);
    if (!building) return null;

    const id = NumberingService.nextZoneId();
    const snappedPoints = points.map((p) => this.snap(p));
    const snappedPos = this.snap(position);

    const newZone: Zone = {
      id,
      position: snappedPos,
      rotation: 0,
      points: snappedPoints,
      fill,
    };

    if (this.rules.enforce) {
      const testPlan: Floorplan = {
        ...this.floorplan,
        buildings: this.floorplan.buildings.map((b) =>
          b.id === buildingId
            ? { ...b, zones: [...(b.zones ?? []), newZone] }
            : b
        ),
      };

      const violations = canPlace(
        testPlan,
        id,
        {},
        { tolerance: this.rules.tolerance }
      );
      if (violations.length > 0) {
        return null;
      }
    }

    const command: Command = {
      name: `Create Zone ${id}`,
      execute: () => {
        building.zones.push(newZone);
      },
      undo: () => {
        const idx = building.zones.findIndex((z) => z.id === id);
        if (idx >= 0) building.zones.splice(idx, 1);
      },
    };

    this.commandStack.execute(command);
    this.emitChange();
    return newZone;
  }

  public createRectangleBuilding(
    position: Vec2,
    width: number,
    height: number,
    label?: string
  ): Building | null {
    const points: Vec2[] = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ];
    return this.createBuilding(points, label, position);
  }

  public createRectangleZone(
    buildingId: string,
    position: Vec2,
    width: number,
    height: number,
    fill = '#555555'
  ): Zone | null {
    const points: Vec2[] = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ];
    return this.createZone(buildingId, points, fill, position);
  }

  public createRow(
    buildingId: string,
    position: Vec2,
    seatCount: number,
    opts?: {
      side?: 'one' | 'both';
      seatSpacing?: number;
      seatRadius?: number;
      tableWidth?: number;
      rotation?: number;
    }
  ): Row | null {
    const building = this.floorplan.buildings.find((b) => b.id === buildingId);
    if (!building) return null;

    const id = NumberingService.nextRowId();
    const rowIndex = building.rows.length;
    const rowLetter = NumberingService.rowLabel(rowIndex);
    const side = opts?.side ?? 'both';
    const seatSpacing = opts?.seatSpacing ?? 40;
    const seatRadius = opts?.seatRadius ?? 14;
    const tableWidth = opts?.tableWidth ?? 28;
    const rotation = opts?.rotation ?? 0;
    const snappedPos = this.snap(position);

    const seats: Seat[] = [];
    const count = Math.max(1, seatCount);

    if (side === 'both') {
      const slots = Math.ceil(count / 2);
      let created = 0;
      for (let i = 0; i < slots; i++) {
        seats.push({
          id: NumberingService.nextSeatId(),
          index: i,
          side: 'a',
          label: `${rowLetter}-${i + 1}a`,
        });
        created++;
        if (created < count) {
          seats.push({
            id: NumberingService.nextSeatId(),
            index: i,
            side: 'b',
            label: `${rowLetter}-${i + 1}b`,
          });
          created++;
        }
      }
    } else {
      for (let i = 0; i < count; i++) {
        seats.push({
          id: NumberingService.nextSeatId(),
          index: i,
          side: 'a',
          label: `${rowLetter}-${i + 1}`,
        });
      }
    }

    const newRow: Row = {
      id,
      label: rowLetter,
      position: snappedPos,
      rotation,
      side,
      seatSpacing,
      seatRadius,
      tableWidth,
      seats,
    };

    if (this.rules.enforce) {
      const testPlan: Floorplan = {
        ...this.floorplan,
        buildings: this.floorplan.buildings.map((b) =>
          b.id === buildingId ? { ...b, rows: [...(b.rows ?? []), newRow] } : b
        ),
      };

      const violations = canPlace(
        testPlan,
        id,
        {},
        { tolerance: this.rules.tolerance }
      );
      if (violations.length > 0) {
        return null;
      }
    }

    const command: Command = {
      name: `Create Row ${rowLetter}`,
      execute: () => {
        building.rows.push(newRow);
      },
      undo: () => {
        const idx = building.rows.findIndex((r) => r.id === id);
        if (idx >= 0) building.rows.splice(idx, 1);
      },
    };

    this.commandStack.execute(command);
    this.emitChange();
    return newRow;
  }

  public addSeatToRow(
    buildingId: string,
    rowId: string,
    seatSide: 'a' | 'b' = 'a'
  ): Seat | null {
    const building = this.floorplan.buildings.find((b) => b.id === buildingId);
    if (!building) return null;

    const row = building.rows.find((r) => r.id === rowId);
    if (!row) return null;

    if (row.side === 'one' && seatSide === 'b') {
      return null;
    }

    const currentMaxIndex =
      row.seats.length > 0 ? Math.max(...row.seats.map((s) => s.index)) : -1;

    // Check if slot on currentMaxIndex is free for requested side
    const slotFilled = row.seats.some(
      (s) => s.index === currentMaxIndex && s.side === seatSide
    );
    const newIndex = slotFilled
      ? currentMaxIndex + 1
      : Math.max(0, currentMaxIndex);

    const newSeat: Seat = {
      id: NumberingService.nextSeatId(),
      index: newIndex,
      side: seatSide,
      label: '', // will be renumbered
    };

    const proposedSeats = [...row.seats, newSeat];
    const renumbered = NumberingService.renumberRowSeats({
      ...row,
      seats: proposedSeats,
    });

    if (this.rules.enforce) {
      const violations = canPlace(
        this.floorplan,
        rowId,
        { seats: renumbered },
        { tolerance: this.rules.tolerance }
      );
      if (violations.length > 0) {
        return null;
      }
    }

    const oldSeats = [...row.seats];
    const command: Command = {
      name: `Add Seat to Row ${row.label}`,
      execute: () => {
        row.seats = renumbered;
      },
      undo: () => {
        row.seats = oldSeats;
      },
    };

    this.commandStack.execute(command);
    this.emitChange();
    return newSeat;
  }

  public moveNode(nodeId: string, newPosition: Vec2): boolean {
    const snapped = this.snap(newPosition);
    if (this.rules.enforce) {
      const violations = canPlace(
        this.floorplan,
        nodeId,
        { position: snapped },
        { tolerance: this.rules.tolerance }
      );
      if (violations.length > 0) {
        this.emitter.emit('violationsUpdated', violations);
        return false;
      }
    }

    const found = this.findNode(nodeId);
    if (!found) return false;

    const node = found.node;
    const oldPos = node.position;
    this.commandStack.execute({
      name: `Move ${this.describeNode(found)}`,
      execute: () => {
        node.position = snapped;
      },
      undo: () => {
        node.position = oldPos;
      },
    });
    this.emitChange();
    return true;
  }

  public getNodePosition(nodeId: string): Vec2 | null {
    const found = this.findNode(nodeId);
    return found ? { ...found.node.position } : null;
  }

  private findNode(nodeId: string): EditableNode | null {
    for (const b of this.floorplan.buildings) {
      if (b.id === nodeId) return { kind: 'building', node: b, parent: null };
      const zone = (b.zones ?? []).find((z) => z.id === nodeId);
      if (zone) return { kind: 'zone', node: zone, parent: b };
      const row = (b.rows ?? []).find((r) => r.id === nodeId);
      if (row) return { kind: 'row', node: row, parent: b };
    }
    return null;
  }

  private describeNode(found: EditableNode): string {
    switch (found.kind) {
      case 'building':
        return `Building ${found.node.label}`;
      case 'zone':
        return `Zone ${found.node.id}`;
      case 'row':
        return `Row ${found.node.label}`;
    }
  }

  public nudgeNode(nodeId: string, dx: number, dy: number): boolean {
    const pos = this.getNodePosition(nodeId);
    if (!pos) return false;
    return this.moveNode(nodeId, { x: pos.x + dx, y: pos.y + dy });
  }

  public rotateNode(nodeId: string, newRotation: number): boolean {
    if (this.rules.enforce) {
      const violations = canPlace(
        this.floorplan,
        nodeId,
        { rotation: newRotation },
        { tolerance: this.rules.tolerance }
      );
      if (violations.length > 0) {
        return false;
      }
    }

    const found = this.findNode(nodeId);
    if (!found) return false;

    const node = found.node;
    const oldRot = node.rotation;
    this.commandStack.execute({
      name: `Rotate ${this.describeNode(found)}`,
      execute: () => {
        node.rotation = newRotation;
      },
      undo: () => {
        node.rotation = oldRot;
      },
    });
    this.emitChange();
    return true;
  }

  public reparentRow(
    rowId: string,
    targetBuildingId: string,
    dropWorldPosition?: Vec2
  ): boolean {
    let sourceBuilding: Building | undefined;
    let row: Row | undefined;

    for (const b of this.floorplan.buildings) {
      const r = (b.rows ?? []).find((item) => item.id === rowId);
      if (r) {
        sourceBuilding = b;
        row = r;
        break;
      }
    }

    if (!sourceBuilding || !row || sourceBuilding.id === targetBuildingId) {
      return false;
    }

    const srcBuilding = sourceBuilding;
    const movingRow = row;

    const targetBuilding = this.floorplan.buildings.find(
      (b) => b.id === targetBuildingId
    );
    if (!targetBuilding) return false;

    // Apply coordinate transform from source to world (or use dropWorldPosition), then world to target
    const worldPos =
      dropWorldPosition ??
      transformPoint(
        movingRow.position,
        srcBuilding.position,
        srcBuilding.rotation
      );
    const newLocalPos = inverseTransformPoint(
      worldPos,
      targetBuilding.position,
      targetBuilding.rotation
    );
    const newLocalRot =
      movingRow.rotation + srcBuilding.rotation - targetBuilding.rotation;

    const proposedRow: Row = {
      ...movingRow,
      position: this.snap(newLocalPos),
      rotation: newLocalRot,
    };

    if (this.rules.enforce) {
      // Test containment and overlap in target building
      const testPlan: Floorplan = {
        ...this.floorplan,
        buildings: this.floorplan.buildings.map((b) => {
          if (b.id === srcBuilding.id && b.id === targetBuildingId) {
            return {
              ...b,
              rows: [...b.rows.filter((r) => r.id !== rowId), proposedRow],
            };
          }
          if (b.id === srcBuilding.id) {
            return {
              ...b,
              rows: b.rows.filter((r) => r.id !== rowId),
            };
          }
          if (b.id === targetBuildingId) {
            return {
              ...b,
              rows: [...(b.rows ?? []), proposedRow],
            };
          }
          return b;
        }),
      };

      const violations = canPlace(
        testPlan,
        rowId,
        {},
        { tolerance: this.rules.tolerance }
      );
      if (violations.length > 0) {
        return false;
      }
    }

    const oldPos = movingRow.position;
    const oldRot = movingRow.rotation;

    const command: Command = {
      name: `Reparent Row ${movingRow.label} to ${targetBuilding.label}`,
      execute: () => {
        srcBuilding.rows = srcBuilding.rows.filter((r) => r.id !== rowId);
        movingRow.position = proposedRow.position;
        movingRow.rotation = proposedRow.rotation;
        targetBuilding.rows.push(movingRow);
      },
      undo: () => {
        targetBuilding.rows = targetBuilding.rows.filter((r) => r.id !== rowId);
        movingRow.position = oldPos;
        movingRow.rotation = oldRot;
        srcBuilding.rows.push(movingRow);
      },
    };

    this.commandStack.execute(command);
    this.emitChange();
    return true;
  }

  public deleteNode(nodeId: string): boolean {
    const found = this.findNode(nodeId);
    if (!found) return false;

    let list: (Building | Zone | Row)[];
    if (found.kind === 'building') list = this.floorplan.buildings;
    else if (found.kind === 'zone') list = found.parent.zones;
    else list = found.parent.rows;
    const idx = list.indexOf(found.node);
    const removed = found.node;
    this.commandStack.execute({
      name: `Delete ${this.describeNode(found)}`,
      execute: () => {
        list.splice(idx, 1);
      },
      undo: () => {
        list.splice(idx, 0, removed);
      },
    });
    this.emitChange();
    return true;
  }

  public addSeatOnCanvas(buildingId: string, position: Vec2): Row | null {
    return this.createRow(buildingId, position, 1, {
      side: 'one',
      tableWidth: 0,
    });
  }

  public moveSeatToRow(
    sourceRowId: string,
    seatId: string,
    targetRowId: string,
    targetSide: 'a' | 'b' = 'a'
  ): boolean {
    if (sourceRowId === targetRowId) return false;

    let sourceRow: Row | undefined;
    let targetRow: Row | undefined;

    for (const b of this.floorplan.buildings) {
      for (const r of b.rows ?? []) {
        if (r.id === sourceRowId) sourceRow = r;
        if (r.id === targetRowId) targetRow = r;
      }
    }

    if (!sourceRow || !targetRow) return false;
    if (targetRow.side === 'one' && targetSide === 'b') return false;

    const seatIdx = sourceRow.seats.findIndex((s) => s.id === seatId);
    if (seatIdx < 0) return false;

    const movedSeat = sourceRow.seats[seatIdx];

    const currentMaxIdx =
      targetRow.seats.length > 0
        ? Math.max(...targetRow.seats.map((s) => s.index))
        : -1;
    const slotFilled = targetRow.seats.some(
      (s) => s.index === currentMaxIdx && s.side === targetSide
    );
    const newIndex = slotFilled
      ? currentMaxIdx + 1
      : Math.max(0, currentMaxIdx);

    const proposedSeat: Seat = {
      ...movedSeat,
      index: newIndex,
      side: targetSide,
    };

    const proposedTargetSeats = NumberingService.renumberRowSeats({
      ...targetRow,
      seats: [...targetRow.seats, proposedSeat],
    });

    const proposedSourceSeats = NumberingService.renumberRowSeats({
      ...sourceRow,
      seats: sourceRow.seats.filter((s) => s.id !== seatId),
    });

    if (this.rules.enforce) {
      const violations = canPlace(
        this.floorplan,
        targetRowId,
        { seats: proposedTargetSeats },
        { tolerance: this.rules.tolerance }
      );
      if (violations.length > 0) return false;
    }

    const oldSourceSeats = [...sourceRow.seats];
    const oldTargetSeats = [...targetRow.seats];

    const srcRow = sourceRow;
    const dstRow = targetRow;

    this.commandStack.execute({
      name: `Move Seat ${movedSeat.label} to Row ${dstRow.label}`,
      execute: () => {
        srcRow.seats = proposedSourceSeats;
        dstRow.seats = proposedTargetSeats;
      },
      undo: () => {
        srcRow.seats = oldSourceSeats;
        dstRow.seats = oldTargetSeats;
      },
    });

    this.emitChange();
    return true;
  }

  public setRowSide(rowId: string, side: 'one' | 'both'): boolean {
    let targetRow: Row | undefined;
    for (const b of this.floorplan.buildings) {
      const r = (b.rows ?? []).find((row) => row.id === rowId);
      if (r) {
        targetRow = r;
        break;
      }
    }
    if (!targetRow || targetRow.side === side) return false;

    let proposedSeats = [...targetRow.seats];
    if (side === 'one') {
      proposedSeats = proposedSeats
        .filter((s) => s.side === 'a')
        .map((s, idx) => ({ ...s, index: idx }));
    }
    const renumbered = NumberingService.renumberRowSeats({
      ...targetRow,
      side,
      seats: proposedSeats,
    });

    if (this.rules.enforce) {
      const violations = canPlace(
        this.floorplan,
        rowId,
        { side, seats: renumbered },
        { tolerance: this.rules.tolerance }
      );
      if (violations.length > 0) return false;
    }

    const row = targetRow;
    const oldSide = row.side;
    const oldSeats = [...row.seats];

    this.commandStack.execute({
      name: `Set Row ${row.label} side to ${side}`,
      execute: () => {
        row.side = side;
        row.seats = renumbered;
      },
      undo: () => {
        row.side = oldSide;
        row.seats = oldSeats;
      },
    });

    this.emitChange();
    return true;
  }

  public setRowTableWidth(rowId: string, tableWidth: number): boolean {
    let targetRow: Row | undefined;
    for (const b of this.floorplan.buildings) {
      const r = (b.rows ?? []).find((row) => row.id === rowId);
      if (r) {
        targetRow = r;
        break;
      }
    }
    if (!targetRow || tableWidth < 0) return false;

    if (this.rules.enforce) {
      const violations = canPlace(
        this.floorplan,
        rowId,
        { tableWidth },
        { tolerance: this.rules.tolerance }
      );
      if (violations.length > 0) return false;
    }

    const row = targetRow;
    const oldWidth = row.tableWidth;
    this.commandStack.execute({
      name: `Set Row ${row.label} table width`,
      execute: () => {
        row.tableWidth = tableWidth;
      },
      undo: () => {
        row.tableWidth = oldWidth;
      },
    });

    this.emitChange();
    return true;
  }

  public setRowSeatSpacing(rowId: string, seatSpacing: number): boolean {
    let targetRow: Row | undefined;
    for (const b of this.floorplan.buildings) {
      const r = (b.rows ?? []).find((row) => row.id === rowId);
      if (r) {
        targetRow = r;
        break;
      }
    }
    if (!targetRow || seatSpacing < 2 * targetRow.seatRadius) return false;

    if (this.rules.enforce) {
      const violations = canPlace(
        this.floorplan,
        rowId,
        { seatSpacing },
        { tolerance: this.rules.tolerance }
      );
      if (violations.length > 0) {
        this.emitter.emit('violationsUpdated', violations);
        return false;
      }
    }

    const row = targetRow;
    const oldSpacing = row.seatSpacing;
    this.commandStack.execute({
      name: `Set Row ${row.label} seat spacing`,
      execute: () => {
        row.seatSpacing = seatSpacing;
      },
      undo: () => {
        row.seatSpacing = oldSpacing;
      },
    });

    this.emitChange();
    return true;
  }

  public setRowSeatRadius(rowId: string, seatRadius: number): boolean {
    if (seatRadius <= 0) return false;
    let targetRow: Row | undefined;
    for (const b of this.floorplan.buildings) {
      const r = (b.rows ?? []).find((item) => item.id === rowId);
      if (r) {
        targetRow = r;
        break;
      }
    }
    if (!targetRow || targetRow.seatSpacing < 2 * seatRadius) return false;

    if (this.rules.enforce) {
      const violations = canPlace(
        this.floorplan,
        rowId,
        { seatRadius },
        { tolerance: this.rules.tolerance }
      );
      if (violations.length > 0) return false;
    }

    const row = targetRow;
    const oldRadius = row.seatRadius;
    this.commandStack.execute({
      name: `Set Row ${row.label} seat radius`,
      execute: () => {
        row.seatRadius = seatRadius;
      },
      undo: () => {
        row.seatRadius = oldRadius;
      },
    });

    this.emitChange();
    return true;
  }

  public setRowSeatCount(rowId: string, seatCount: number): boolean {
    if (seatCount < 1) return false;
    let targetRow: Row | undefined;
    for (const b of this.floorplan.buildings) {
      const r = (b.rows ?? []).find((item) => item.id === rowId);
      if (r) {
        targetRow = r;
        break;
      }
    }
    if (!targetRow) return false;
    if (targetRow.seats.length === seatCount) return true;

    const oldSeats = [...targetRow.seats];
    const side = targetRow.side;
    let proposedSeats: Seat[] = [];

    if (seatCount > targetRow.seats.length) {
      proposedSeats = [...targetRow.seats];
      const needed = seatCount - targetRow.seats.length;

      if (side === 'both') {
        let currentMaxIdx =
          proposedSeats.length > 0
            ? Math.max(...proposedSeats.map((s) => s.index))
            : -1;
        for (let i = 0; i < needed; i++) {
          const hasA = proposedSeats.some(
            (s) => s.index === currentMaxIdx && s.side === 'a'
          );
          const hasB = proposedSeats.some(
            (s) => s.index === currentMaxIdx && s.side === 'b'
          );

          let targetSide: 'a' | 'b' = 'a';
          let targetIndex = currentMaxIdx;

          if (!hasA) {
            targetSide = 'a';
          } else if (!hasB) {
            targetSide = 'b';
          } else {
            currentMaxIdx++;
            targetIndex = currentMaxIdx;
            targetSide = 'a';
          }

          proposedSeats.push({
            id: NumberingService.nextSeatId(),
            index: targetIndex,
            side: targetSide,
            label: '',
          });
        }
      } else {
        const currentMaxIdx =
          proposedSeats.length > 0
            ? Math.max(...proposedSeats.map((s) => s.index))
            : -1;
        for (let i = 0; i < needed; i++) {
          proposedSeats.push({
            id: NumberingService.nextSeatId(),
            index: currentMaxIdx + 1 + i,
            side: 'a',
            label: '',
          });
        }
      }
    } else {
      const sorted = [...targetRow.seats].sort((a, b) => {
        if (b.index !== a.index) return b.index - a.index;
        return b.side.localeCompare(a.side);
      });
      proposedSeats = sorted.slice(sorted.length - seatCount);
    }

    const renumbered = NumberingService.renumberRowSeats({
      ...targetRow,
      seats: proposedSeats,
    });

    if (this.rules.enforce) {
      const violations = canPlace(
        this.floorplan,
        rowId,
        { seats: renumbered },
        { tolerance: this.rules.tolerance }
      );
      if (violations.length > 0) return false;
    }

    const row = targetRow;
    this.commandStack.execute({
      name: `Set Row ${row.label} seat count to ${seatCount}`,
      execute: () => {
        row.seats = renumbered;
      },
      undo: () => {
        row.seats = oldSeats;
      },
    });

    this.emitChange();
    return true;
  }

  // Context Actions: Copy, Cut, Paste, Duplicate, Flip
  public copySelection(): boolean {
    if (this.selectedNodeIds.length === 0) return false;
    const selectedId = this.selectedNodeIds[0];

    const building = this.floorplan.buildings.find((b) => b.id === selectedId);
    if (building) {
      this.clipboard = {
        type: 'building',
        data: structuredClone(building),
      };
      return true;
    }

    for (const b of this.floorplan.buildings) {
      const zone = (b.zones ?? []).find((z) => z.id === selectedId);
      if (zone) {
        this.clipboard = {
          type: 'zone',
          data: structuredClone(zone),
        };
        return true;
      }
      const row = (b.rows ?? []).find((r) => r.id === selectedId);
      if (row) {
        this.clipboard = {
          type: 'row',
          data: structuredClone(row),
        };
        return true;
      }
    }
    return false;
  }

  public cutSelection(): boolean {
    if (this.selectedNodeIds.length === 0) return false;
    const success = this.copySelection();
    if (!success) return false;

    const idsToDelete = [...this.selectedNodeIds];
    this.batch(`Cut ${idsToDelete.length} items`, () => {
      for (const id of idsToDelete) {
        this.deleteNode(id);
      }
    });
    this.clearSelection();
    return true;
  }

  public canPaste(): boolean {
    return this.clipboard !== null;
  }

  private resolveTargetBuilding(
    targetBuildingId?: string
  ): Building | undefined {
    if (targetBuildingId) {
      const found = this.floorplan.buildings.find(
        (b) => b.id === targetBuildingId
      );
      if (found) return found;
    }

    if (this.selectedNodeIds.length > 0) {
      const selId = this.selectedNodeIds[0];
      const selectedBuilding = this.floorplan.buildings.find(
        (b) => b.id === selId
      );
      if (selectedBuilding) return selectedBuilding;

      for (const building of this.floorplan.buildings) {
        if (
          building.zones.some((z) => z.id === selId) ||
          building.rows.some((r) => r.id === selId)
        ) {
          return building;
        }
      }
    }

    return this.floorplan.buildings[0];
  }

  private pasteBuilding(original: Building, offset: Vec2): boolean {
    const newId = NumberingService.nextBuildingId();
    const bbox = polygonBoundingBox(original.points);
    const bWidth = Math.round(bbox.width || 200);
    const bHeight = Math.round(bbox.height || 200);

    const newBuildingTemplate: Building = {
      ...original,
      id: newId,
      label: `${original.label} Copy`,
      position: { ...original.position },
      points: original.points.map((p) => ({ ...p })),
      zones: original.zones.map((z) => ({
        ...z,
        id: NumberingService.nextZoneId(),
        points: z.points.map((p) => ({ ...p })),
        position: { ...z.position },
      })),
      rows: original.rows.map((r) => {
        const newRow: Row = {
          ...r,
          id: NumberingService.nextRowId(),
          position: { ...r.position },
          seats: r.seats.map((s) => ({
            ...s,
            id: NumberingService.nextSeatId(),
          })),
        };
        newRow.seats = NumberingService.renumberRowSeats(newRow);
        return newRow;
      }),
    };

    const candidateOffsets: Vec2[] = [
      offset,
      { x: 0, y: 0 },
      { x: bWidth + 40, y: 0 },
      { x: 0, y: bHeight + 40 },
      { x: -(bWidth + 40), y: 0 },
      { x: 0, y: -(bHeight + 40) },
      { x: bWidth + 40, y: bHeight + 40 },
      { x: 40, y: 40 },
      { x: 80, y: 80 },
    ];

    let placedBuilding: Building | null = null;
    for (const cand of candidateOffsets) {
      const newPos = this.snap({
        x: original.position.x + cand.x,
        y: original.position.y + cand.y,
      });
      const candidateBuilding: Building = {
        ...newBuildingTemplate,
        position: newPos,
      };

      if (!this.rules.enforce) {
        placedBuilding = candidateBuilding;
        break;
      }

      const testPlan: Floorplan = {
        ...this.floorplan,
        buildings: [...this.floorplan.buildings, candidateBuilding],
      };
      const violations = canPlace(
        testPlan,
        newId,
        {},
        { tolerance: this.rules.tolerance }
      );
      if (violations.length === 0) {
        placedBuilding = candidateBuilding;
        break;
      }
    }

    if (!placedBuilding) return false;

    const finalBuilding = placedBuilding;
    this.commandStack.execute({
      name: `Paste Building ${finalBuilding.label}`,
      execute: () => {
        this.floorplan.buildings.push(finalBuilding);
      },
      undo: () => {
        const idx = this.floorplan.buildings.findIndex((b) => b.id === newId);
        if (idx >= 0) this.floorplan.buildings.splice(idx, 1);
      },
    });
    this.emitChange();
    this.selectNodes([newId]);
    return true;
  }

  private pasteZone(
    original: Zone,
    targetBuilding: Building,
    offset: Vec2
  ): boolean {
    const newId = NumberingService.nextZoneId();
    const bbox = polygonBoundingBox(original.points);
    const zWidth = Math.round(bbox.width || 120);
    const zHeight = Math.round(bbox.height || 80);

    const newZoneTemplate: Zone = {
      ...original,
      id: newId,
      position: { ...original.position },
      points: original.points.map((p) => ({ ...p })),
    };

    const candidateOffsets: Vec2[] = [
      offset,
      { x: 0, y: 0 },
      { x: 0, y: zHeight + 20 },
      { x: zWidth + 20, y: 0 },
      { x: -(zWidth + 20), y: 0 },
      { x: 0, y: -(zHeight + 20) },
      { x: zWidth + 20, y: zHeight + 20 },
      { x: 30, y: 30 },
      { x: 60, y: 60 },
    ];

    let placedZone: Zone | null = null;
    for (const cand of candidateOffsets) {
      const newPos = this.snap({
        x: original.position.x + cand.x,
        y: original.position.y + cand.y,
      });
      const candidateZone: Zone = { ...newZoneTemplate, position: newPos };

      if (!this.rules.enforce) {
        placedZone = candidateZone;
        break;
      }

      const testPlan: Floorplan = {
        ...this.floorplan,
        buildings: this.floorplan.buildings.map((b) =>
          b.id === targetBuilding.id
            ? { ...b, zones: [...(b.zones ?? []), candidateZone] }
            : b
        ),
      };
      const violations = canPlace(
        testPlan,
        newId,
        {},
        { tolerance: this.rules.tolerance }
      );
      if (violations.length === 0) {
        placedZone = candidateZone;
        break;
      }
    }

    if (!placedZone) return false;

    const finalZone = placedZone;
    this.commandStack.execute({
      name: `Paste Zone ${newId}`,
      execute: () => {
        targetBuilding.zones.push(finalZone);
      },
      undo: () => {
        const idx = targetBuilding.zones.findIndex((z) => z.id === newId);
        if (idx >= 0) targetBuilding.zones.splice(idx, 1);
      },
    });
    this.emitChange();
    this.selectNodes([newId]);
    return true;
  }

  private pasteRow(
    original: Row,
    targetBuilding: Building,
    offset: Vec2
  ): boolean {
    const newId = NumberingService.nextRowId();
    const nextLetter = NumberingService.rowLabel(targetBuilding.rows.length);

    const clonedSeats = original.seats.map((s) => ({
      ...s,
      id: NumberingService.nextSeatId(),
    }));

    const newRowTemplate: Row = {
      ...original,
      id: newId,
      label: nextLetter,
      seats: clonedSeats,
      position: { ...original.position },
    };
    newRowTemplate.seats = NumberingService.renumberRowSeats(newRowTemplate);

    const rowHeight =
      (original.tableWidth ?? 28) + (original.seatRadius ?? 14) * 4;
    const verticalStep = Math.max(70, Math.round(rowHeight + 10));

    const existingRows = targetBuilding.rows ?? [];
    const maxY =
      existingRows.length > 0
        ? Math.max(...existingRows.map((r) => r.position.y))
        : original.position.y;
    const minY =
      existingRows.length > 0
        ? Math.min(...existingRows.map((r) => r.position.y))
        : original.position.y;

    const candidatePositions: Vec2[] = [
      { x: original.position.x, y: maxY + verticalStep },
      { x: original.position.x + offset.x, y: original.position.y + offset.y },
      { x: original.position.x, y: original.position.y },
      { x: original.position.x, y: minY - verticalStep },
      { x: original.position.x, y: original.position.y + verticalStep },
      { x: original.position.x, y: original.position.y + verticalStep * 2 },
      { x: original.position.x, y: original.position.y + verticalStep * 3 },
      { x: original.position.x, y: original.position.y - verticalStep },
      { x: original.position.x, y: original.position.y - verticalStep * 2 },
      { x: original.position.x + 80, y: maxY + verticalStep },
      { x: original.position.x - 80, y: maxY + verticalStep },
    ];

    let placedRow: Row | null = null;
    for (const candPos of candidatePositions) {
      const snappedPos = this.snap(candPos);
      const candidateRow: Row = { ...newRowTemplate, position: snappedPos };

      if (!this.rules.enforce) {
        placedRow = candidateRow;
        break;
      }

      const testPlan: Floorplan = {
        ...this.floorplan,
        buildings: this.floorplan.buildings.map((b) =>
          b.id === targetBuilding.id
            ? { ...b, rows: [...(b.rows ?? []), candidateRow] }
            : b
        ),
      };
      const violations = canPlace(
        testPlan,
        newId,
        {},
        { tolerance: this.rules.tolerance }
      );
      if (violations.length === 0) {
        placedRow = candidateRow;
        break;
      }
    }

    if (!placedRow) return false;

    const finalRow = placedRow;
    this.commandStack.execute({
      name: `Paste Row ${nextLetter}`,
      execute: () => {
        targetBuilding.rows.push(finalRow);
      },
      undo: () => {
        const idx = targetBuilding.rows.findIndex((r) => r.id === newId);
        if (idx >= 0) targetBuilding.rows.splice(idx, 1);
      },
    });
    this.emitChange();
    this.selectNodes([newId]);
    return true;
  }

  public paste(
    targetBuildingId?: string,
    offset: Vec2 = { x: 30, y: 30 }
  ): boolean {
    if (!this.clipboard) return false;

    if (this.clipboard.type === 'building') {
      return this.pasteBuilding(this.clipboard.data, offset);
    }

    const targetBuilding = this.resolveTargetBuilding(targetBuildingId);
    if (!targetBuilding) return false;

    if (this.clipboard.type === 'zone') {
      return this.pasteZone(this.clipboard.data, targetBuilding, offset);
    }

    if (this.clipboard.type === 'row') {
      return this.pasteRow(this.clipboard.data, targetBuilding, offset);
    }

    return false;
  }

  public duplicateNode(nodeId: string): boolean {
    this.selectNodes([nodeId]);
    if (this.copySelection()) {
      return this.paste();
    }
    return false;
  }

  public flipNode(
    nodeId: string,
    direction: 'horizontal' | 'vertical'
  ): boolean {
    const building = this.floorplan.buildings.find((b) => b.id === nodeId);
    if (building) {
      const oldPoints = building.points.map((p) => ({ ...p }));
      const oldRows = [...building.rows];
      const oldZones = [...building.zones];

      const flippedPoints = flipPolygon(building.points, direction);
      const centroid = polygonCentroid(building.points);

      const flippedRows: Row[] = building.rows.map((r) => {
        const newPos =
          direction === 'horizontal'
            ? { x: 2 * centroid.x - r.position.x, y: r.position.y }
            : { x: r.position.x, y: 2 * centroid.y - r.position.y };
        const newRot =
          direction === 'horizontal'
            ? (180 - r.rotation + 360) % 360
            : (360 - r.rotation) % 360;
        return {
          ...r,
          position: this.snap(newPos),
          rotation: newRot,
        };
      });

      const flippedZones: Zone[] = building.zones.map((z) => {
        const newPos =
          direction === 'horizontal'
            ? { x: 2 * centroid.x - z.position.x, y: z.position.y }
            : { x: z.position.x, y: 2 * centroid.y - z.position.y };
        const newRot =
          direction === 'horizontal'
            ? (180 - z.rotation + 360) % 360
            : (360 - z.rotation) % 360;
        return {
          ...z,
          position: this.snap(newPos),
          rotation: newRot,
          points: flipPolygon(z.points, direction),
        };
      });

      const proposedBuilding: Building = {
        ...building,
        points: flippedPoints,
        rows: flippedRows,
        zones: flippedZones,
      };

      if (this.rules.enforce) {
        const testPlan: Floorplan = {
          ...this.floorplan,
          buildings: this.floorplan.buildings.map((b) =>
            b.id === nodeId ? proposedBuilding : b
          ),
        };
        const violations = canPlace(
          testPlan,
          nodeId,
          {},
          { tolerance: this.rules.tolerance }
        );
        if (violations.length > 0) return false;
      }

      this.commandStack.execute({
        name: `Flip Building ${building.label} ${direction}`,
        execute: () => {
          building.points = flippedPoints;
          building.rows = flippedRows;
          building.zones = flippedZones;
        },
        undo: () => {
          building.points = oldPoints;
          building.rows = oldRows;
          building.zones = oldZones;
        },
      });
      this.emitChange();
      return true;
    }

    for (const b of this.floorplan.buildings) {
      const zone = (b.zones ?? []).find((z) => z.id === nodeId);
      if (zone) {
        const oldPoints = zone.points.map((p) => ({ ...p }));
        const flippedPoints = flipPolygon(zone.points, direction);

        if (this.rules.enforce) {
          const testPlan: Floorplan = {
            ...this.floorplan,
            buildings: this.floorplan.buildings.map((bItem) =>
              bItem.id === b.id
                ? {
                    ...bItem,
                    zones: bItem.zones.map((z) =>
                      z.id === nodeId ? { ...z, points: flippedPoints } : z
                    ),
                  }
                : bItem
            ),
          };
          const violations = canPlace(
            testPlan,
            nodeId,
            {},
            { tolerance: this.rules.tolerance }
          );
          if (violations.length > 0) return false;
        }

        this.commandStack.execute({
          name: `Flip Zone ${zone.id} ${direction}`,
          execute: () => {
            zone.points = flippedPoints;
          },
          undo: () => {
            zone.points = oldPoints;
          },
        });
        this.emitChange();
        return true;
      }

      const row = (b.rows ?? []).find((r) => r.id === nodeId);
      if (row) {
        const oldRot = row.rotation;
        const newRot =
          direction === 'horizontal'
            ? (180 - row.rotation + 360) % 360
            : (360 - row.rotation) % 360;

        if (this.rules.enforce) {
          const violations = canPlace(
            this.floorplan,
            nodeId,
            { rotation: newRot },
            { tolerance: this.rules.tolerance }
          );
          if (violations.length > 0) return false;
        }

        this.commandStack.execute({
          name: `Flip Row ${row.label} ${direction}`,
          execute: () => {
            row.rotation = newRot;
          },
          undo: () => {
            row.rotation = oldRot;
          },
        });
        this.emitChange();
        return true;
      }
    }

    return false;
  }

  public updateNodeLabel(nodeId: string, label: string): boolean {
    for (const b of this.floorplan.buildings) {
      if (b.id === nodeId) {
        const oldLabel = b.label;
        this.commandStack.execute({
          name: `Rename Building to ${label}`,
          execute: () => {
            b.label = label;
          },
          undo: () => {
            b.label = oldLabel;
          },
        });
        this.emitChange();
        return true;
      }
      const zone = (b.zones ?? []).find((z) => z.id === nodeId);
      if (zone) {
        const oldText = zone.text?.value;
        this.commandStack.execute({
          name: `Rename Zone`,
          execute: () => {
            if (!zone.text) zone.text = { value: label };
            else zone.text.value = label;
          },
          undo: () => {
            if (oldText !== undefined) {
              zone.text = { value: oldText };
            } else {
              delete zone.text;
            }
          },
        });
        this.emitChange();
        return true;
      }
      const row = (b.rows ?? []).find((r) => r.id === nodeId);
      if (row) {
        const oldLabel = row.label;
        this.commandStack.execute({
          name: `Rename Row to ${label}`,
          execute: () => {
            row.label = label;
            row.seats = NumberingService.renumberRowSeats(row);
          },
          undo: () => {
            row.label = oldLabel;
            row.seats = NumberingService.renumberRowSeats(row);
          },
        });
        this.emitChange();
        return true;
      }
    }
    return false;
  }

  public setZoneFill(zoneId: string, fill: string): boolean {
    for (const b of this.floorplan.buildings) {
      const zone = (b.zones ?? []).find((z) => z.id === zoneId);
      if (zone) {
        const oldFill = zone.fill;
        this.commandStack.execute({
          name: `Change Zone Color`,
          execute: () => {
            zone.fill = fill;
          },
          undo: () => {
            zone.fill = oldFill;
          },
        });
        this.emitChange();
        return true;
      }
    }
    return false;
  }

  public scaleShape(nodeId: string, scaleX: number, scaleY: number): boolean {
    if (scaleX <= 0 || scaleY <= 0) return false;

    const building = this.floorplan.buildings.find((b) => b.id === nodeId);
    if (building) {
      const oldPoints = building.points.map((p) => ({ ...p }));
      const scaled = scalePolygon(building.points, scaleX, scaleY);

      if (this.rules.enforce) {
        const testPlan: Floorplan = {
          ...this.floorplan,
          buildings: this.floorplan.buildings.map((b) =>
            b.id === nodeId ? { ...b, points: scaled } : b
          ),
        };
        const violations = canPlace(
          testPlan,
          nodeId,
          {},
          { tolerance: this.rules.tolerance }
        );
        if (violations.length > 0) return false;
      }

      this.commandStack.execute({
        name: `Scale Building ${building.label}`,
        execute: () => {
          building.points = scaled;
        },
        undo: () => {
          building.points = oldPoints;
        },
      });
      this.emitChange();
      return true;
    }

    for (const b of this.floorplan.buildings) {
      const zone = (b.zones ?? []).find((z) => z.id === nodeId);
      if (zone) {
        const oldPoints = zone.points.map((p) => ({ ...p }));
        const scaled = scalePolygon(zone.points, scaleX, scaleY);

        if (this.rules.enforce) {
          const testPlan: Floorplan = {
            ...this.floorplan,
            buildings: this.floorplan.buildings.map((bItem) =>
              bItem.id === b.id
                ? {
                    ...bItem,
                    zones: bItem.zones.map((z) =>
                      z.id === nodeId ? { ...z, points: scaled } : z
                    ),
                  }
                : bItem
            ),
          };
          const violations = canPlace(
            testPlan,
            nodeId,
            {},
            { tolerance: this.rules.tolerance }
          );
          if (violations.length > 0) return false;
        }

        this.commandStack.execute({
          name: `Scale Zone ${zone.id}`,
          execute: () => {
            zone.points = scaled;
          },
          undo: () => {
            zone.points = oldPoints;
          },
        });
        this.emitChange();
        return true;
      }
    }

    return false;
  }

  public setShapeDimensions(
    nodeId: string,
    width: number,
    height: number
  ): boolean {
    if (width <= 0 || height <= 0) return false;

    let points: Vec2[] | undefined;
    const b = this.floorplan.buildings.find((b) => b.id === nodeId);
    if (b) {
      points = b.points;
    } else {
      for (const building of this.floorplan.buildings) {
        const z = (building.zones ?? []).find((zone) => zone.id === nodeId);
        if (z) {
          points = z.points;
          break;
        }
      }
    }

    if (!points || points.length === 0) return false;
    const bbox = polygonBoundingBox(points);
    if (bbox.width <= 0 || bbox.height <= 0) return false;

    const scaleX = width / bbox.width;
    const scaleY = height / bbox.height;
    return this.scaleShape(nodeId, scaleX, scaleY);
  }

  // ----------------------------------------------------
  // Polygon Vertex Editing (Buildings and Zones)
  // ----------------------------------------------------

  private findPolygonNode(
    nodeId: string
  ): { points: Vec2[]; label: string } | null {
    const b = this.floorplan.buildings.find((b) => b.id === nodeId);
    if (b) return { points: b.points, label: b.label };

    for (const building of this.floorplan.buildings) {
      const z = (building.zones ?? []).find((zone) => zone.id === nodeId);
      if (z) return { points: z.points, label: z.id };
    }
    return null;
  }

  public moveVertex(
    polygonNodeId: string,
    vertexIndex: number,
    newPosition: Vec2
  ): boolean {
    const node = this.findPolygonNode(polygonNodeId);
    if (!node || vertexIndex < 0 || vertexIndex >= node.points.length) {
      return false;
    }

    const snapped = this.snap(newPosition);
    const proposed = node.points.map((pt, i) =>
      i === vertexIndex ? snapped : pt
    );

    if (this.rules.enforce) {
      const violations = canPlace(
        this.floorplan,
        polygonNodeId,
        { points: proposed },
        { tolerance: this.rules.tolerance }
      );
      if (violations.length > 0) return false;
    }

    const oldPoints = [...node.points];
    this.commandStack.execute({
      name: `Move Vertex ${vertexIndex} of ${node.label}`,
      execute: () => {
        node.points.length = 0;
        node.points.push(...proposed);
      },
      undo: () => {
        node.points.length = 0;
        node.points.push(...oldPoints);
      },
    });

    this.emitChange();
    return true;
  }

  public addVertex(
    polygonNodeId: string,
    afterIndex: number,
    newPoint: Vec2
  ): boolean {
    const node = this.findPolygonNode(polygonNodeId);
    if (!node || afterIndex < 0 || afterIndex >= node.points.length) {
      return false;
    }

    const snapped = this.snap(newPoint);
    const proposed = [...node.points];
    proposed.splice(afterIndex + 1, 0, snapped);

    if (this.rules.enforce) {
      const violations = canPlace(
        this.floorplan,
        polygonNodeId,
        { points: proposed },
        { tolerance: this.rules.tolerance }
      );
      if (violations.length > 0) return false;
    }

    const oldPoints = [...node.points];
    this.commandStack.execute({
      name: `Add Vertex to ${node.label}`,
      execute: () => {
        node.points.length = 0;
        node.points.push(...proposed);
      },
      undo: () => {
        node.points.length = 0;
        node.points.push(...oldPoints);
      },
    });

    this.emitChange();
    return true;
  }

  public deleteVertex(polygonNodeId: string, vertexIndex: number): boolean {
    const node = this.findPolygonNode(polygonNodeId);
    if (!node || vertexIndex < 0 || vertexIndex >= node.points.length) {
      return false;
    }

    // A polygon must retain at least 3 vertices
    if (node.points.length <= 3) {
      return false;
    }

    const proposed = node.points.filter((_, i) => i !== vertexIndex);

    if (this.rules.enforce) {
      const violations = canPlace(
        this.floorplan,
        polygonNodeId,
        { points: proposed },
        { tolerance: this.rules.tolerance }
      );
      if (violations.length > 0) return false;
    }

    const oldPoints = [...node.points];
    this.commandStack.execute({
      name: `Delete Vertex ${vertexIndex} from ${node.label}`,
      execute: () => {
        node.points.length = 0;
        node.points.push(...proposed);
      },
      undo: () => {
        node.points.length = 0;
        node.points.push(...oldPoints);
      },
    });

    this.emitChange();
    return true;
  }

  public on<K extends keyof EditorEvents>(
    event: K,
    listener: (payload: EditorEvents[K]) => void
  ): () => void {
    return this.emitter.on(event, listener);
  }

  public off<K extends keyof EditorEvents>(
    event: K,
    listener: (payload: EditorEvents[K]) => void
  ): void {
    this.emitter.off(event, listener);
  }

  public destroy(): void {
    this.container.removeEventListener('keydown', this.onKeyDown);
    if (this.embeddedViewer) {
      this.embeddedViewer.destroy();
    }
    this.renderer?.destroy();
    this.emitter.removeAllListeners();
    this.editorCanvasContainer.remove();
  }
}

export function createEditor(
  container: HTMLElement,
  options?: EditorOptions
): EditorInstance {
  return new Editor(container, options);
}
