import type {
  Building,
  Floorplan,
  Row,
  Seat,
  StatusRegistry,
  Vec2,
} from '@open-seats/core';

export interface RenderSeatContext {
  seat: Seat;
  row: Row;
  building: Building;
}

export interface SelectedStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface HoverStyle {
  stroke?: string;
  strokeWidth?: number;
}

export interface RendererOptions {
  container: HTMLElement;
  floorplan?: Floorplan;
  statusRegistry?: StatusRegistry;
  statuses?: Record<string, string>;
  defaultStatus?: string;
  selectedSeatIds?: string[];
  selectedStyle?: SelectedStyle;
  hoverStyle?: HoverStyle;
  draggableNodes?: boolean;
  onNodeClick?: (
    nodeId: string,
    nodeType: 'row' | 'zone' | 'building',
    evt: MouseEvent | TouchEvent
  ) => void;
  onNodeDragStart?: (
    nodeId: string,
    nodeType: 'row' | 'zone' | 'building'
  ) => void;
  onNodeDragMove?: (
    nodeId: string,
    nodeType: 'row' | 'zone' | 'building',
    pos: Vec2
  ) => void;
  onNodeDragEnd?: (
    nodeId: string,
    nodeType: 'row' | 'zone' | 'building',
    pos: Vec2,
    evt: MouseEvent | TouchEvent
  ) => void;
  onSeatClick?: (ctx: RenderSeatContext, evt: MouseEvent | TouchEvent) => void;
  onSeatHover?: (ctx: RenderSeatContext, evt: MouseEvent) => void;
  onSeatHoverEnd?: (ctx: RenderSeatContext, evt: MouseEvent) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  onStageClick?: (
    pos: Vec2,
    evt: MouseEvent | TouchEvent,
    target?: unknown
  ) => void;
  onStageMouseMove?: (pos: Vec2, evt: MouseEvent) => void;
  onReady?: () => void;
}

export interface Renderer {
  load(floorplan: Floorplan): void;
  getFloorplan(): Floorplan | null;
  setStatus(seatId: string, statusKey: string): void;
  setStatuses(statuses: Record<string, string>): void;
  getStatus(seatId: string): string;
  selectSeats(seatIds: string[]): void;
  deselectSeats(seatIds: string[]): void;
  clearSelection(): void;
  getSelectedSeatIds(): string[];
  setSelectedNodeIds?(ids: string[]): void;
  getSelectedNodeIds?(): string[];
  setHoveredSeat(seatId: string | null): void;
  setDraggableNodes(enabled: boolean): void;
  setStageDraggable(enabled: boolean): void;
  setCursor(cursor: string): void;
  renderDraftPolygon(points: Vec2[], previewPoint?: Vec2 | null): void;
  renderDraftRectangle(
    corner1: Vec2,
    currentCorner: Vec2,
    isInvalid?: boolean
  ): void;
  renderDraftRow?(
    end1: Vec2,
    end2: Vec2,
    options?: {
      seatSpacing?: number;
      seatRadius?: number;
      tableWidth?: number;
      side?: 'one' | 'both';
    },
    isInvalid?: boolean
  ): void;
  clearDraftPolygon(): void;
  getPointerWorldPosition(): Vec2 | null;
  zoomIn(factor?: number): void;
  zoomOut(factor?: number): void;
  resetZoom(): void;
  panTo(x: number, y: number): void;
  panBy(dx: number, dy: number): void;
  getPosition(): Vec2;
  getHoveredSeatId(): string | null;
  getScale(): number;
  destroy(): void;
  getStageElement(): HTMLElement;
}
