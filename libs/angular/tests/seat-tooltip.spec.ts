import './test-setup';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SAMPLE_FLOORPLAN } from '@open-seats/core';
import type { TooltipContext } from '@open-seats/viewer';
import { SeatsViewerComponent } from '../src/components/seats-viewer.component';
import { SeatTooltipDirective } from '../src/components/seat-tooltip.directive';

const seatCtx = () => {
  const building = SAMPLE_FLOORPLAN.buildings[0];
  const row = building.rows[0];
  return { seat: row.seats[0], row, building };
};

/** Hovers the first seat through the viewer's tooltip manager. */
async function hoverFirstSeat(viewerComp: SeatsViewerComponent) {
  (viewerComp as any).viewer.tooltipManager.show(
    seatCtx(),
    new MouseEvent('mousemove', { clientX: 10, clientY: 10 })
  );
  await new Promise((r) => setTimeout(r, 5));
}

const tooltipHost = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.open-seats-tooltip');

@Component({
  selector: 'test-seat-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<b class="badge">{{ label() }} is {{ status() }}</b>`,
})
class SeatBadgeComponent {
  readonly label = input.required<string>();
  readonly status = input.required<string>();
}

@Component({
  standalone: true,
  imports: [SeatsViewerComponent, SeatTooltipDirective, SeatBadgeComponent],
  template: `
    <seats-viewer
      [floorplan]="plan"
      [options]="{ tooltipDebounceMs: 0 }"
      [seatData]="seatData"
    >
      <ng-template
        seatTooltip
        let-seat="seat"
        let-status="status"
        let-data="data"
      >
        <test-seat-badge [label]="seat.label" [status]="status" />
        <span class="price">{{ data?.['price'] ?? '-' }}</span>
      </ng-template>
    </seats-viewer>
  `,
})
class TemplateHostComponent {
  readonly viewerComp = viewChild.required(SeatsViewerComponent);
  plan = SAMPLE_FLOORPLAN;
  seatData = {};
}

@Component({
  standalone: true,
  imports: [SeatsViewerComponent, SeatTooltipDirective],
  template: `
    <seats-viewer [floorplan]="plan" [options]="{ tooltipDebounceMs: 0 }">
      @if (showTemplate()) {
        <ng-template seatTooltip let-seat="seat">
          <i class="late">{{ seat.label }}</i>
        </ng-template>
      }
    </seats-viewer>
  `,
})
class LateTemplateHostComponent {
  readonly viewerComp = viewChild.required(SeatsViewerComponent);
  readonly showTemplate = signal(false);
  plan = SAMPLE_FLOORPLAN;
}

@Component({
  selector: 'test-tooltip-card',
  standalone: true,
  template: `<div class="card">
    {{ context().seat.label }} / {{ context().status }}
  </div>`,
})
class TooltipCardComponent {
  readonly context = input.required<TooltipContext>();
}

describe('seat tooltip content', () => {
  it('renders a projected seatTooltip template with components inside', async () => {
    const fixture = TestBed.createComponent(TemplateHostComponent);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    const seatId = seatCtx().seat.id;
    const label = seatCtx().seat.label;

    await hoverFirstSeat(host.viewerComp());
    const tooltip = tooltipHost(fixture.nativeElement)!;
    expect(tooltip.querySelector('.badge')?.textContent).toBe(
      `${label} is available`
    );
    expect(tooltip.querySelector('.price')?.textContent).toBe('-');

    // Status and data changes re-render the open tooltip.
    host.viewerComp().setStatus(seatId, 'reserved');
    host.viewerComp().setSeatData({ [seatId]: { price: 95 } });
    expect(tooltip.querySelector('.badge')?.textContent).toBe(
      `${label} is reserved`
    );
    expect(tooltip.querySelector('.price')?.textContent).toBe('95');

    (host.viewerComp() as any).viewer.tooltipManager.hide();
    // Torn down once the 150ms fade-out is over.
    expect(tooltip.childElementCount).toBe(2);
    await new Promise((r) => setTimeout(r, 200));
    expect(tooltip.childElementCount).toBe(0);
    fixture.destroy();
  });

  it('updates the open tooltip in place instead of rebuilding it', async () => {
    const fixture = TestBed.createComponent(TemplateHostComponent);
    fixture.detectChanges();
    const viewerComp = fixture.componentInstance.viewerComp();
    await hoverFirstSeat(viewerComp);
    const tooltip = tooltipHost(fixture.nativeElement)!;
    const badge = tooltip.querySelector('.badge');
    viewerComp.setStatus(seatCtx().seat.id, 'reserved');
    expect(tooltip.querySelector('.badge')).toBe(badge);
    expect(badge?.textContent).toContain('is reserved');
    fixture.destroy();
  });

  it('uses a seatTooltip template that appears after the viewer is created', async () => {
    const fixture = TestBed.createComponent(LateTemplateHostComponent);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    expect(tooltipHost(fixture.nativeElement)).toBeNull();

    host.showTemplate.set(true);
    fixture.detectChanges();
    await hoverFirstSeat(host.viewerComp());
    const tooltip = tooltipHost(fixture.nativeElement)!;
    expect(tooltip.classList).toContain('open-seats-tooltip--custom');
    expect(tooltip.querySelector('.late')?.textContent).toBe(
      seatCtx().seat.label
    );
    fixture.destroy();
  });

  it('falls back to options.seatData while the seatData input is unset', () => {
    const fixture = TestBed.createComponent(SeatsViewerComponent);
    const seatId = seatCtx().seat.id;
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.componentRef.setInput('options', {
      seatData: { [seatId]: { price: 1 } },
    });
    fixture.detectChanges();
    const viewerComp = fixture.componentInstance;

    fixture.componentRef.setInput('seatData', { [seatId]: { price: 2 } });
    fixture.detectChanges();
    expect(viewerComp.getSeatData(seatId)).toEqual({ price: 2 });

    fixture.componentRef.setInput('seatData', undefined);
    fixture.detectChanges();
    expect(viewerComp.getSeatData(seatId)).toEqual({ price: 1 });

    fixture.componentRef.setInput('options', {
      seatData: { [seatId]: { price: 3 } },
    });
    fixture.detectChanges();
    expect(viewerComp.getSeatData(seatId)).toEqual({ price: 3 });
    fixture.destroy();
  });

  it('renders a tooltipComponent with the context input', async () => {
    const fixture = TestBed.createComponent(SeatsViewerComponent);
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.componentRef.setInput('options', { tooltipDebounceMs: 0 });
    fixture.componentRef.setInput('tooltipComponent', TooltipCardComponent);
    fixture.detectChanges();

    await hoverFirstSeat(fixture.componentInstance);
    const tooltip = tooltipHost(fixture.nativeElement)!;
    expect(tooltip.querySelector('.card')?.textContent?.trim()).toBe(
      `${seatCtx().seat.label} / available`
    );
    fixture.destroy();
  });

  it('uses the built-in tooltip when neither is given', () => {
    const fixture = TestBed.createComponent(SeatsViewerComponent);
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.componentRef.setInput('options', {
      tooltipProvider: async () => ({ title: 'x' }),
    });
    fixture.detectChanges();
    expect(tooltipHost(fixture.nativeElement)?.classList).not.toContain(
      'open-seats-tooltip--custom'
    );
    fixture.destroy();
  });
});
