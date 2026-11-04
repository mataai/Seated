import { Component, signal, viewChild } from '@angular/core';
import { SeatsEditorComponent } from '@open-seats/angular';
import {
  SAMPLE_FLOORPLAN,
  type Floorplan,
  type Violation,
} from '@open-seats/core';
import type { ToolType } from '@open-seats/editor';

declare function saveFloorplan(plan: Floorplan): void;

// #region editor
@Component({
  selector: 'app-designer',
  standalone: true,
  imports: [SeatsEditorComponent],
  template: `
    <seats-editor
      style="display: block; height: 100vh"
      [floorplan]="floorplan()"
      [tool]="tool()"
      [options]="{ gridSnapping: { enabled: true, size: 10 } }"
      [showToolbar]="true"
      [showProperties]="true"
      (floorplanChange)="onChange($event)"
      (toolChange)="tool.set($event)"
      (selectionChange)="selection.set($event)"
      (violationsUpdated)="violations.set($event)"
    />
  `,
})
export class DesignerComponent {
  readonly editor = viewChild.required(SeatsEditorComponent);

  readonly floorplan = signal<Floorplan>(SAMPLE_FLOORPLAN);
  readonly tool = signal<ToolType>('select');
  readonly selection = signal<string[]>([]);
  readonly violations = signal<Violation[]>([]);

  onChange(plan: Floorplan): void {
    saveFloorplan(plan); // persist; no need to feed it back into [floorplan]
  }

  undo(): void {
    this.editor().undo();
  }
}
// #endregion editor
