import { Directive, TemplateRef, inject } from '@angular/core';
import type { TooltipContext } from '@open-seats/viewer';

/** Template variables available inside `<ng-template seatTooltip>`. */
export interface SeatTooltipTemplateContext extends TooltipContext {
  /** The whole context, for `let-tooltip`. */
  $implicit: TooltipContext;
}

/**
 * Marks a template as the seat tooltip of the enclosing `<seats-viewer>`:
 *
 * ```html
 * <seats-viewer [floorplan]="plan">
 *   <ng-template seatTooltip let-seat="seat" let-status="status" let-data="data">
 *     <my-seat-card [seat]="seat" [status]="status" [price]="data?.price" />
 *   </ng-template>
 * </seats-viewer>
 * ```
 *
 * The viewer shows it after the hover delay, positions it next to the pointer
 * and re-renders it when the seat's status or data changes. The tooltip box is
 * unstyled, so the template provides its own look.
 */
@Directive({
  selector: 'ng-template[seatTooltip]',
  standalone: true,
})
export class SeatTooltipDirective {
  readonly template =
    inject<TemplateRef<SeatTooltipTemplateContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _dir: SeatTooltipDirective,
    _ctx: unknown
  ): _ctx is SeatTooltipTemplateContext {
    return true;
  }
}
