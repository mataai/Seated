import {
  ChangeDetectionStrategy,
  Component,
  signal,
  viewChild,
} from '@angular/core';
import { SeatsViewerComponent } from '@open-seats/angular';
import { SAMPLE_FLOORPLAN } from '@open-seats/core';
import type { RenderSeatContext, ViewerOptions } from '@open-seats/viewer';

// #region component
@Component({
  selector: 'app-seat-picker',
  standalone: true,
  imports: [SeatsViewerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <seats-viewer
      style="display: block; height: 600px"
      [floorplan]="floorplan"
      [statuses]="statuses()"
      [maxSelectable]="4"
      [options]="options"
      (selectionChanged)="selected.set($event.selectedSeats)"
      (selectionInvalidated)="onTaken($event.seats)"
    />

    <button [disabled]="selected().length === 0" (click)="book()">
      Book {{ selected().length }} seat(s)
    </button>
  `,
})
export class SeatPickerComponent {
  readonly viewer = viewChild.required(SeatsViewerComponent);

  readonly floorplan = SAMPLE_FLOORPLAN;
  readonly statuses = signal<Record<string, string>>({ 's-a-1a': 'reserved' });
  readonly selected = signal<RenderSeatContext[]>([]);
  readonly options: Partial<ViewerOptions> = {
    selectedStyle: { fill: '#2563eb' },
  };

  book(): void {
    const booked = Object.fromEntries(
      this.selected().map(({ seat }) => [seat.id, 'reserved'])
    );
    this.statuses.update((current) => ({ ...current, ...booked }));
    this.viewer().clearSelection();
  }

  onTaken(seats: RenderSeatContext[]): void {
    alert(`${seats.map((s) => s.seat.label).join(', ')} was just taken`);
  }
}
// #endregion component
