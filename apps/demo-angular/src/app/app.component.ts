import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  InjectionToken,
  inject,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  SeatsEditorComponent,
  SeatsViewerComponent,
} from '@open-seats/angular';
import {
  cloneFloorplan,
  SAMPLE_FLOORPLAN,
  type Floorplan,
  type Violation,
} from '@open-seats/core';
import type { ToolType } from '@open-seats/editor';
import {
  socketIoStatusSource,
  type RenderSeatContext,
  type StatusConnectionState,
  type StatusSource,
  type ViewerEvents,
} from '@open-seats/viewer';
import { io, type Socket } from 'socket.io-client';

/** Live seat server (`npm run start:live-server`). Null disables live mode. */
export const LIVE_SERVER_URL = new InjectionToken<string | null>(
  'LIVE_SERVER_URL',
  { factory: () => 'http://localhost:3030' }
);
const LIVE_FLOORPLAN_ID = 'demo';

@Component({
  standalone: true,
  selector: 'open-seats-root',
  imports: [CommonModule, SeatsViewerComponent, SeatsEditorComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private liveServerUrl = inject(LIVE_SERVER_URL);
  private socket?: Socket;

  /** Passed to the viewer; null while live mode is off. */
  public statusSource: StatusSource | null = null;
  public liveState: StatusConnectionState | null = null;

  /** Mirror of the viewer's statuses, kept in sync via `statusesChanged`. */
  private seatStatuses: Record<string, string> = {};
  /** Seats per status; selected seats are counted under "selected" only. */
  public statusCounts: Record<string, number> = {};

  constructor() {
    this.seatStatuses = { ...this.statuses };
    this.recountStatuses();
    this.setLive(true);
  }

  public onStatusesChanged({
    changes,
    replaced,
  }: ViewerEvents['statusesChanged']): void {
    const next = replaced ? {} : { ...this.seatStatuses };
    for (const [seatId, status] of Object.entries(changes)) {
      if (status === null) delete next[seatId];
      else next[seatId] = status;
    }
    this.seatStatuses = next;
    this.recountStatuses();
  }

  private recountStatuses(): void {
    const selected = new Set(this.selectedSeatIds);
    const counts: Record<string, number> = {
      available: 0,
      reserved: 0,
      locked: 0,
    };
    for (const building of this.floorplan.buildings) {
      for (const row of building.rows) {
        for (const seat of row.seats) {
          if (selected.has(seat.id)) continue;
          const status = this.seatStatuses[seat.id] ?? 'available';
          counts[status] = (counts[status] ?? 0) + 1;
        }
      }
    }
    this.statusCounts = counts;
    this.cdr.markForCheck();
  }

  public get liveEnabled(): boolean {
    return this.statusSource !== null;
  }

  public get liveAvailable(): boolean {
    return this.liveServerUrl !== null;
  }

  public setLive(enabled: boolean): void {
    if (enabled && this.liveServerUrl && !this.socket) {
      this.socket = io(this.liveServerUrl, {
        auth: { floorplanId: LIVE_FLOORPLAN_ID },
      });
      this.statusSource = socketIoStatusSource(this.socket);
      this.addLog('live', `Connecting to ${this.liveServerUrl}`);
    } else if (!enabled && this.socket) {
      this.statusSource = null;
      this.socket.disconnect();
      this.socket = undefined;
      this.liveState = null;
      this.addLog('live', 'Live updates off');
    }
    this.cdr.markForCheck();
  }

  public onConnectionStateChanged({
    state,
    error,
  }: ViewerEvents['connectionStateChanged']): void {
    this.liveState = state;
    const reason = error instanceof Error ? ` (${error.message})` : '';
    this.addLog('live', `${state}${reason}`);
  }

  public onSelectionInvalidated({
    seats,
  }: ViewerEvents['selectionInvalidated']): void {
    const labels = seats.map((s) => s.seat.label).join(', ');
    this.addLog('taken', `${labels} just became unavailable`);
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
  }

  readonly viewerComp = viewChild(SeatsViewerComponent);
  readonly editorComp = viewChild(SeatsEditorComponent);

  public floorplan: Floorplan = cloneFloorplan(SAMPLE_FLOORPLAN);
  public mode: 'viewer' | 'editor' = 'viewer';
  public currentTool: ToolType = 'select';

  public setTool(tool: ToolType): void {
    this.currentTool = tool;
    this.editorComp()?.setTool(tool);
    this.cdr.markForCheck();
  }

  public statuses: Record<string, string> = {
    's-a-1a': 'reserved',
    's-a-1b': 'reserved',
    's-a-2a': 'locked',
    's-b-5a': 'reserved',
    's-b-5b': 'reserved',
    's-c-8a': 'reserved',
  };

  private logIdCounter = 0;
  public selectedSeatIds: string[] = [];
  public selectedSeatLabels: string[] = [];
  public eventLog: {
    id: number;
    time: string;
    name: string;
    detail: string;
  }[] = [];

  public setMode(newMode: 'viewer' | 'editor'): void {
    if (this.mode === newMode) return;

    const editorComp = this.editorComp();
    if (this.mode === 'editor' && editorComp) {
      const updated = editorComp.getFloorplan();
      if (updated) this.floorplan = updated;
    }

    this.mode = newMode;
    this.addLog('mode', `Switched to ${newMode} mode`);
    this.cdr.markForCheck();
  }

  public zoomIn(): void {
    if (this.mode === 'viewer') {
      this.viewerComp()?.zoomIn(1.2);
    } else {
      this.editorComp()?.zoomIn(1.2);
    }
  }

  public zoomOut(): void {
    if (this.mode === 'viewer') {
      this.viewerComp()?.zoomOut(1.2);
    } else {
      this.editorComp()?.zoomOut(1.2);
    }
  }

  public resetZoom(): void {
    if (this.mode === 'viewer') {
      this.viewerComp()?.resetZoom();
    } else {
      this.editorComp()?.resetZoom();
    }
  }

  public onFloorplanChanged(plan: Floorplan): void {
    this.floorplan = plan;
    this.recountStatuses();
    this.addLog('editor', 'Floorplan modified');
    this.cdr.markForCheck();
  }

  public onEditorSelectionChanged(ids: string[]): void {
    if (ids.length > 0) {
      this.addLog('selection', `Selected node: ${ids[0]}`);
    }
  }

  public onViolationsUpdated(violations: Violation[]): void {
    if (violations.length > 0) {
      const summary = violations
        .map((v) => `${v.rule} (${v.ids.join(', ')})`)
        .join('; ');
      this.addLog('violation', summary);
    }
  }

  // -----------------------------------------------------------
  // Viewer events & Export
  // -----------------------------------------------------------
  public onSelectionChanged(payload: {
    selectedSeatIds: string[];
    selectedSeats: RenderSeatContext[];
  }): void {
    this.selectedSeatIds = payload.selectedSeatIds;
    this.selectedSeatLabels = payload.selectedSeats.map((s) => s.seat.label);
    this.recountStatuses();
    this.addLog('selection', `${this.selectedSeatIds.length} seat(s) selected`);
    this.cdr.markForCheck();
  }

  public onSeatSelected(ctx: RenderSeatContext): void {
    this.addLog('seatSelected', ctx.seat.label);
    this.cdr.markForCheck();
  }

  public onSeatDeselected(ctx: RenderSeatContext): void {
    this.addLog('seatDeselected', ctx.seat.label);
    this.cdr.markForCheck();
  }

  public onSeatHovered(ctx: RenderSeatContext): void {
    this.addLog('hover', `${ctx.seat.label} (${ctx.row.label})`);
    this.cdr.markForCheck();
  }

  public reserveSelected(): void {
    if (this.liveState === 'live') {
      void this.reserveOnServer([...this.selectedSeatIds]);
      return;
    }
    const viewerComp = this.viewerComp();
    if (viewerComp) {
      const updateMap: Record<string, string> = { ...this.statuses };
      for (const id of this.selectedSeatIds) {
        updateMap[id] = 'reserved';
      }
      this.statuses = updateMap;
      viewerComp.clearSelection();
      this.addLog(
        'reserved',
        `Reserved ${this.selectedSeatIds.length} seat(s)`
      );
      this.cdr.markForCheck();
    }
  }

  /**
   * In a real app this is your booking API. The reference server broadcasts
   * the change to every connected viewer, including this one.
   */
  private async reserveOnServer(seatIds: string[]): Promise<void> {
    const changes = Object.fromEntries(seatIds.map((id) => [id, 'reserved']));
    try {
      const res = await fetch(
        `${this.liveServerUrl}/floorplans/${LIVE_FLOORPLAN_ID}/seats`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ changes }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.addLog('reserved', `Reserved ${seatIds.length} seat(s) on server`);
    } catch (e) {
      this.addLog('error', `Reservation failed: ${(e as Error).message}`);
    }
  }

  public clearSelection(): void {
    this.viewerComp()?.clearSelection();
    this.cdr.markForCheck();
  }

  public exportJson(): void {
    const plan =
      this.mode === 'viewer'
        ? this.floorplan
        : this.editorComp()?.getFloorplan() || this.floorplan;
    const jsonStr = JSON.stringify(plan, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = blobUrl;
    downloadAnchor.download = 'floorplan.json';
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(blobUrl);
    this.addLog('export', 'Floorplan exported as JSON');
  }

  public addLog(name: string, detail: string): void {
    const time = new Date().toLocaleTimeString().split(' ')[0];
    const id = ++this.logIdCounter;
    this.eventLog.unshift({ id, time, name, detail });
    if (this.eventLog.length > 25) {
      this.eventLog.pop();
    }
    this.cdr.markForCheck();
  }
}
