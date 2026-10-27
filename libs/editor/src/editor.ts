import {
  buildingFootprint,
  canPlace,
  inverseTransformPoint,
  parseFloorplan,
  pointInPolygon,
  polygonsOverlap,
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
import type { EditorContext } from './operations/context';
import { ClipboardOperations } from './operations/clipboard';
import { RowOperations } from './operations/rows';
import { ShapeOperations } from './operations/shapes';
import type {
  BuildingCreationMode,
  EditorEvents,
  EditorInstance,
  EditorOptions,
  EditorRulesConfig,
  GridSnappingConfig,
  RowCreationOptions,
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
  private readonly ctx: EditorContext = this.createContext();
  private readonly rowOps = new RowOperations(this.ctx);
  private readonly clipboardOps = new ClipboardOperations(this.ctx);
  private readonly shapeOps = new ShapeOperations(this.ctx);

  private isDrawingBuilding = false;
  private buildingCreationMode: BuildingCreationMode = 'outline';
  private draftBuildingPoints: Vec2[] = [];
  private draftBuildingLabel?: string;

  private isDrawingRow = false;
  private draftRowPoints: Vec2[] = [];
  private draftRowOpts?: RowCreationOptions;
  private draftRowBuildingId?: string;

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
      if (this.isDrawingRow || this.activeTool === 'row') {
        this.cancelRowCreation();
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

  private createContext(): EditorContext {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const editor = this;
    return {
      get floorplan() {
        return editor.floorplan;
      },
      get rules() {
        return editor.rules;
      },
      get commandStack() {
        return editor.commandStack;
      },
      get emitter() {
        return editor.emitter;
      },
      snap: (pt) => this.snap(pt),
      emitChange: () => this.emitChange(),
      batch: (name, fn) => this.batch(name, fn),
      getSelectedNodeIds: () => this.selectedNodeIds,
      selectNodes: (ids) => this.selectNodes(ids),
      clearSelection: () => this.clearSelection(),
      deleteNode: (id) => this.deleteNode(id),
    };
  }

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
    if (this.isDrawingRow) {
      this.cancelRowCreation();
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
      if (this.isDrawingRow) {
        this.cancelRowCreation();
      }
      this.startBuildingCreation();
      return;
    }
    if (tool === 'row') {
      if (this.isDrawingBuilding) {
        this.cancelBuildingCreation();
      }
      this.startRowCreation();
      return;
    }
    if (this.isDrawingBuilding) {
      this.cancelBuildingCreation();
    }
    if (this.isDrawingRow) {
      this.cancelRowCreation();
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

  public startRowCreation(
    options?: RowCreationOptions,
    buildingId?: string
  ): void {
    this.isDrawingRow = true;
    this.draftRowPoints = [];
    this.draftRowOpts = options;
    this.draftRowBuildingId = buildingId;
    this.activeTool = 'row';
    this.clearSelection();
    this.renderer?.setDraggableNodes(false);
    this.renderer?.setStageDraggable(false);
    this.renderer?.setCursor('crosshair');
    this.renderer?.clearDraftPolygon();
    this.emitter.emit('toolChange', 'row');
    this.emitter.emit('rowCreationStarted', options ?? {});
  }

  public cancelRowCreation(): void {
    const wasDrawing = this.isDrawingRow || this.activeTool === 'row';
    this.isDrawingRow = false;
    this.draftRowPoints = [];
    this.draftRowOpts = undefined;
    this.draftRowBuildingId = undefined;
    this.renderer?.clearDraftPolygon();
    this.renderer?.setStageDraggable(true);
    this.renderer?.setCursor('default');
    this.activeTool = 'select';
    this.renderer?.setDraggableNodes(true);
    this.emitter.emit('toolChange', 'select');
    if (wasDrawing) {
      this.emitter.emit('rowCreationCancelled', undefined);
    }
  }

  public isCreatingRow(): boolean {
    return this.isDrawingRow;
  }

  public getDraftRowPoints(): Vec2[] {
    return [...this.draftRowPoints];
  }

  private handleStageClick(
    worldPos: Vec2,
    _evt: MouseEvent | TouchEvent
  ): void {
    if (this.isDrawingRow) {
      const snappedPos = this.snap(worldPos);

      // End 1: First click
      if (this.draftRowPoints.length === 0) {
        const targetBuilding = this.draftRowBuildingId
          ? this.floorplan.buildings.find(
              (b) => b.id === this.draftRowBuildingId
            )
          : this.floorplan.buildings.find((b) =>
              pointInPolygon(snappedPos, buildingFootprint(b))
            );

        if (!targetBuilding) {
          this.emitter.emit('rowCreationFailed', {
            reason: 'Click inside a building to place the table.',
          });
          return;
        }

        this.draftRowPoints.push(snappedPos);
        this.draftRowBuildingId = targetBuilding.id;
        this.emitter.emit('rowCreationPointsChange', [...this.draftRowPoints]);
        this.renderer?.renderDraftRow?.(
          snappedPos,
          snappedPos,
          this.draftRowOpts
        );
        return;
      }

      // End 2: Second click
      const end1 = this.draftRowPoints[0];
      const end2 = snappedPos;
      const dist = Math.hypot(end2.x - end1.x, end2.y - end1.y);

      // Ignore if too short (e.g. accidental double-click in place)
      if (dist < 20) {
        return;
      }

      const building = this.draftRowBuildingId
        ? this.floorplan.buildings.find((b) => b.id === this.draftRowBuildingId)
        : this.floorplan.buildings.find((b) =>
            pointInPolygon(end1, buildingFootprint(b))
          );

      if (!building) {
        this.draftRowPoints = [];
        this.renderer?.clearDraftPolygon();
        this.emitter.emit('rowCreationPointsChange', []);
        this.emitter.emit('rowCreationFailed', {
          reason: 'Table must be placed inside a building.',
        });
        return;
      }

      // Compute local building coordinates
      const local1 = inverseTransformPoint(
        end1,
        building.position,
        building.rotation
      );
      const local2 = inverseTransformPoint(
        end2,
        building.position,
        building.rotation
      );

      const ldx = local2.x - local1.x;
      const ldy = local2.y - local1.y;
      const localDist = Math.hypot(ldx, ldy);
      const angleDeg = (Math.atan2(ldy, ldx) * 180) / Math.PI;

      const opts = this.draftRowOpts;
      const side = opts?.side ?? 'both';
      const nominalSpacing = opts?.seatSpacing ?? 40;
      const seatRadius = opts?.seatRadius ?? 14;
      const tableWidth = opts?.tableWidth ?? 28;

      // Dynamic calculation: keep exact user-drawn length localDist,
      // and determine seat count & spacing by rounding (L - 2*r) / spacing
      const availLength = Math.max(0, localDist - 2 * seatRadius);
      const slots = Math.max(1, Math.round(availLength / nominalSpacing) + 1);
      const seatCount = side === 'both' ? slots * 2 : slots;
      const effectiveSpacing =
        slots > 1 ? availLength / (slots - 1) : nominalSpacing;

      // Position offset along table axis by seatRadius
      const rad = (angleDeg * Math.PI) / 180;
      const rowPos: Vec2 = {
        x: Math.round((local1.x + Math.cos(rad) * seatRadius) * 100) / 100,
        y: Math.round((local1.y + Math.sin(rad) * seatRadius) * 100) / 100,
      };

      const createdRow = this.createRow(building.id, rowPos, seatCount, {
        side,
        seatSpacing: Math.round(effectiveSpacing * 100) / 100,
        seatRadius,
        tableWidth,
        tableLength: Math.round(localDist * 100) / 100,
        rotation: Math.round(angleDeg * 10) / 10,
      });

      if (createdRow) {
        this.isDrawingRow = false;
        this.draftRowPoints = [];
        this.draftRowOpts = undefined;
        this.draftRowBuildingId = undefined;
        this.renderer?.clearDraftPolygon();
        this.renderer?.setStageDraggable(true);
        this.renderer?.setCursor('default');
        this.activeTool = 'select';
        this.renderer?.setDraggableNodes(true);
        this.emitter.emit('toolChange', 'select');
        this.selectNodes([createdRow.id]);
        this.emitter.emit('rowCreationCompleted', createdRow);
      } else {
        // Validation failed (exceeds bounds or overlaps)
        this.draftRowPoints = [];
        this.renderer?.clearDraftPolygon();
        this.emitter.emit('rowCreationPointsChange', []);
        this.emitter.emit('rowCreationFailed', {
          reason:
            'Cannot place table: exceeds building bounds or overlaps existing objects.',
        });
      }
      return;
    }

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
    if (this.isDrawingRow && this.draftRowPoints.length === 1) {
      const end1 = this.draftRowPoints[0];
      const end2 = this.snap(worldPos);

      let isInvalid = false;
      if (this.rules.enforce) {
        const building = this.draftRowBuildingId
          ? this.floorplan.buildings.find(
              (b) => b.id === this.draftRowBuildingId
            )
          : this.floorplan.buildings.find((b) =>
              pointInPolygon(end1, buildingFootprint(b))
            );

        if (!building) {
          isInvalid = true;
        } else {
          const bPoly = buildingFootprint(building);
          if (!pointInPolygon(end2, bPoly)) {
            isInvalid = true;
          }
        }
      }

      this.renderer?.renderDraftRow?.(end1, end2, this.draftRowOpts, isInvalid);
      return;
    }

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

  // --- rows (./operations/rows.ts) ---

  public createRow(
    buildingId: string,
    position: Vec2,
    seatCount: number,
    opts?: {
      side?: 'one' | 'both';
      seatSpacing?: number;
      seatRadius?: number;
      tableWidth?: number;
      tableLength?: number;
      rotation?: number;
    }
  ): Row | null {
    return this.rowOps.createRow(buildingId, position, seatCount, opts);
  }

  public addSeatToRow(
    buildingId: string,
    rowId: string,
    seatSide: 'a' | 'b' = 'a'
  ): Seat | null {
    return this.rowOps.addSeatToRow(buildingId, rowId, seatSide);
  }

  public reparentRow(
    rowId: string,
    targetBuildingId: string,
    dropWorldPosition?: Vec2
  ): boolean {
    return this.rowOps.reparentRow(rowId, targetBuildingId, dropWorldPosition);
  }

  public addSeatOnCanvas(buildingId: string, position: Vec2): Row | null {
    return this.rowOps.addSeatOnCanvas(buildingId, position);
  }

  public moveSeatToRow(
    sourceRowId: string,
    seatId: string,
    targetRowId: string,
    targetSide: 'a' | 'b' = 'a'
  ): boolean {
    return this.rowOps.moveSeatToRow(
      sourceRowId,
      seatId,
      targetRowId,
      targetSide
    );
  }

  public setRowSide(rowId: string, side: 'one' | 'both'): boolean {
    return this.rowOps.setRowSide(rowId, side);
  }

  public setRowTableWidth(rowId: string, tableWidth: number): boolean {
    return this.rowOps.setRowTableWidth(rowId, tableWidth);
  }

  public setRowSeatSpacing(rowId: string, seatSpacing: number): boolean {
    return this.rowOps.setRowSeatSpacing(rowId, seatSpacing);
  }

  public setRowSeatRadius(rowId: string, seatRadius: number): boolean {
    return this.rowOps.setRowSeatRadius(rowId, seatRadius);
  }

  public setRowSeatCount(rowId: string, seatCount: number): boolean {
    return this.rowOps.setRowSeatCount(rowId, seatCount);
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

  // --- clipboard (./operations/clipboard.ts) ---

  public copySelection(): boolean {
    return this.clipboardOps.copySelection();
  }

  public cutSelection(): boolean {
    return this.clipboardOps.cutSelection();
  }

  public canPaste(): boolean {
    return this.clipboardOps.canPaste();
  }

  public paste(
    targetBuildingId?: string,
    offset: Vec2 = { x: 30, y: 30 }
  ): boolean {
    return this.clipboardOps.paste(targetBuildingId, offset);
  }

  public duplicateNode(nodeId: string): boolean {
    return this.clipboardOps.duplicateNode(nodeId);
  }

  // --- shapes (./operations/shapes.ts) ---

  public flipNode(
    nodeId: string,
    direction: 'horizontal' | 'vertical'
  ): boolean {
    return this.shapeOps.flipNode(nodeId, direction);
  }

  public scaleShape(nodeId: string, scaleX: number, scaleY: number): boolean {
    return this.shapeOps.scaleShape(nodeId, scaleX, scaleY);
  }

  public setShapeDimensions(
    nodeId: string,
    width: number,
    height: number
  ): boolean {
    return this.shapeOps.setShapeDimensions(nodeId, width, height);
  }

  public moveVertex(
    polygonNodeId: string,
    vertexIndex: number,
    newPosition: Vec2
  ): boolean {
    return this.shapeOps.moveVertex(polygonNodeId, vertexIndex, newPosition);
  }

  public addVertex(
    polygonNodeId: string,
    afterIndex: number,
    newPoint: Vec2
  ): boolean {
    return this.shapeOps.addVertex(polygonNodeId, afterIndex, newPoint);
  }

  public deleteVertex(polygonNodeId: string, vertexIndex: number): boolean {
    return this.shapeOps.deleteVertex(polygonNodeId, vertexIndex);
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
