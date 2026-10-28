import type {
  Building,
  Floorplan,
  FloorplanBackground,
  Row,
  Seat,
  Vec2,
  Violation,
  Zone,
} from '@open-seats/core';

export type ToolType =
  'select' | 'pan' | 'building' | 'row' | 'zone' | 'add-seat';

export interface EditorRulesConfig {
  enforce: boolean;
  tolerance: number;
}

export interface GridSnappingConfig {
  enabled: boolean;
  size: number;
}

export interface EditorOptions {
  floorplan?: Floorplan;
  rules?: Partial<EditorRulesConfig>;
  gridSnapping?: Partial<GridSnappingConfig>;
}

export type BuildingCreationMode = 'outline' | 'rectangle';

export interface RowCreationOptions {
  side?: 'one' | 'both';
  seatSpacing?: number;
  seatRadius?: number;
  tableWidth?: number;
}

export interface EditorEvents {
  change: Floorplan;
  toolChange: ToolType;
  selectionChange: string[];
  previewToggle: boolean;
  violationsUpdated: Violation[];
  buildingCreationStarted: BuildingCreationMode;
  buildingCreationPointsChange: Vec2[];
  buildingCreationCompleted: Building;
  buildingCreationCancelled: void;
  buildingCreationFailed: { reason: string; violations?: Violation[] };
  rowCreationStarted: RowCreationOptions;
  rowCreationPointsChange: Vec2[];
  rowCreationCompleted: Row;
  rowCreationCancelled: void;
  rowCreationFailed: { reason: string; violations?: Violation[] };
}

export interface EditorInstance {
  loadFloorplan(floorplan: Floorplan): void;
  getFloorplan(): Floorplan;
  setTool(tool: ToolType): void;
  getTool(): ToolType;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  togglePreview(enabled?: boolean): boolean;
  isPreview(): boolean;
  setBackground(bg: FloorplanBackground | undefined): void;
  setGridSnapping(enabled: boolean, size?: number): void;
  isGridSnappingEnabled(): boolean;
  getSelectedNodeIds(): string[];
  selectNodes(ids: string[]): void;
  clearSelection(): void;

  // Interactive building creation
  startBuildingCreation(label?: string, mode?: BuildingCreationMode): void;
  cancelBuildingCreation(): void;
  finishBuildingCreation(): Building | null;
  isCreatingBuilding(): boolean;
  getDraftBuildingPoints(): Vec2[];
  getBuildingCreationMode(): BuildingCreationMode;

  // Interactive row / table creation
  startRowCreation(options?: RowCreationOptions): void;
  cancelRowCreation(): void;
  isCreatingRow(): boolean;
  getDraftRowPoints(): Vec2[];

  // Viewport / Zoom & Pan
  zoomIn(factor?: number): void;
  zoomOut(factor?: number): void;
  resetZoom(): void;
  panTo(x: number, y: number): void;
  panBy(dx: number, dy: number): void;
  getScale(): number;

  // Programmatic shape creation with strict validation
  createBuilding(
    points: Vec2[],
    label?: string,
    position?: Vec2
  ): Building | null;
  createRectangleBuilding(
    position: Vec2,
    width: number,
    height: number,
    label?: string
  ): Building | null;
  createZone(
    buildingId: string,
    points: Vec2[],
    fill: string,
    position?: Vec2
  ): Zone | null;
  createRectangleZone(
    buildingId: string,
    position: Vec2,
    width: number,
    height: number,
    fill?: string
  ): Zone | null;
  createRow(
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
  ): Row | null;
  addSeatToRow(
    buildingId: string,
    rowId: string,
    side?: 'a' | 'b'
  ): Seat | null;
  addSeatOnCanvas(buildingId: string, position: Vec2): Row | null;
  moveSeatToRow(
    sourceRowId: string,
    seatId: string,
    targetRowId: string,
    targetSide?: 'a' | 'b'
  ): boolean;

  // Context Actions (Clipboard & Flip)
  copySelection(): boolean;
  cutSelection(): boolean;
  paste(targetBuildingId?: string, offset?: Vec2): boolean;
  canPaste(): boolean;
  flipNode(nodeId: string, direction: 'horizontal' | 'vertical'): boolean;
  duplicateNode(nodeId: string): boolean;

  // Node editing & transformations
  moveNode(nodeId: string, newPosition: Vec2): boolean;
  nudgeNode(nodeId: string, dx: number, dy: number): boolean;
  getNodePosition(nodeId: string): Vec2 | null;
  rotateNode(nodeId: string, newRotation: number): boolean;
  updateNodeLabel(nodeId: string, label: string): boolean;
  reparentRow(
    rowId: string,
    targetBuildingId: string,
    dropWorldPosition?: Vec2
  ): boolean;
  deleteNode(nodeId: string): boolean;

  // Row configuration (goes through canPlace)
  setRowSide(rowId: string, side: 'one' | 'both'): boolean;
  setRowTableWidth(rowId: string, tableWidth: number): boolean;
  setRowSeatSpacing(rowId: string, seatSpacing: number): boolean;
  setRowSeatRadius(rowId: string, seatRadius: number): boolean;
  setRowSeatCount(rowId: string, seatCount: number): boolean;

  // Polygon / Shape Sizing & Properties
  setZoneFill(zoneId: string, fill: string): boolean;
  scaleShape(nodeId: string, scaleX: number, scaleY: number): boolean;
  setShapeDimensions(nodeId: string, width: number, height: number): boolean;

  // Polygon vertex editing for buildings and zones
  moveVertex(
    polygonNodeId: string,
    vertexIndex: number,
    newPosition: Vec2
  ): boolean;
  addVertex(polygonNodeId: string, afterIndex: number, newPoint: Vec2): boolean;
  deleteVertex(polygonNodeId: string, vertexIndex: number): boolean;

  on<K extends keyof EditorEvents>(
    event: K,
    listener: (payload: EditorEvents[K]) => void
  ): () => void;
  off<K extends keyof EditorEvents>(
    event: K,
    listener: (payload: EditorEvents[K]) => void
  ): void;
  destroy(): void;
}
