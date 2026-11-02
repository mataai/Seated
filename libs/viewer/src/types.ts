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
import type {
  StatusChanges,
  StatusConnectionState,
  StatusSource,
  StatusUpdateOptions,
} from './live/status-source';

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
  /** Seat statuses changed (manually or from a live source). */
  statusesChanged: { changes: StatusChanges; replaced: boolean };
  /**
   * Selected seats became unselectable (e.g. booked by someone else) and were
   * removed from the selection. `selectionChanged` is emitted as well.
   */
  selectionInvalidated: {
    seatIds: string[];
    seats: RenderSeatContext[];
    reason: 'status';
  };
  /**
   * Connection state of the live status source. `state` is null when the
   * source is removed (`setStatusSource(null)` or replaced by one that has not
   * reported yet). Re-emitted when the state is unchanged but `error` differs.
   */
  connectionStateChanged: {
    state: StatusConnectionState | null;
    error?: unknown;
  };
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
  /** Render the floorplan's background image. Defaults to true. */
  showBackground?: boolean;
  /**
   * Live status updates for the floorplan, e.g. `socketIoStatusSource(socket)`.
   * Subscribed in a microtask after creation, so listeners added right after
   * `createViewer` receive its first events.
   */
  statusSource?: StatusSource;
}

export interface ViewerInstance {
  load(floorplan: Floorplan): void;
  getFloorplan(): Floorplan | null;
  setStatus(seatId: string, statusKey: string): void;
  /** Merges statuses. A `null` value clears a seat back to the default status. */
  setStatuses(statuses: StatusChanges): void;
  /** Replaces all statuses. Seats not listed get the default status. */
  applyStatusSnapshot(
    statuses: Record<string, string>,
    options?: StatusUpdateOptions
  ): void;
  /**
   * Merges changed statuses. Returns false (and does nothing) when
   * `options.revision` is not newer than the last applied revision.
   */
  applyStatusPatch(
    changes: StatusChanges,
    options?: StatusUpdateOptions
  ): boolean;
  /** Connects a live status source, replacing any previous one. */
  setStatusSource(source: StatusSource | null): void;
  /** Live source state, or null when no source is connected. */
  getConnectionState(): StatusConnectionState | null;
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
