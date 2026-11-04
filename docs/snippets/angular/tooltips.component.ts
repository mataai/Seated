import { Component, computed, input } from '@angular/core';
import {
  SeatTooltipDirective,
  SeatsViewerComponent,
} from '@open-seats/angular';
import { SAMPLE_FLOORPLAN } from '@open-seats/core';
import type { TooltipContext } from '@open-seats/viewer';

// #region card
@Component({
  selector: 'app-seat-card',
  standalone: true,
  template: `
    <div class="card">
      <strong>{{ context().seat.label }}</strong>
      <span class="pill" [attr.data-status]="context().status">
        {{ context().status }}
      </span>
      <div>{{ context().building.label }} · Row {{ context().row.label }}</div>
      @if (price(); as p) {
        <div class="price">\${{ p }}</div>
      }
    </div>
  `,
  styles: `
    .card {
      padding: 8px 12px;
      border-radius: 8px;
      background: #18181b;
      color: #fafafa;
    }
  `,
})
export class SeatCardComponent {
  /** Required name for components used with [tooltipComponent]. */
  readonly context = input.required<TooltipContext>();
  readonly price = computed(
    () => this.context().data?.['price'] as number | undefined
  );
}
// #endregion card

// #region template
@Component({
  selector: 'app-map-with-template',
  standalone: true,
  imports: [SeatsViewerComponent, SeatTooltipDirective, SeatCardComponent],
  template: `
    <seats-viewer [floorplan]="floorplan">
      <ng-template seatTooltip let-tooltip>
        <app-seat-card [context]="tooltip" />
      </ng-template>
    </seats-viewer>
  `,
})
export class MapWithTemplateComponent {
  readonly floorplan = SAMPLE_FLOORPLAN;
}
// #endregion template

// #region variables
@Component({
  selector: 'app-map-inline-tooltip',
  standalone: true,
  imports: [SeatsViewerComponent, SeatTooltipDirective],
  template: `
    <seats-viewer [floorplan]="floorplan">
      <ng-template
        seatTooltip
        let-seat="seat"
        let-row="row"
        let-status="status"
        let-data="data"
      >
        <div class="tip">
          {{ seat.label }} (row {{ row.label }}) is {{ status }}
          @if (data?.['price']) {
            · \${{ data['price'] }}
          }
        </div>
      </ng-template>
    </seats-viewer>
  `,
})
export class MapInlineTooltipComponent {
  readonly floorplan = SAMPLE_FLOORPLAN;
}
// #endregion variables

// #region component-input
@Component({
  selector: 'app-map-with-component',
  standalone: true,
  imports: [SeatsViewerComponent],
  template: `<seats-viewer
    [floorplan]="floorplan"
    [tooltipComponent]="card"
  />`,
})
export class MapWithComponentComponent {
  readonly floorplan = SAMPLE_FLOORPLAN;
  readonly card = SeatCardComponent;
}
// #endregion component-input
