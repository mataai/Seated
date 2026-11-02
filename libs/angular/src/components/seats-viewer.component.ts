import type {
  AfterViewInit,
  ElementRef,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import {
  Component,
  NgZone,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { Floorplan, Violation } from '@open-seats/core';
import {
  createViewer,
  type RenderSeatContext,
  type StatusChanges,
  type StatusConnectionState,
  type StatusSource,
  type ViewerEvents,
  type ViewerInstance,
  type ViewerOptions,
} from '@open-seats/viewer';

@Component({
  selector: 'seats-viewer',
  standalone: true,
  template: `
    <div
      #container
      class="seats-viewer-container"
      style="width: 100%; height: 100%; position: relative; overflow: hidden;"
    ></div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class SeatsViewerComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  readonly containerRef =
    viewChild.required<ElementRef<HTMLDivElement>>('container');

  readonly floorplan = input<Floorplan>();
  readonly statuses = input<Record<string, string>>();
  readonly maxSelectable = input<number>();
  readonly options = input<Partial<ViewerOptions>>();
  /**
   * Live status updates, e.g. `socketIoStatusSource(socket)`. Takes precedence
   * over `options.statusSource`: once this input has been given a value
   * (including null to disconnect), `options.statusSource` is never used, so a
   * custom source is never silently swapped for another one.
   */
  readonly statusSource = input<StatusSource | null>();

  readonly ready = output<void>();
  readonly seatHovered = output<RenderSeatContext>();
  readonly seatHoverEnded = output<RenderSeatContext>();
  readonly seatSelected = output<RenderSeatContext>();
  readonly seatDeselected = output<RenderSeatContext>();
  readonly selectionChanged = output<{
    selectedSeatIds: string[];
    selectedSeats: RenderSeatContext[];
  }>();
  readonly floorplanLoaded = output<Floorplan>();
  readonly violationsUpdated = output<Violation[]>();
  readonly statusesChanged = output<ViewerEvents['statusesChanged']>();
  readonly selectionInvalidated =
    output<ViewerEvents['selectionInvalidated']>();
  readonly connectionStateChanged =
    output<ViewerEvents['connectionStateChanged']>();

  private viewer?: ViewerInstance;
  private ngZone = inject(NgZone);
  /** Source currently given to the viewer (unwrapped), to skip no-op updates. */
  private appliedStatusSource: StatusSource | null = null;
  /** Set once the `statusSource` input is given a value; see its docs. */
  private statusSourceInputUsed = false;
  /** Output emits collected during one live update, flushed in one zone run. */
  private pendingEmits: (() => void)[] | null = null;

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      const statusSource = this.resolveStatusSource();
      this.appliedStatusSource = statusSource;
      this.viewer = createViewer(this.containerRef().nativeElement, {
        ...this.options(),
        floorplan: this.floorplan(),
        statuses: this.statuses(),
        maxSelectable: this.maxSelectable(),
        statusSource: statusSource
          ? this.batchStatusSource(statusSource)
          : undefined,
      });

      const viewer = this.viewer;
      viewer.on('ready', () => this.emit(() => this.ready.emit()));
      viewer.on('seatHovered', (ctx) =>
        this.emit(() => this.seatHovered.emit(ctx))
      );
      viewer.on('seatHoverEnded', (ctx) =>
        this.emit(() => this.seatHoverEnded.emit(ctx))
      );
      viewer.on('seatSelected', (ctx) =>
        this.emit(() => this.seatSelected.emit(ctx))
      );
      viewer.on('seatDeselected', (ctx) =>
        this.emit(() => this.seatDeselected.emit(ctx))
      );
      viewer.on('selectionChanged', (payload) =>
        this.emit(() => this.selectionChanged.emit(payload))
      );
      viewer.on('floorplanLoaded', (plan) =>
        this.emit(() => this.floorplanLoaded.emit(plan))
      );
      viewer.on('violationsUpdated', (violations) =>
        this.emit(() => this.violationsUpdated.emit(violations))
      );
      viewer.on('statusesChanged', (payload) =>
        this.emit(() => this.statusesChanged.emit(payload))
      );
      viewer.on('selectionInvalidated', (payload) =>
        this.emit(() => this.selectionInvalidated.emit(payload))
      );
      viewer.on('connectionStateChanged', (payload) =>
        this.emit(() => this.connectionStateChanged.emit(payload))
      );
    });
  }

  /**
   * Emits an output inside the Angular zone. During a live update the emits
   * are collected and flushed together, so one update costs one zone entry.
   */
  private emit(fn: () => void): void {
    if (this.pendingEmits) {
      this.pendingEmits.push(fn);
    } else if (NgZone.isInAngularZone()) {
      fn();
    } else {
      this.ngZone.run(fn);
    }
  }

  /** Runs `fn` outside Angular, then flushes the outputs it emitted at once. */
  private batched(fn: () => void): void {
    if (this.pendingEmits) {
      fn();
      return;
    }
    const emits: (() => void)[] = [];
    this.pendingEmits = emits;
    try {
      this.ngZone.runOutsideAngular(fn);
    } finally {
      this.pendingEmits = null;
    }
    if (emits.length === 0) return;
    const flush = () => emits.forEach((emit) => emit());
    if (NgZone.isInAngularZone()) {
      flush();
    } else {
      this.ngZone.run(flush);
    }
  }

  private batchStatusSource(source: StatusSource): StatusSource {
    return {
      subscribe: (sink) =>
        source.subscribe({
          snapshot: (statuses, revision) =>
            this.batched(() => sink.snapshot(statuses, revision)),
          patch: (changes, revision) =>
            this.batched(() => sink.patch(changes, revision)),
          connectionState: (state, error) =>
            this.batched(() => sink.connectionState(state, error)),
        }),
    };
  }

  /**
   * The `statusSource` input wins once it has been given a value; until then
   * `options.statusSource` is used.
   */
  private resolveStatusSource(): StatusSource | null {
    const input = this.statusSource();
    if (input !== undefined) this.statusSourceInputUsed = true;
    if (this.statusSourceInputUsed) return input ?? null;
    return this.options()?.statusSource ?? null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    const viewer = this.viewer;
    if (!viewer) return;

    this.ngZone.runOutsideAngular(() => {
      const floorplan = this.floorplan();
      if (changes['floorplan'] && floorplan) {
        viewer.load(floorplan);
      }

      const statuses = this.statuses();
      if (changes['statuses'] && statuses) {
        viewer.setStatuses(statuses);
      }

      if (changes['statusSource'] || changes['options']) {
        const source = this.resolveStatusSource();
        if (source !== this.appliedStatusSource) {
          this.appliedStatusSource = source;
          viewer.setStatusSource(
            source ? this.batchStatusSource(source) : null
          );
        }
      }

      if (changes['maxSelectable']) {
        viewer.setMaxSelectable(this.maxSelectable());
      }
    });
  }

  public selectSeats(seatIds: string[]): void {
    this.viewer?.selectSeats(seatIds);
  }

  public deselectSeats(seatIds: string[]): void {
    this.viewer?.deselectSeats(seatIds);
  }

  public clearSelection(): void {
    this.viewer?.clearSelection();
  }

  public setStatus(seatId: string, statusKey: string): void {
    this.viewer?.setStatus(seatId, statusKey);
  }

  public setStatuses(statuses: StatusChanges): void {
    this.viewer?.setStatuses(statuses);
  }

  public getConnectionState(): StatusConnectionState | null {
    return this.viewer?.getConnectionState() ?? null;
  }

  public getStatus(seatId: string): string | undefined {
    return this.viewer?.getStatus(seatId);
  }

  public getSelectedSeatIds(): string[] {
    return this.viewer?.getSelectedSeatIds() ?? [];
  }

  public getSelectedSeats(): RenderSeatContext[] {
    return this.viewer?.getSelectedSeats() ?? [];
  }

  public zoomIn(factor?: number): void {
    this.viewer?.zoomIn(factor);
  }

  public zoomOut(factor?: number): void {
    this.viewer?.zoomOut(factor);
  }

  public resetZoom(): void {
    this.viewer?.resetZoom();
  }

  public panTo(x: number, y: number): void {
    this.viewer?.panTo(x, y);
  }

  public panBy(dx: number, dy: number): void {
    this.viewer?.panBy(dx, dy);
  }

  public get violations(): Violation[] {
    return this.viewer?.violations ?? [];
  }

  ngOnDestroy(): void {
    this.viewer?.destroy();
  }
}
