import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { TooltipContext } from '@open-seats/viewer';

/** Example pricing for the sample floorplan. */
export function priceTier(buildingId: string, rowLabel: string) {
  if (buildingId === 'vip-lounge') return { name: 'VIP', price: 150 };
  if (rowLabel === 'A') return { name: 'Front row', price: 95 };
  return { name: 'Standard', price: 65 };
}

const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  reserved: 'Reserved',
  locked: 'Locked',
};

/**
 * Seat tooltip rendered by `<seats-viewer>` through `<ng-template seatTooltip>`.
 * `data` merges live data from the server (e.g. a changed price) with this
 * browser's own seat data (the ticket), which wins.
 */
@Component({
  selector: 'open-seats-tooltip-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="head">
        <span class="label">{{ context().seat.label }}</span>
        <span class="status" [attr.data-status]="context().status">
          {{ statusLabel() }}
        </span>
      </div>
      <div class="where">
        {{ context().building.label }} · Row {{ context().row.label }}
      </div>
      @if (ticket(); as t) {
        <div class="ticket">
          🎟 Your ticket <b>{{ t }}</b> · booked {{ bookedAt() }}
        </div>
      } @else {
        <div class="price">
          <span class="tier">{{ tier().name }}</span>
          <span class="amount">\${{ price() }}</span>
          @if (isLivePrice()) {
            <span class="live">live</span>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .card {
        min-width: 200px;
        padding: 10px 12px;
        border-radius: 8px;
        background: rgba(24, 24, 27, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        color: #f4f4f5;
        font-size: 12px;
        line-height: 1.4;
      }
      .head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }
      .label {
        font-weight: 600;
        font-size: 13px;
      }
      .status {
        padding: 1px 8px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        background: rgba(76, 175, 80, 0.2);
        color: #81c784;
      }
      .status[data-status='reserved'] {
        background: rgba(158, 158, 158, 0.2);
        color: #bdbdbd;
      }
      .status[data-status='locked'] {
        background: rgba(244, 67, 54, 0.2);
        color: #e57373;
      }
      .where {
        color: #a1a1aa;
        font-size: 11px;
        margin-top: 2px;
      }
      .price,
      .ticket {
        margin-top: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .amount {
        font-weight: 700;
        font-size: 14px;
      }
      .live {
        font-size: 9px;
        padding: 0 5px;
        border-radius: 4px;
        background: #6366f1;
        text-transform: uppercase;
      }
    `,
  ],
})
export class SeatTooltipCardComponent {
  readonly context = input.required<TooltipContext>();

  readonly statusLabel = computed(
    () => STATUS_LABELS[this.context().status] ?? this.context().status
  );
  readonly tier = computed(() =>
    priceTier(this.context().building.id, this.context().row.label)
  );
  readonly isLivePrice = computed(
    () => typeof this.context().data?.['price'] === 'number'
  );
  readonly price = computed(() =>
    this.isLivePrice()
      ? (this.context().data?.['price'] as number)
      : this.tier().price
  );
  readonly ticket = computed(
    () => this.context().data?.['ticket'] as string | undefined
  );
  readonly bookedAt = computed(
    () => this.context().data?.['bookedAt'] as string | undefined
  );
}
