# Custom tooltips

Render any Angular template or component as the seat tooltip. The viewer still handles the hover delay, positioning and showing/hiding. When the hovered seat's status or data changes (for example from a live update), the open tooltip updates in place.

The tooltip box is unstyled in this mode, so your template provides the look.

## A component

<<< @/snippets/angular/tooltips.component.ts#card

## Use it through a template

<<< @/snippets/angular/tooltips.component.ts#template

`let-tooltip` binds the whole `TooltipContext`. You can also bind its parts:

<<< @/snippets/angular/tooltips.component.ts#variables

| Variable              | Type                                                               |
| :-------------------- | :----------------------------------------------------------------- |
| `$implicit` (`let-x`) | `TooltipContext`                                                   |
| `seat`                | `Seat`                                                             |
| `row`                 | `Row`                                                              |
| `building`            | `Building`                                                         |
| `status`              | `string`                                                           |
| `data`                | `SeatData \| undefined`, the merged [seat data](/viewer/seat-data) |

## Or pass the component class

<<< @/snippets/angular/tooltips.component.ts#component-input

The component receives the context through a `context` input, so declare `context = input.required<TooltipContext>()`.

## Precedence

1. A projected `<ng-template seatTooltip>`.
2. `[tooltipComponent]`.
3. `options.tooltipProvider` (the built-in text tooltip).

Template and component views are attached to `<seats-viewer>`, so they can inject your services and use pipes like any other part of your app.
