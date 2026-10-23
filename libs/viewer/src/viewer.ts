import {
  seatPosition,
  StatusRegistry,
  transformPoint,
  TypedEventEmitter,
  validateLayout,
  type Floorplan,
  type Violation,
} from '@open-seats/core';
import {
  createRenderer,
  type Renderer,
  type RenderSeatContext,
} from '@open-seats/renderer';
import { TooltipManager } from './tooltip';
import type {
  ViewerEvents,
  ViewerInstance,
  ViewerOptions,
} from './types';

export class Viewer implements ViewerInstance {
  private container: HTMLElement;
  private options: ViewerOptions;
  private renderer: Renderer;
  private emitter = new TypedEventEmitter<ViewerEvents>();
  private statusRegistry: StatusRegistry;
  private tooltipManager: TooltipManager;

  private _violations: Violation[] = [];
  private seatContextMap = new Map<string, RenderSeatContext>();
  private maxSelectable?: number;
  private enableKeyboardNavigation: boolean;
  private liveRegion: HTMLDivElement;

  constructor(container: HTMLElement, options: ViewerOptions = {}) {
    this.container = container;
    this.options = options;
    this.maxSelectable = options.maxSelectable;
    this.enableKeyboardNavigation = options.enableKeyboardNavigation ?? true;

    // Accessibility attributes
    this.container.setAttribute('role', 'application');
    this.container.setAttribute(
      'aria-label',
      options.ariaLabel ?? 'Interactive Floorplan Seat Selection'
    );
    if (!this.container.hasAttribute('tabindex')) {
      this.container.tabIndex = 0;
    }

    this.statusRegistry = new StatusRegistry(
      options.statusDefinitions,
      options.defaultStatus
    );

    this.tooltipManager = new TooltipManager(
      this.container,
      options.tooltipProvider,
      options.tooltipDebounceMs
    );

    this.renderer = createRenderer({
      container: this.container,
      statusRegistry: this.statusRegistry,
      statuses: options.statuses,
      defaultStatus: options.defaultStatus,
      selectedSeatIds: options.selectedSeatIds,
      selectedStyle: options.selectedStyle,
      hoverStyle: options.hoverStyle,
      onReady: () => {
        this.emitter.emit('ready', undefined);
      },
      onSeatHover: (ctx, evt) => {
        this.emitter.emit('seatHovered', ctx);
        this.tooltipManager.show(ctx, evt);
      },
      onSeatHoverEnd: (ctx) => {
        this.emitter.emit('seatHoverEnded', ctx);
        this.tooltipManager.hide();
      },
      onSeatClick: (ctx) => {
        this.handleSeatClick(ctx);
      },
    });

    // ARIA Live region for screen readers
    this.liveRegion = document.createElement('div');
    this.liveRegion.className = 'open-seats-sr-only';
    this.liveRegion.setAttribute('role', 'status');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    Object.assign(this.liveRegion.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0',
    });
    this.container.appendChild(this.liveRegion);

    if (this.enableKeyboardNavigation) {
      this.container.addEventListener('keydown', this.onKeyDown);
    }

    if (options.floorplan) {
      this.load(options.floorplan);
    }
  }

  private announce(message: string): void {
    this.liveRegion.textContent = '';
    setTimeout(() => {
      this.liveRegion.textContent = message;
    }, 50);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enableKeyboardNavigation) return;

    // Shift + Arrow keys -> Pan view
    if (
      e.shiftKey &&
      (e.key === 'ArrowRight' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown')
    ) {
      e.preventDefault();
      const panStep = 50;
      if (e.key === 'ArrowRight') this.renderer.panBy(-panStep, 0);
      else if (e.key === 'ArrowLeft') this.renderer.panBy(panStep, 0);
      else if (e.key === 'ArrowUp') this.renderer.panBy(0, panStep);
      else if (e.key === 'ArrowDown') this.renderer.panBy(0, -panStep);
      return;
    }

    if (
      e.key === 'ArrowRight' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown'
    ) {
      e.preventDefault();
      this.navigateSeatDirection(e.key);
      return;
    }

    if (e.key === 'Tab') {
      const seatIds = Array.from(this.seatContextMap.keys());
      if (seatIds.length > 0) {
        e.preventDefault();
        const currentId = this.renderer.getHoveredSeatId();
        let nextIndex = 0;
        if (currentId) {
          const idx = seatIds.indexOf(currentId);
          nextIndex = e.shiftKey
            ? (idx - 1 + seatIds.length) % seatIds.length
            : (idx + 1) % seatIds.length;
        }
        this.focusSeat(seatIds[nextIndex]);
      }
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const currentId = this.renderer.getHoveredSeatId();
      if (currentId) {
        const ctx = this.seatContextMap.get(currentId);
        if (ctx) {
          this.handleSeatClick(ctx);
        }
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      this.clearSelection();
      this.renderer.setHoveredSeat(null);
      this.announce('Selection cleared');
      return;
    }

    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      this.zoomIn();
      this.announce('Zoomed in');
      return;
    }

    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      this.zoomOut();
      this.announce('Zoomed out');
      return;
    }

    if (e.key === '0') {
      e.preventDefault();
      this.resetZoom();
      this.announce('Zoom reset');
      return;
    }
  };

  private cachedSeatWorldPositions?: Map<string, { x: number; y: number }>;

  private getSeatWorldPositions(): Map<string, { x: number; y: number }> {
    if (this.cachedSeatWorldPositions) {
      return this.cachedSeatWorldPositions;
    }
    const map = new Map<string, { x: number; y: number }>();
    for (const [id, ctx] of this.seatContextMap.entries()) {
      const local = seatPosition(ctx.row, ctx.seat);
      const inBuilding = transformPoint(
        local,
        ctx.row.position,
        ctx.row.rotation
      );
      const world = transformPoint(
        inBuilding,
        ctx.building.position,
        ctx.building.rotation
      );
      map.set(id, world);
    }
    this.cachedSeatWorldPositions = map;
    return map;
  }

  private navigateSeatDirection(
    direction: 'ArrowRight' | 'ArrowLeft' | 'ArrowUp' | 'ArrowDown'
  ): void {
    const seatIds = Array.from(this.seatContextMap.keys());
    if (seatIds.length === 0) return;

    const currentId = this.renderer.getHoveredSeatId();
    if (!currentId) {
      this.focusSeat(seatIds[0]);
      return;
    }

    const worldPositions = this.getSeatWorldPositions();
    const currentPos = worldPositions.get(currentId);
    if (!currentPos) {
      this.focusSeat(seatIds[0]);
      return;
    }

    let bestId: string | null = null;
    let bestScore = Infinity;

    for (const [id, pos] of worldPositions.entries()) {
      if (id === currentId) continue;
      const dx = pos.x - currentPos.x;
      const dy = pos.y - currentPos.y;

      let validDirection = false;
      let score = Infinity;

      if (direction === 'ArrowRight' && dx > 1) {
        validDirection = true;
        score = Math.hypot(dx, dy * 2.5);
      } else if (direction === 'ArrowLeft' && dx < -1) {
        validDirection = true;
        score = Math.hypot(-dx, dy * 2.5);
      } else if (direction === 'ArrowDown' && dy > 1) {
        validDirection = true;
        score = Math.hypot(dx * 2.5, dy);
      } else if (direction === 'ArrowUp' && dy < -1) {
        validDirection = true;
        score = Math.hypot(dx * 2.5, -dy);
      }

      if (validDirection && score < bestScore) {
        bestScore = score;
        bestId = id;
      }
    }

    if (bestId) {
      this.focusSeat(bestId);
    }
  }

  private focusSeat(seatId: string): void {
    const ctx = this.seatContextMap.get(seatId);
    if (!ctx) return;

    this.renderer.setHoveredSeat(seatId);
    this.emitter.emit('seatHovered', ctx);

    const status = this.getStatus(seatId);
    const isSelected = this.renderer.getSelectedSeatIds().includes(seatId);
    this.announce(
      `Seat ${ctx.seat.label}, Row ${ctx.row.label}, Building ${ctx.building.label}. Status: ${status}. ${
        isSelected ? 'Selected.' : ''
      }`
    );
  }

  private handleSeatClick(ctx: RenderSeatContext): void {
    const seatId = ctx.seat.id;
    const isSelected = this.renderer.getSelectedSeatIds().includes(seatId);

    if (isSelected) {
      this.deselectSeats([seatId]);
      this.emitter.emit('seatDeselected', ctx);
    } else {
      const currentSelected = this.renderer.getSelectedSeatIds();

      if (this.maxSelectable === 1) {
        // Auto-deselect previous
        if (currentSelected.length > 0) {
          const prevId = currentSelected[0];
          const prevCtx = this.seatContextMap.get(prevId);
          this.deselectSeats([prevId]);
          if (prevCtx) {
            this.emitter.emit('seatDeselected', prevCtx);
          }
        }
        this.selectSeats([seatId]);
        this.emitter.emit('seatSelected', ctx);
      } else if (
        this.maxSelectable !== undefined &&
        currentSelected.length >= this.maxSelectable
      ) {
        // Max limit reached, cannot select more
        return;
      } else {
        this.selectSeats([seatId]);
        this.emitter.emit('seatSelected', ctx);
      }
    }

    this.emitSelectionChanged();
  }

  private emitSelectionChanged(): void {
    const ids = this.renderer.getSelectedSeatIds();
    const seats = ids
      .map((id) => this.seatContextMap.get(id))
      .filter((c): c is RenderSeatContext => c !== undefined);

    this.emitter.emit('selectionChanged', {
      selectedSeatIds: ids,
      selectedSeats: seats,
    });
  }

  public load(floorplan: Floorplan): void {
    this.seatContextMap.clear();
    this.cachedSeatWorldPositions = undefined;

    // Cache contexts
    for (const building of floorplan.buildings ?? []) {
      for (const row of building.rows ?? []) {
        for (const seat of row.seats ?? []) {
          this.seatContextMap.set(seat.id, { seat, row, building });
        }
      }
    }

    // Lenient validation: record violations, do not throw
    this._violations = validateLayout(floorplan, {
      tolerance: this.options.tolerance,
    });

    this.renderer.load(floorplan);
    this.emitter.emit('violationsUpdated', this._violations);
    this.emitter.emit('floorplanLoaded', floorplan);
  }

  public getFloorplan(): Floorplan | null {
    return this.renderer.getFloorplan();
  }

  public get violations(): Violation[] {
    return [...this._violations];
  }

  public setStatus(seatId: string, statusKey: string): void {
    this.renderer.setStatus(seatId, statusKey);
  }

  public setStatuses(statuses: Record<string, string>): void {
    this.renderer.setStatuses(statuses);
  }

  public getStatus(seatId: string): string {
    return this.renderer.getStatus(seatId);
  }

  public selectSeats(seatIds: string[]): void {
    this.renderer.selectSeats(seatIds);
    this.emitSelectionChanged();
  }

  public deselectSeats(seatIds: string[]): void {
    this.renderer.deselectSeats(seatIds);
    this.emitSelectionChanged();
  }

  public clearSelection(): void {
    this.renderer.clearSelection();
    this.emitSelectionChanged();
  }

  public getSelectedSeatIds(): string[] {
    return this.renderer.getSelectedSeatIds();
  }

  public getSelectedSeats(): RenderSeatContext[] {
    return this.getSelectedSeatIds()
      .map((id) => this.seatContextMap.get(id))
      .filter((c): c is RenderSeatContext => c !== undefined);
  }

  public setMaxSelectable(max: number | undefined): void {
    this.maxSelectable = max;
  }

  public getMaxSelectable(): number | undefined {
    return this.maxSelectable;
  }

  public zoomIn(factor?: number): void {
    this.renderer.zoomIn(factor);
  }

  public zoomOut(factor?: number): void {
    this.renderer.zoomOut(factor);
  }

  public resetZoom(): void {
    this.renderer.resetZoom();
  }

  public panTo(x: number, y: number): void {
    this.renderer.panTo(x, y);
  }

  public panBy(dx: number, dy: number): void {
    this.renderer.panBy(dx, dy);
  }

  public getScale(): number {
    return this.renderer.getScale();
  }

  public on<K extends keyof ViewerEvents>(
    event: K,
    listener: (payload: ViewerEvents[K]) => void
  ): () => void {
    return this.emitter.on(event, listener);
  }

  public off<K extends keyof ViewerEvents>(
    event: K,
    listener: (payload: ViewerEvents[K]) => void
  ): void {
    this.emitter.off(event, listener);
  }

  public destroy(): void {
    if (this.enableKeyboardNavigation) {
      this.container.removeEventListener('keydown', this.onKeyDown);
    }
    this.liveRegion.remove();
    this.tooltipManager.destroy();
    this.renderer.destroy();
    this.emitter.removeAllListeners();
    this.seatContextMap.clear();
    this.cachedSeatWorldPositions = undefined;
  }
}

export function createViewer(
  container: HTMLElement,
  options?: ViewerOptions
): ViewerInstance {
  return new Viewer(container, options);
}
