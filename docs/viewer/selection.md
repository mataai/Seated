# Selection

Customers click (or press <kbd>Space</kbd> / <kbd>Enter</kbd> on) available seats to select them. Only seats whose status is `selectable` can be selected.

## Limit the selection

<<< @/snippets/viewer/selection.ts#limit

When the limit is reached, further clicks are ignored. With `maxSelectable: 1`, clicking another seat moves the selection instead.

## Select from code

<<< @/snippets/viewer/selection.ts#programmatic

Each entry of `getSelectedSeats()` is a `RenderSeatContext`: `{ seat, row, building }`.

## React to changes

<<< @/snippets/viewer/selection.ts#checkout

`selectionInvalidated` happens when a selected seat's status changes to something unselectable, for example through a [live update](/live/) or `setStatus`. The seat is removed from the selection, the change is announced to screen readers, and `seatDeselected` and `selectionChanged` fire as well.

::: tip Booking your own selection
Clear the selection before marking the user's own seats as reserved. Otherwise the viewer treats them as taken by someone else and fires `selectionInvalidated`.
:::
