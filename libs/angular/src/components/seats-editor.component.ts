import type {
  AfterViewInit,
  ElementRef,
  OnChanges,
  OnDestroy,
  SimpleChanges} from '@angular/core';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  Output,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  polygonBoundingBox,
  type Building,
  type Floorplan,
  type FloorplanBackground,
  type Row,
  type Seat,
  type Vec2,
  type Violation,
  type Zone,
} from '@open-seats/core';
import {
  createEditor,
  type EditorInstance,
  type EditorOptions,
  type ToolType,
} from '@open-seats/editor';

@Component({
  selector: 'seats-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './seats-editor.component.html',
  styleUrls: ['./seats-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeatsEditorComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('container', { static: true })
  containerRef!: ElementRef<HTMLDivElement>;

  @Input() floorplan?: Floorplan;
  @Input() tool: ToolType = 'select';
  @Input() options?: Partial<EditorOptions>;

  // Panel visibility inputs (enabled by default)
  @Input() showToolbar = true;
  @Input() showProperties = true;
  @Input() showFloatingBar = true;

  @Output() change = new EventEmitter<Floorplan>();
  @Output() toolChange = new EventEmitter<ToolType>();
  @Output() selectionChange = new EventEmitter<string[]>();
  @Output() previewToggle = new EventEmitter<boolean>();
  @Output() violationsUpdated = new EventEmitter<Violation[]>();

  private editor?: EditorInstance;
  private lastEmittedPlan?: Floorplan;

  // Editor UI State
  public currentTool: ToolType = 'select';
  public isPreviewActive = false;
  public selectedNodeId: string | null = null;
  public selectedNodeType: 'building' | 'zone' | 'row' | null = null;
  public lastViolations: Violation[] = [];

  // Editions Panel Tab state
  public editionsTab: 'buildings' | 'zones' | 'rows' = 'buildings';

  // Editions Forms - Buildings
  public buildingDrawMode: 'draw' | 'rect' = 'draw';
  public buildingCreationMode: 'outline' | 'rectangle' = 'outline';
  public newBuildingLabel = 'Building';
  public newBuildingWidth = 420;
  public newBuildingHeight = 320;
  public isDrawingBuilding = false;
  public draftPointsCount = 0;
  public buildingCreationError: string | null = null;

  // Editions Forms - Zones
  public zoneTargetBuildingId = '';
  public zoneDrawMode: 'rect' | 'poly' = 'rect';
  public newZoneLabel = 'Stage';
  public newZoneFill = '#6366f1';
  public newZoneWidth = 160;
  public newZoneHeight = 90;

  // Editions Forms - Rows
  public rowTargetBuildingId = '';
  public newRowSeatCount = 8;
  public newRowSide: 'one' | 'both' = 'both';
  public newRowSeatSpacing = 40;
  public newRowSeatRadius = 14;
  public newRowTableWidth = 28;
  public newRowRotation = 0;
  public nudgeStep = 10;

  // Preset Colors for Zones
  public readonly zoneColorPresets = [
    { name: 'Stage', color: '#6366f1' },
    { name: 'Bar', color: '#f59e0b' },
    { name: 'Lounge', color: '#10b981' },
    { name: 'Dance', color: '#06b6d4' },
    { name: 'VIP', color: '#ec4899' },
    { name: 'Service', color: '#64748b' },
  ];

  // -------------------------------------------------------------
  // Getters for Selection & Statistics
  // -------------------------------------------------------------
  public get currentFloorplan(): Floorplan | undefined {
    return this.editor?.getFloorplan() ?? this.floorplan;
  }

  public get selectedBuilding(): Building | null {
    if (!this.selectedNodeId || this.selectedNodeType !== 'building') return null;
    return this.currentFloorplan?.buildings.find((b) => b.id === this.selectedNodeId) ?? null;
  }

  public get selectedZone(): { zone: Zone; building: Building } | null {
    if (!this.selectedNodeId || this.selectedNodeType !== 'zone') return null;
    const plan = this.currentFloorplan;
    if (!plan) return null;
    for (const b of plan.buildings) {
      const z = (b.zones ?? []).find((zone) => zone.id === this.selectedNodeId);
      if (z) return { zone: z, building: b };
    }
    return null;
  }

  public get selectedRow(): { row: Row; building: Building } | null {
    if (!this.selectedNodeId || this.selectedNodeType !== 'row') return null;
    const plan = this.currentFloorplan;
    if (!plan) return null;
    for (const b of plan.buildings) {
      const r = (b.rows ?? []).find((row) => row.id === this.selectedNodeId);
      if (r) return { row: r, building: b };
    }
    return null;
  }

  public get selectedShapeDimensions(): { width: number; height: number } | null {
    if (this.selectedBuilding) {
      const bbox = polygonBoundingBox(this.selectedBuilding.points);
      return { width: Math.round(bbox.width), height: Math.round(bbox.height) };
    }
    if (this.selectedZone) {
      const bbox = polygonBoundingBox(this.selectedZone.zone.points);
      return { width: Math.round(bbox.width), height: Math.round(bbox.height) };
    }
    return null;
  }

  public get totalBuildingsCount(): number {
    return this.currentFloorplan?.buildings.length ?? 0;
  }

  public get totalZonesCount(): number {
    return (
      this.currentFloorplan?.buildings.reduce(
        (acc, b) => acc + (b.zones?.length ?? 0),
        0
      ) ?? 0
    );
  }

  public get totalRowsCount(): number {
    return (
      this.currentFloorplan?.buildings.reduce(
        (acc, b) => acc + (b.rows?.length ?? 0),
        0
      ) ?? 0
    );
  }

  public get totalSeatsCount(): number {
    let count = 0;
    for (const b of this.currentFloorplan?.buildings ?? []) {
      for (const r of b.rows ?? []) {
        count += r.seats?.length ?? 0;
      }
    }
    return count;
  }

  // -------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------
  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.editor = createEditor(this.containerRef.nativeElement, {
        ...this.options,
        floorplan: this.floorplan,
      });

      this.editor.setTool(this.tool);
      this.currentTool = this.tool;

      this.editor.on('change', (plan) => {
        this.lastEmittedPlan = plan;
        this.ngZone.run(() => {
          this.change.emit(plan);
          this.cdr.markForCheck();
        });
      });

      this.editor.on('toolChange', (t) => {
        this.ngZone.run(() => {
          this.currentTool = t;
          this.toolChange.emit(t);
          this.cdr.markForCheck();
        });
      });

      this.editor.on('selectionChange', (ids) => {
        this.ngZone.run(() => {
          this.updateSelectedNodeFromId(ids.length > 0 ? ids[0] : null);
          this.selectionChange.emit(ids);
          this.cdr.markForCheck();
        });
      });

      this.editor.on('previewToggle', (isPreview) => {
        this.ngZone.run(() => {
          this.isPreviewActive = isPreview;
          this.previewToggle.emit(isPreview);
          this.cdr.markForCheck();
        });
      });

      this.editor.on('violationsUpdated', (violations) => {
        this.ngZone.run(() => {
          this.lastViolations = violations;
          this.violationsUpdated.emit(violations);
          this.cdr.markForCheck();
        });
      });

      this.editor.on('buildingCreationStarted', (mode) => {
        this.ngZone.run(() => {
          this.isDrawingBuilding = true;
          this.buildingCreationMode = mode || (this.buildingDrawMode === 'rect' ? 'rectangle' : 'outline');
          this.draftPointsCount = 0;
          this.buildingCreationError = null;
          this.cdr.markForCheck();
        });
      });

      this.editor.on('buildingCreationPointsChange', (pts) => {
        this.ngZone.run(() => {
          this.draftPointsCount = pts.length;
          this.buildingCreationError = null;
          this.cdr.markForCheck();
        });
      });

      this.editor.on('buildingCreationCompleted', (b) => {
        this.ngZone.run(() => {
          this.isDrawingBuilding = false;
          this.draftPointsCount = 0;
          this.buildingCreationError = null;
          this.selectNode(b.id, 'building');
          this.cdr.markForCheck();
        });
      });

      this.editor.on('buildingCreationCancelled', () => {
        this.ngZone.run(() => {
          this.isDrawingBuilding = false;
          this.draftPointsCount = 0;
          this.buildingCreationError = null;
          this.cdr.markForCheck();
        });
      });

      this.editor.on('buildingCreationFailed', (payload) => {
        this.ngZone.run(() => {
          this.buildingCreationError = payload.reason;
          this.cdr.markForCheck();
        });
      });
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    const editor = this.editor;
    if (!editor) return;

    this.ngZone.runOutsideAngular(() => {
      if (changes['floorplan'] && this.floorplan) {
        if (this.floorplan !== this.lastEmittedPlan) {
          const current = editor.getFloorplan();
          if (JSON.stringify(current) !== JSON.stringify(this.floorplan)) {
            editor.loadFloorplan(this.floorplan);
          }
        }
      }

      if (changes['tool'] && this.tool) {
        this.currentTool = this.tool;
        editor.setTool(this.tool);
      }
    });
  }

  @HostListener('window:keydown', ['$event'])
  public handleKeyDown(e: KeyboardEvent): void {
    if (e.defaultPrevented) return;

    const target = e.target as HTMLElement | null;
    const tagName = target?.tagName?.toLowerCase();
    if (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      target?.isContentEditable
    ) {
      return;
    }

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    if (isCtrlOrCmd && (e.key === 'c' || e.key === 'C')) {
      if (this.selectedNodeId) {
        e.preventDefault();
        this.copySelected();
      }
      return;
    }

    if (isCtrlOrCmd && (e.key === 'x' || e.key === 'X')) {
      if (this.selectedNodeId) {
        e.preventDefault();
        this.cutSelected();
      }
      return;
    }

    if (isCtrlOrCmd && (e.key === 'v' || e.key === 'V')) {
      if (this.canPaste()) {
        e.preventDefault();
        this.paste();
      }
      return;
    }

    if (isCtrlOrCmd && (e.key === 'd' || e.key === 'D')) {
      if (this.selectedNodeId) {
        e.preventDefault();
        this.duplicateSelected();
      }
      return;
    }

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

    if (!this.selectedNodeId) return;

    const mult = e.shiftKey ? 10 : 1;
    const step = this.nudgeStep * mult;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.nudgeSelected(0, -step);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.nudgeSelected(0, step);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.nudgeSelected(-step, 0);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.nudgeSelected(step, 0);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.deleteSelected();
    }
  }

  private updateSelectedNodeFromId(nodeId: string | null): void {
    this.selectedNodeId = nodeId;
    if (!nodeId) {
      this.selectedNodeType = null;
      return;
    }

    const plan = this.currentFloorplan;
    if (!plan) {
      this.selectedNodeType = null;
      return;
    }

    const b = plan.buildings.find((item) => item.id === nodeId);
    if (b) {
      this.selectedNodeType = 'building';
      return;
    }

    for (const building of plan.buildings) {
      if ((building.zones ?? []).some((z) => z.id === nodeId)) {
        this.selectedNodeType = 'zone';
        return;
      }
      if ((building.rows ?? []).some((r) => r.id === nodeId)) {
        this.selectedNodeType = 'row';
        return;
      }
    }

    this.selectedNodeType = null;
  }

  // -------------------------------------------------------------
  // Public Editor API Delegations
  // -------------------------------------------------------------
  public getFloorplan(): Floorplan | undefined {
    return this.editor?.getFloorplan();
  }

  public loadFloorplan(plan: Floorplan): void {
    this.editor?.loadFloorplan(plan);
    this.cdr.markForCheck();
  }

  public setTool(tool: ToolType): void {
    this.currentTool = tool;
    this.editor?.setTool(tool);
    this.cdr.markForCheck();
  }

  public undo(): boolean {
    const res = this.editor?.undo() ?? false;
    this.cdr.markForCheck();
    return res;
  }

  public redo(): boolean {
    const res = this.editor?.redo() ?? false;
    this.cdr.markForCheck();
    return res;
  }

  public canUndo(): boolean {
    return this.editor?.canUndo() ?? false;
  }

  public canRedo(): boolean {
    return this.editor?.canRedo() ?? false;
  }

  public togglePreview(enabled?: boolean): boolean {
    const res = this.editor?.togglePreview(enabled) ?? false;
    this.isPreviewActive = this.editor?.isPreview() ?? false;
    this.cdr.markForCheck();
    return res;
  }

  public isPreview(): boolean {
    return this.editor?.isPreview() ?? false;
  }

  public setBackground(bg: FloorplanBackground | undefined): void {
    this.editor?.setBackground(bg);
  }

  // -------------------------------------------------------------
  // Creation Handlers (Direct & Form)
  // -------------------------------------------------------------
  public createBuilding(
    points: Vec2[],
    label?: string,
    position?: Vec2
  ): Building | null {
    const res = this.editor?.createBuilding(points, label, position) ?? null;
    this.cdr.markForCheck();
    return res;
  }

  public startBuildingCreation(
    label?: string,
    mode?: 'outline' | 'rectangle'
  ): void {
    const creationMode =
      mode || (this.buildingDrawMode === 'rect' ? 'rectangle' : 'outline');
    this.buildingCreationMode = creationMode;
    this.editor?.startBuildingCreation(
      label || this.newBuildingLabel || 'Building',
      creationMode
    );
    this.cdr.markForCheck();
  }

  public cancelBuildingCreation(): void {
    this.editor?.cancelBuildingCreation();
    this.isDrawingBuilding = false;
    this.draftPointsCount = 0;
    this.buildingCreationError = null;
    this.cdr.markForCheck();
  }

  public createRectangleBuilding(
    position: Vec2,
    width: number,
    height: number,
    label?: string
  ): Building | null {
    const res =
      this.editor?.createRectangleBuilding(position, width, height, label) ??
      null;
    this.cdr.markForCheck();
    return res;
  }

  public createBuildingFromForm(): Building | null {
    if (this.isDrawingBuilding) {
      this.cancelBuildingCreation();
      return null;
    }

    const mode = this.buildingDrawMode === 'rect' ? 'rectangle' : 'outline';
    this.startBuildingCreation(this.newBuildingLabel, mode);
    return null;
  }

  public createZone(
    buildingId: string,
    points: Vec2[],
    fill?: string,
    position?: Vec2
  ): Zone | null {
    const res =
      this.editor?.createZone(buildingId, points, fill ?? '#555555', position) ??
      null;
    this.cdr.markForCheck();
    return res;
  }

  public createRectangleZone(
    buildingId: string,
    position: Vec2,
    width: number,
    height: number,
    fill?: string
  ): Zone | null {
    const res =
      this.editor?.createRectangleZone(
        buildingId,
        position,
        width,
        height,
        fill
      ) ?? null;
    this.cdr.markForCheck();
    return res;
  }

  public createZoneFromForm(): Zone | null {
    const bId =
      this.zoneTargetBuildingId ||
      this.selectedBuilding?.id ||
      this.currentFloorplan?.buildings?.[0]?.id;

    if (!bId) return null;
    const b = this.currentFloorplan?.buildings?.find((item) => item.id === bId);
    if (!b) return null;

    const label = this.newZoneLabel || 'Zone';
    const posX = 30;
    const posY = 30;

    let created: Zone | null = null;
    if (this.zoneDrawMode === 'rect') {
      created = this.createRectangleZone(
        bId,
        { x: posX, y: posY },
        this.newZoneWidth,
        this.newZoneHeight,
        this.newZoneFill
      );
    } else {
      const w = this.newZoneWidth;
      const h = this.newZoneHeight;
      const poly = [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w * 0.8, y: h },
        { x: w * 0.2, y: h },
      ];
      created = this.createZone(bId, poly, this.newZoneFill, {
        x: posX,
        y: posY,
      });
    }

    if (created) {
      if (label) {
        this.updateNodeLabel(created.id, label);
      }
      this.selectNode(created.id, 'zone');
    }
    return created;
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
    const res =
      this.editor?.createRow(buildingId, position, seatCount, opts) ?? null;
    this.cdr.markForCheck();
    return res;
  }

  public createRowFromForm(): Row | null {
    const bId =
      this.rowTargetBuildingId ||
      this.selectedBuilding?.id ||
      this.currentFloorplan?.buildings?.[0]?.id;

    if (!bId) return null;
    const b = this.currentFloorplan?.buildings?.find((item) => item.id === bId);
    if (!b) return null;

    const posX = 40 + ((b.rows?.length ?? 0) % 5) * 20;
    const posY = 40 + ((b.rows?.length ?? 0) % 5) * 50;

    const row = this.createRow(
      bId,
      { x: posX, y: posY },
      this.newRowSeatCount,
      {
        side: this.newRowSide,
        seatSpacing: this.newRowSeatSpacing,
        seatRadius: this.newRowSeatRadius,
        tableWidth: this.newRowTableWidth,
        rotation: this.newRowRotation,
      }
    );

    if (row) {
      this.selectNode(row.id, 'row');
    }
    return row;
  }

  public addSeatToRow(
    buildingId: string,
    rowId: string,
    side?: 'a' | 'b'
  ): Seat | null {
    const res = this.editor?.addSeatToRow(buildingId, rowId, side) ?? null;
    this.cdr.markForCheck();
    return res;
  }

  public addSeatOnCanvas(buildingId: string, position: Vec2): Row | null {
    const res = this.editor?.addSeatOnCanvas(buildingId, position) ?? null;
    this.cdr.markForCheck();
    return res;
  }

  public moveSeatToRow(
    sourceRowId: string,
    seatId: string,
    targetRowId: string,
    targetSide?: 'a' | 'b'
  ): boolean {
    const res =
      this.editor?.moveSeatToRow(sourceRowId, seatId, targetRowId, targetSide) ??
      false;
    this.cdr.markForCheck();
    return res;
  }

  // -------------------------------------------------------------
  // Node Manipulation: Position, Nudge, Rotation, Scaling
  // -------------------------------------------------------------
  public moveNode(nodeId: string, newPosition: Vec2): boolean {
    const res = this.editor?.moveNode(nodeId, newPosition) ?? false;
    this.cdr.markForCheck();
    return res;
  }

  public updateSelectedPosition(x: number, y: number): boolean {
    if (!this.selectedNodeId) return false;
    return this.moveNode(this.selectedNodeId, { x, y });
  }

  public nudgeNode(nodeId: string, dx: number, dy: number): boolean {
    const res = this.editor?.nudgeNode(nodeId, dx, dy) ?? false;
    this.cdr.markForCheck();
    return res;
  }

  public nudgeSelected(dx: number, dy: number): boolean {
    if (!this.selectedNodeId) return false;
    return this.nudgeNode(this.selectedNodeId, dx, dy);
  }

  public setNudgeStep(step: number): void {
    this.nudgeStep = step;
    this.cdr.markForCheck();
  }

  public getNodePosition(nodeId: string): Vec2 | null {
    return this.editor?.getNodePosition(nodeId) ?? null;
  }

  public rotateNode(nodeId: string, newRotation: number): boolean {
    const res = this.editor?.rotateNode(nodeId, newRotation) ?? false;
    this.cdr.markForCheck();
    return res;
  }

  public updateSelectedRotation(rot: number): boolean {
    if (!this.selectedNodeId) return false;
    return this.rotateNode(this.selectedNodeId, rot);
  }

  public reparentRow(
    rowId: string,
    targetBuildingId: string,
    dropWorldPosition?: Vec2
  ): boolean {
    const res =
      this.editor?.reparentRow(rowId, targetBuildingId, dropWorldPosition) ??
      false;
    this.cdr.markForCheck();
    return res;
  }

  public deleteNode(nodeId: string): boolean {
    const res = this.editor?.deleteNode(nodeId) ?? false;
    if (res && this.selectedNodeId === nodeId) {
      this.selectedNodeId = null;
      this.selectedNodeType = null;
    }
    this.cdr.markForCheck();
    return res;
  }

  public deleteSelected(): boolean {
    if (!this.selectedNodeId) return false;
    return this.deleteNode(this.selectedNodeId);
  }

  public duplicateNode(nodeId: string): boolean {
    const res = this.editor?.duplicateNode(nodeId) ?? false;
    if (res) {
      const selIds = this.getSelectedNodeIds();
      if (selIds.length > 0) {
        this.updateSelectedNodeFromId(selIds[0]);
      }
    }
    this.cdr.markForCheck();
    return res;
  }

  public duplicateSelected(): boolean {
    if (!this.selectedNodeId) return false;
    return this.duplicateNode(this.selectedNodeId);
  }

  public updateNodeLabel(nodeId: string, label: string): boolean {
    const res = this.editor?.updateNodeLabel(nodeId, label) ?? false;
    this.cdr.markForCheck();
    return res;
  }

  public updateSelectedLabel(newLabel: string): boolean {
    if (!this.selectedNodeId) return false;
    return this.updateNodeLabel(this.selectedNodeId, newLabel);
  }

  public setZoneFill(zoneId: string, fill: string): boolean {
    const res = this.editor?.setZoneFill(zoneId, fill) ?? false;
    this.cdr.markForCheck();
    return res;
  }

  public updateZoneFill(color: string): boolean {
    if (!this.selectedNodeId) return false;
    return this.setZoneFill(this.selectedNodeId, color);
  }

  public scaleShape(nodeId: string, scaleX: number, scaleY: number): boolean {
    const res = this.editor?.scaleShape(nodeId, scaleX, scaleY) ?? false;
    this.cdr.markForCheck();
    return res;
  }

  public scaleSelectedShape(factor: number): boolean {
    if (!this.selectedNodeId) return false;
    return this.scaleShape(this.selectedNodeId, factor, factor);
  }

  public setShapeDimensions(
    nodeId: string,
    width: number,
    height: number
  ): boolean {
    const res = this.editor?.setShapeDimensions(nodeId, width, height) ?? false;
    this.cdr.markForCheck();
    return res;
  }

  public updateShapeWidth(newWidth: number): boolean {
    if (!this.selectedNodeId || !this.selectedShapeDimensions) return false;
    const currentH = this.selectedShapeDimensions.height;
    return this.setShapeDimensions(
      this.selectedNodeId,
      Math.max(20, newWidth),
      currentH
    );
  }

  public updateShapeHeight(newHeight: number): boolean {
    if (!this.selectedNodeId || !this.selectedShapeDimensions) return false;
    const currentW = this.selectedShapeDimensions.width;
    return this.setShapeDimensions(
      this.selectedNodeId,
      currentW,
      Math.max(20, newHeight)
    );
  }

  // -------------------------------------------------------------
  // Row Properties Adjustments
  // -------------------------------------------------------------
  public setRowSide(rowIdOrSide: string | 'one' | 'both', side?: 'one' | 'both'): boolean {
    if (side !== undefined) {
      const res = this.editor?.setRowSide(rowIdOrSide as string, side) ?? false;
      this.cdr.markForCheck();
      return res;
    }
    if (!this.selectedRow) return false;
    const res =
      this.editor?.setRowSide(
        this.selectedRow.row.id,
        rowIdOrSide as 'one' | 'both'
      ) ?? false;
    this.cdr.markForCheck();
    return res;
  }

  public setRowTableWidth(rowIdOrWidth: string | number, tableWidth?: number): boolean {
    if (typeof rowIdOrWidth === 'string' && tableWidth !== undefined) {
      const res = this.editor?.setRowTableWidth(rowIdOrWidth, tableWidth) ?? false;
      this.cdr.markForCheck();
      return res;
    }
    if (!this.selectedRow) return false;
    const val = typeof rowIdOrWidth === 'number' ? rowIdOrWidth : tableWidth ?? 0;
    const res =
      this.editor?.setRowTableWidth(this.selectedRow.row.id, Math.max(0, val)) ??
      false;
    this.cdr.markForCheck();
    return res;
  }

  public setRowSeatSpacing(rowIdOrSpacing: string | number, seatSpacing?: number): boolean {
    if (typeof rowIdOrSpacing === 'string' && seatSpacing !== undefined) {
      const res = this.editor?.setRowSeatSpacing(rowIdOrSpacing, seatSpacing) ?? false;
      this.cdr.markForCheck();
      return res;
    }
    if (!this.selectedRow) return false;
    const val = typeof rowIdOrSpacing === 'number' ? rowIdOrSpacing : seatSpacing ?? 40;
    const res =
      this.editor?.setRowSeatSpacing(this.selectedRow.row.id, Math.max(28, val)) ??
      false;
    this.cdr.markForCheck();
    return res;
  }

  public setRowSeatRadius(rowIdOrRadius: string | number, seatRadius?: number): boolean {
    if (typeof rowIdOrRadius === 'string' && seatRadius !== undefined) {
      const res = this.editor?.setRowSeatRadius(rowIdOrRadius, seatRadius) ?? false;
      this.cdr.markForCheck();
      return res;
    }
    if (!this.selectedRow) return false;
    const val = typeof rowIdOrRadius === 'number' ? rowIdOrRadius : seatRadius ?? 14;
    const res =
      this.editor?.setRowSeatRadius(this.selectedRow.row.id, Math.max(8, val)) ??
      false;
    this.cdr.markForCheck();
    return res;
  }

  public setRowSeatCount(rowIdOrCount: string | number, count?: number): boolean {
    if (typeof rowIdOrCount === 'string' && count !== undefined) {
      const res = this.editor?.setRowSeatCount(rowIdOrCount, count) ?? false;
      this.cdr.markForCheck();
      return res;
    }
    if (!this.selectedRow) return false;
    const targetCount = typeof rowIdOrCount === 'number' ? rowIdOrCount : count ?? 1;
    const res =
      this.editor?.setRowSeatCount(
        this.selectedRow.row.id,
        Math.max(1, targetCount)
      ) ?? false;
    this.cdr.markForCheck();
    return res;
  }

  public incrementSeatCount(): void {
    if (!this.selectedRow) return;
    const delta = this.selectedRow.row.side === 'both' ? 2 : 1;
    this.setRowSeatCount(this.selectedRow.row.seats.length + delta);
  }

  public decrementSeatCount(): void {
    if (!this.selectedRow) return;
    const delta = this.selectedRow.row.side === 'both' ? 2 : 1;
    this.setRowSeatCount(Math.max(1, this.selectedRow.row.seats.length - delta));
  }

  // -------------------------------------------------------------
  // Clipboard Operations
  // -------------------------------------------------------------
  public copySelection(): boolean {
    const res = this.editor?.copySelection() ?? false;
    this.cdr.markForCheck();
    return res;
  }

  public copySelected(): boolean {
    return this.copySelection();
  }

  public cutSelection(): boolean {
    const res = this.editor?.cutSelection() ?? false;
    if (res) {
      this.selectedNodeId = null;
      this.selectedNodeType = null;
      this.cdr.markForCheck();
    }
    return res;
  }

  public cutSelected(): boolean {
    return this.cutSelection();
  }

  public paste(targetBuildingId?: string, offset?: Vec2): boolean {
    const res = this.editor?.paste(targetBuildingId, offset) ?? false;
    if (res) {
      const selIds = this.getSelectedNodeIds();
      if (selIds.length > 0) {
        this.updateSelectedNodeFromId(selIds[0]);
      }
      this.cdr.markForCheck();
    }
    return res;
  }

  public canPaste(): boolean {
    return this.editor?.canPaste() ?? false;
  }

  // -------------------------------------------------------------
  // Selection Management
  // -------------------------------------------------------------
  public selectNodes(ids: string[]): void {
    this.editor?.selectNodes(ids);
    this.updateSelectedNodeFromId(ids.length > 0 ? ids[0] : null);
    this.cdr.markForCheck();
  }

  public selectNode(id: string, type?: 'building' | 'zone' | 'row'): void {
    this.selectedNodeId = id;
    if (type) {
      this.selectedNodeType = type;
    } else {
      this.updateSelectedNodeFromId(id);
    }
    this.editor?.selectNodes([id]);
    this.cdr.markForCheck();
  }

  public clearSelection(): void {
    this.selectedNodeId = null;
    this.selectedNodeType = null;
    this.editor?.clearSelection();
    this.cdr.markForCheck();
  }

  public clearEditorSelection(): void {
    this.clearSelection();
  }

  public getSelectedNodeIds(): string[] {
    return this.editor?.getSelectedNodeIds() ?? [];
  }

  // -------------------------------------------------------------
  // Vertex Editing
  // -------------------------------------------------------------
  public moveVertex(
    polygonNodeId: string,
    vertexIndex: number,
    newPosition: Vec2
  ): boolean {
    const res =
      this.editor?.moveVertex(polygonNodeId, vertexIndex, newPosition) ?? false;
    this.cdr.markForCheck();
    return res;
  }

  public addVertex(
    polygonNodeId: string,
    afterIndex: number,
    newPoint: Vec2
  ): boolean {
    const res =
      this.editor?.addVertex(polygonNodeId, afterIndex, newPoint) ?? false;
    this.cdr.markForCheck();
    return res;
  }

  public deleteVertex(polygonNodeId: string, vertexIndex: number): boolean {
    const res =
      this.editor?.deleteVertex(polygonNodeId, vertexIndex) ?? false;
    this.cdr.markForCheck();
    return res;
  }

  // -------------------------------------------------------------
  // Zoom & Viewport
  // -------------------------------------------------------------
  public zoomIn(factor?: number): void {
    this.editor?.zoomIn(factor);
  }

  public zoomOut(factor?: number): void {
    this.editor?.zoomOut(factor);
  }

  public resetZoom(): void {
    this.editor?.resetZoom();
  }

  public panTo(x: number, y: number): void {
    this.editor?.panTo(x, y);
  }

  public panBy(dx: number, dy: number): void {
    this.editor?.panBy(dx, dy);
  }

  public getScale(): number {
    return this.editor?.getScale() ?? 1;
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }
}
