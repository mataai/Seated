import {
  Component,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  SeatsEditorComponent,
  SeatsViewerComponent,
} from '@open-seats/angular';
import {
  SAMPLE_FLOORPLAN,
  type Floorplan,
  type Violation,
} from '@open-seats/core';
import type { ToolType } from '@open-seats/editor';
import type { RenderSeatContext } from '@open-seats/viewer';

@Component({
  standalone: true,
  selector: 'open-seats-root',
  imports: [CommonModule, SeatsViewerComponent, SeatsEditorComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  private cdr = inject(ChangeDetectorRef);

  @ViewChild(SeatsViewerComponent) viewerComp?: SeatsViewerComponent;
  @ViewChild(SeatsEditorComponent) editorComp?: SeatsEditorComponent;

  public floorplan: Floorplan = structuredClone(SAMPLE_FLOORPLAN);
  public mode: 'viewer' | 'editor' = 'viewer';
  public currentTool: ToolType = 'select';

  public setTool(tool: ToolType): void {
    this.currentTool = tool;
    this.editorComp?.setTool(tool);
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

    if (this.mode === 'editor' && this.editorComp) {
      const updated = this.editorComp.getFloorplan();
      if (updated) this.floorplan = updated;
    }

    this.mode = newMode;
    this.addLog('mode', `Switched to ${newMode} mode`);
    this.cdr.markForCheck();
  }

  public zoomIn(): void {
    if (this.mode === 'viewer') {
      this.viewerComp?.zoomIn(1.2);
    } else {
      this.editorComp?.zoomIn(1.2);
    }
  }

  public zoomOut(): void {
    if (this.mode === 'viewer') {
      this.viewerComp?.zoomOut(1.2);
    } else {
      this.editorComp?.zoomOut(1.2);
    }
  }

  public resetZoom(): void {
    if (this.mode === 'viewer') {
      this.viewerComp?.resetZoom();
    } else {
      this.editorComp?.resetZoom();
    }
  }

  public onFloorplanChanged(plan: Floorplan): void {
    this.floorplan = plan;
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
    if (this.viewerComp) {
      const updateMap: Record<string, string> = { ...this.statuses };
      for (const id of this.selectedSeatIds) {
        updateMap[id] = 'reserved';
      }
      this.statuses = updateMap;
      this.viewerComp.clearSelection();
      this.addLog(
        'reserved',
        `Reserved ${this.selectedSeatIds.length} seat(s)`
      );
      this.cdr.markForCheck();
    }
  }

  public clearSelection(): void {
    this.viewerComp?.clearSelection();
    this.cdr.markForCheck();
  }

  public exportJson(): void {
    const plan =
      this.mode === 'viewer'
        ? this.floorplan
        : this.editorComp?.getFloorplan() || this.floorplan;
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
