import type {
  Building,
  Floorplan,
  Row,
  Seat,
  StatusRegistry,
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
  interactive?: boolean;
  onSeatClick?: (ctx: RenderSeatContext, evt: MouseEvent | TouchEvent) => void;
  onSeatHover?: (ctx: RenderSeatContext, evt: MouseEvent) => void;
  onSeatHoverEnd?: (ctx: RenderSeatContext, evt: MouseEvent) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
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
  setHoveredSeat(seatId: string | null): void;
  zoomIn(factor?: number): void;
  zoomOut(factor?: number): void;
  resetZoom(): void;
  panTo(x: number, y: number): void;
  panBy(dx: number, dy: number): void;
  getPosition(): { x: number; y: number };
  getHoveredSeatId(): string | null;
  getScale(): number;
  destroy(): void;
  getStageElement(): HTMLElement;
}
