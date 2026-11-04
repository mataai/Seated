# Tooltips

The viewer shows a tooltip next to the pointer after it rests on a seat for `tooltipDebounceMs` (150 ms by default). You decide what goes inside, in one of two ways:

|            | `tooltipProvider`           | `tooltipRenderer`                    |
| :--------- | :-------------------------- | :----------------------------------- |
| You return | text or sanitized HTML      | your own DOM                         |
| Look       | built-in dark card          | entirely yours (unstyled host)       |
| Async      | yes (fetch prices, photos…) | render immediately, update later     |
| Best for   | quick setup                 | design systems, framework components |

Both receive a `TooltipContext`: `{ seat, row, building, status, data }`, where `data` is the seat's merged [seat data](./seat-data).

## Provider: text content

<<< @/snippets/viewer/tooltip-provider.ts#provider

Return `null` to show no tooltip for that seat.

### HTML content

<<< @/snippets/viewer/tooltip-provider.ts#html

### Caching and refreshing

Results are cached per seat. A seat's tooltip is fetched again automatically when its status or data changes, including from live updates; an open tooltip updates in place. For other changes:

<<< @/snippets/viewer/tooltip-provider.ts#refresh

## Renderer: your own DOM

<<< @/snippets/viewer/tooltip-renderer.ts#renderer

Return a cleanup function, or a handle with `update` and `destroy`. Without `update`, the viewer destroys and re-renders the content when the seat's status or data changes.

<<< @/snippets/viewer/tooltip-renderer.ts#swap

::: tip Angular
In Angular, use an `<ng-template seatTooltip>` or `[tooltipComponent]` instead. See [Custom tooltips](/angular/tooltips).
:::
