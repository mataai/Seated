import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  @ViewChild(SeatsViewerComponent) viewerComp?: SeatsViewerComponent;
  @ViewChild(SeatsEditorComponent) editorComp?: SeatsEditorComponent;

  public floorplan: Floorplan = JSON.parse(JSON.stringify(SAMPLE_FLOORPLAN));
  public mode: 'viewer' | 'editor' = 'viewer';
  public currentTool: ToolType = 'select';

  public statuses: Record<string, string> = {
    's-a-1a': 'reserved',
    's-a-1b': 'reserved',
    's-a-2a': 'locked',
    's-b-5a': 'reserved',
    's-b-5b': 'reserved',
    's-c-8a': 'reserved',
  };

  public selectedSeatIds: string[] = [];
  public selectedSeatLabels: string[] = [];
  public eventLog: { time: string; name: string; detail: string }[] = [];
  public isPreviewActive = false;

  public setMode(newMode: 'viewer' | 'editor'): void {
    if (this.mode === newMode) return;

    if (this.mode === 'editor' && this.editorComp) {
      const updated = this.editorComp.getFloorplan();
      if (updated) this.floorplan = updated;
    }

    this.mode = newMode;
    this.addLog('mode', `Switched to ${newMode} mode`);
  }

  public setTool(tool: ToolType): void {
    this.currentTool = tool;
    this.editorComp?.setTool(tool);

    if (tool === 'row') {
      const bld = this.editorComp?.getFloorplan()?.buildings[0];
      if (bld) {
        const row = this.editorComp?.createRow(bld.id, { x: 160, y: 580 }, 8, {
          side: 'both',
          seatSpacing: 42,
          seatRadius: 13,
          tableWidth: 26,
        });
        if (row) this.addLog('create', `Added Row ${row.label}`);
      }
    } else if (tool === 'add-seat') {
      const bld = this.editorComp?.getFloorplan()?.buildings[0];
      if (bld && bld.rows.length > 0) {
        const lastRow = bld.rows[bld.rows.length - 1];
        const seat = this.editorComp?.addSeatToRow(bld.id, lastRow.id, 'a');
        if (seat) this.addLog('create', `Added seat to Row ${lastRow.label}`);
      }
    }
  }

  public undo(): void {
    this.editorComp?.undo();
  }

  public redo(): void {
    this.editorComp?.redo();
  }

  public togglePreview(): void {
    if (this.editorComp) {
      this.isPreviewActive = this.editorComp.togglePreview();
      this.addLog('preview', this.isPreviewActive ? 'ON' : 'OFF');
    }
  }

  public zoomIn(): void {
    if (this.mode === 'viewer') this.viewerComp?.zoomIn(1.2);
  }

  public zoomOut(): void {
    if (this.mode === 'viewer') this.viewerComp?.zoomOut(1.2);
  }

  public resetZoom(): void {
    if (this.mode === 'viewer') this.viewerComp?.resetZoom();
  }

  public onSelectionChanged(payload: {
    selectedSeatIds: string[];
    selectedSeats: RenderSeatContext[];
  }): void {
    this.selectedSeatIds = payload.selectedSeatIds;
    this.selectedSeatLabels = payload.selectedSeats.map((s) => s.seat.label);
    this.addLog('selection', `${this.selectedSeatIds.length} seat(s) selected`);
  }

  public onSeatSelected(ctx: RenderSeatContext): void {
    this.addLog('seatSelected', ctx.seat.label);
  }

  public onSeatDeselected(ctx: RenderSeatContext): void {
    this.addLog('seatDeselected', ctx.seat.label);
  }

  public onSeatHovered(ctx: RenderSeatContext): void {
    this.addLog('hover', `${ctx.seat.label} (${ctx.row.label})`);
  }

  public onFloorplanChanged(plan: Floorplan): void {
    this.floorplan = plan;
    this.addLog('change', 'Floorplan modified via editor');
  }

  public onViolationsUpdated(violations: Violation[]): void {
    if (violations.length > 0) {
      const summary = violations
        .map((v) => `${v.rule} (${v.ids.join(', ')})`)
        .join('; ');
      this.addLog('violation', summary);
    }
  }

  public reserveSelected(): void {
    if (this.viewerComp) {
      const updateMap: Record<string, string> = { ...this.statuses };
      for (const id of this.selectedSeatIds) {
        updateMap[id] = 'reserved';
      }
      this.statuses = updateMap;
      this.viewerComp.clearSelection();
      this.addLog('reserved', `Reserved ${this.selectedSeatIds.length} seat(s)`);
    }
  }

  public clearSelection(): void {
    this.viewerComp?.clearSelection();
  }

  public exportJson(): void {
    const plan =
      this.mode === 'viewer'
        ? this.floorplan
        : this.editorComp?.getFloorplan() || this.floorplan;
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(plan, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'floorplan.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    this.addLog('export', 'Floorplan exported as JSON');
  }

  private addLog(name: string, detail: string): void {
    const time = new Date().toLocaleTimeString().split(' ')[0];
    this.eventLog.unshift({ time, name, detail });
    if (this.eventLog.length > 25) {
      this.eventLog.pop();
    }
  }
}
