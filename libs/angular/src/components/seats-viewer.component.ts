import type {
  AfterViewInit,
  ElementRef,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import {
  Component,
  EventEmitter,
  Input,
  NgZone,
  Output,
  ViewChild,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import type { Floorplan, Violation } from '@open-seats/core';
import {
  createViewer,
  type RenderSeatContext,
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
  @ViewChild('container', { static: true })
  containerRef!: ElementRef<HTMLDivElement>;

  @Input() floorplan?: Floorplan;
  @Input() statuses?: Record<string, string>;
  @Input() maxSelectable?: number;
  @Input() options?: Partial<ViewerOptions>;

  @Output() ready = new EventEmitter<void>();
  @Output() seatHovered = new EventEmitter<RenderSeatContext>();
  @Output() seatHoverEnded = new EventEmitter<RenderSeatContext>();
  @Output() seatSelected = new EventEmitter<RenderSeatContext>();
  @Output() seatDeselected = new EventEmitter<RenderSeatContext>();
  @Output() selectionChanged = new EventEmitter<{
    selectedSeatIds: string[];
    selectedSeats: RenderSeatContext[];
  }>();
  @Output() floorplanLoaded = new EventEmitter<Floorplan>();
  @Output() violationsUpdated = new EventEmitter<Violation[]>();

  private viewer?: ViewerInstance;
  private ngZone = inject(NgZone);

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.viewer = createViewer(this.containerRef.nativeElement, {
        ...this.options,
        floorplan: this.floorplan,
        statuses: this.statuses,
        maxSelectable: this.maxSelectable,
      });

      this.viewer.on('ready', () => {
        this.ngZone.run(() => this.ready.emit());
      });

      this.viewer.on('seatHovered', (ctx) => {
        this.ngZone.run(() => this.seatHovered.emit(ctx));
      });

      this.viewer.on('seatHoverEnded', (ctx) => {
        this.ngZone.run(() => this.seatHoverEnded.emit(ctx));
      });

      this.viewer.on('seatSelected', (ctx) => {
        this.ngZone.run(() => this.seatSelected.emit(ctx));
      });

      this.viewer.on('seatDeselected', (ctx) => {
        this.ngZone.run(() => this.seatDeselected.emit(ctx));
      });

      this.viewer.on('selectionChanged', (payload) => {
        this.ngZone.run(() => this.selectionChanged.emit(payload));
      });

      this.viewer.on('floorplanLoaded', (plan) => {
        this.ngZone.run(() => this.floorplanLoaded.emit(plan));
      });

      this.viewer.on('violationsUpdated', (violations) => {
        this.ngZone.run(() => this.violationsUpdated.emit(violations));
      });
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    const viewer = this.viewer;
    if (!viewer) return;

    this.ngZone.runOutsideAngular(() => {
      if (changes['floorplan'] && this.floorplan) {
        viewer.load(this.floorplan);
      }

      if (changes['statuses'] && this.statuses) {
        viewer.setStatuses(this.statuses);
      }

      if (changes['maxSelectable']) {
        viewer.setMaxSelectable(this.maxSelectable);
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

  public setStatuses(statuses: Record<string, string>): void {
    this.viewer?.setStatuses(statuses);
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
