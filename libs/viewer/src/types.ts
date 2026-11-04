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
  SeatData,
  SeatDataChanges,
  StatusChanges,
  StatusConnectionState,
  StatusPatchOptions,
  StatusSnapshotOptions,
  StatusSource,
} from './live/status-source';

export type { RenderSeatContext, SelectedStyle, HoverStyle };

export interface TooltipInfo {
  title?: string;
  subtitle?: string;
  content?: string;
  html?: string;
  data?: Record<string, unknown>;
}

/** What a tooltip provider receives: the seat plus its current runtime state. */
export interface TooltipContext extends RenderSeatContext {
  status: string;
  data?: SeatData;
}

export type TooltipProvider = (
  ctx: TooltipContext
) => Promise<TooltipInfo | null>;

/** What a `TooltipRenderer` may return to manage the content it rendered. */
export interface TooltipRenderHandle<C = TooltipContext> {
  /**
   * Called with fresh state when the shown seat's status or data changes, in
   * place of tearing the content down and rendering it again.
   */
  update?: (ctx: C) => void;
  /** Tears the content down (after the tooltip has faded out). */
  destroy?: () => void;
}

/**
 * Renders custom tooltip content (e.g. a framework component) into `host`.
 * The viewer handles the hover delay, positioning and showing/hiding; `host`
 * is unstyled. Return a cleanup function, or a `TooltipRenderHandle`, to tear
 * the content down: it runs once the tooltip has faded out, and before
 * re-rendering when the hovered seat's status or data changes (unless the
 * handle has `update`, which is then called instead).
 */
export type TooltipRenderer = (
  ctx: TooltipContext,
  host: HTMLElement
) => void | (() => void) | TooltipRenderHandle;

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
  /**
   * Runtime seat data changed: via `setSeatData` (`source: 'app'`) or a live
   * status source (`source: 'live'`). `replaced` means every seat of that
   * source was replaced. Read the merged value with `getSeatData`.
   */
  seatDataChanged: {
    changes: SeatDataChanges;
    replaced: boolean;
    source: 'app' | 'live';
  };
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
  /** Initial runtime seat data, by seat id. Not part of the floorplan. */
  seatData?: Record<string, SeatData>;
  statusDefinitions?: SeatStatusDefinition[];
  defaultStatus?: string;
  maxSelectable?: number;
  selectedSeatIds?: string[];
  selectedStyle?: SelectedStyle;
  hoverStyle?: HoverStyle;
  tooltipProvider?: TooltipProvider;
  /** Custom tooltip content; takes precedence over `tooltipProvider`. */
  tooltipRenderer?: TooltipRenderer;
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
    options?: StatusSnapshotOptions
  ): void;
  /**
   * Merges changed statuses. Returns false (and does nothing) when
   * `options.revision` is not newer than the last applied revision.
   */
  applyStatusPatch(
    changes: StatusChanges,
    options?: StatusPatchOptions
  ): boolean;
  /**
   * Sets runtime data for seats. A `null` value removes a seat's data. With
   * `replace`, seats not listed lose their data. Never saved in the floorplan.
   */
  setSeatData(data: SeatDataChanges, options?: { replace?: boolean }): void;
  /**
   * The seat's data: live data from the status source merged with app data
   * from `setSeatData` (app fields win).
   */
  getSeatData(seatId: string): SeatData | undefined;
  /**
   * Drops cached tooltips (for the given seats, or all) so the provider is
   * called again, e.g. after prices change. Status changes do this already.
   */
  refreshTooltips(seatIds?: string[]): void;
  /**
   * Replaces the custom tooltip renderer; `null` goes back to
   * `tooltipProvider` (or no tooltip).
   */
  setTooltipRenderer(renderer: TooltipRenderer | null): void;
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
