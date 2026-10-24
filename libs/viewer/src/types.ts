import type {
  Floorplan,
  SeatStatusDefinition,
  Violation,
} from '@open-seats/core';
import type {
  HoverStyle,
  RenderSeatContext,
  SelectedStyle,
} from '@open-seats/renderer';

export type { RenderSeatContext, SelectedStyle, HoverStyle };

export interface TooltipInfo {
  title?: string;
  subtitle?: string;
  content?: string;
  html?: string;
  data?: Record<string, unknown>;
}

export type TooltipProvider = (
  ctx: RenderSeatContext
) => Promise<TooltipInfo | null>;

export interface ViewerEvents {
  ready: void;
  seatHovered: RenderSeatContext;
  seatHoverEnded: RenderSeatContext;
  seatSelected: RenderSeatContext;
  seatDeselected: RenderSeatContext;
  selectionChanged: {
    selectedSeatIds: string[];
    selectedSeats: RenderSeatContext[];
  };
  floorplanLoaded: Floorplan;
  violationsUpdated: Violation[];
}

export interface ViewerOptions {
  floorplan?: Floorplan;
  statuses?: Record<string, string>;
  statusDefinitions?: SeatStatusDefinition[];
  defaultStatus?: string;
  maxSelectable?: number;
  selectedSeatIds?: string[];
  selectedStyle?: SelectedStyle;
  hoverStyle?: HoverStyle;
  tooltipProvider?: TooltipProvider;
  tooltipDebounceMs?: number;
  tolerance?: number;
  ariaLabel?: string;
  enableKeyboardNavigation?: boolean;
}

export interface ViewerInstance {
  load(floorplan: Floorplan): void;
  getFloorplan(): Floorplan | null;
  setStatus(seatId: string, statusKey: string): void;
  setStatuses(statuses: Record<string, string>): void;
  getStatus(seatId: string): string;
  selectSeats(seatIds: string[]): void;
  deselectSeats(seatIds: string[]): void;
  clearSelection(): void;
  getSelectedSeatIds(): string[];
  getSelectedSeats(): RenderSeatContext[];
  setMaxSelectable(max: number | undefined): void;
  getMaxSelectable(): number | undefined;
  zoomIn(factor?: number): void;
  zoomOut(factor?: number): void;
  resetZoom(): void;
  panTo(x: number, y: number): void;
  panBy(dx: number, dy: number): void;
  getScale(): number;
  readonly violations: Violation[];
  on<K extends keyof ViewerEvents>(
    event: K,
    listener: (payload: ViewerEvents[K]) => void
  ): () => void;
  off<K extends keyof ViewerEvents>(
    event: K,
    listener: (payload: ViewerEvents[K]) => void
  ): void;
  destroy(): void;
}
