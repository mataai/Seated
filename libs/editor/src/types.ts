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
  | 'select'
  | 'pan'
  | 'building'
  | 'row'
  | 'zone'
  | 'add-seat';

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

export interface EditorEvents {
  change: Floorplan;
  toolChange: ToolType;
  selectionChange: string[];
  previewToggle: boolean;
  violationsUpdated: Violation[];
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

  // Programmatic shape creation with strict validation
  createBuilding(points: Vec2[], label?: string, position?: Vec2): Building | null;
  createZone(buildingId: string, points: Vec2[], fill: string, position?: Vec2): Zone | null;
  createRow(
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
  ): Row | null;
  addSeatToRow(buildingId: string, rowId: string, side?: 'a' | 'b'): Seat | null;
  addSeatOnCanvas(buildingId: string, position: Vec2): Row | null;
  moveSeatToRow(
    sourceRowId: string,
    seatId: string,
    targetRowId: string,
    targetSide?: 'a' | 'b'
  ): boolean;

  // Node editing & transformations
  moveNode(nodeId: string, newPosition: Vec2): boolean;
  rotateNode(nodeId: string, newRotation: number): boolean;
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

  // Polygon vertex editing for buildings and zones
  moveVertex(polygonNodeId: string, vertexIndex: number, newPosition: Vec2): boolean;
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
