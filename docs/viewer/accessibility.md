# Accessibility

The viewer works with a keyboard and a screen reader out of the box.

- The container gets `role="application"`, an accessible name (`ariaLabel`) and `tabindex="0"`.
- A polite live region announces the focused seat (label, row, building, status, selected) and changes such as "Seat A-3 is no longer available and was removed from your selection."

<<< @/snippets/viewer/accessibility.ts#a11y

## Keyboard

| Keys                                                | Action                                      |
| :-------------------------------------------------- | :------------------------------------------ |
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Move to the nearest seat in that direction. |
| <kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd>    | Next / previous seat.                       |
| <kbd>Space</kbd> / <kbd>Enter</kbd>                 | Select or deselect the focused seat.        |
| <kbd>Esc</kbd>                                      | Clear the selection.                        |
| <kbd>+</kbd> / <kbd>-</kbd>                         | Zoom in / out.                              |
| <kbd>0</kbd>                                        | Reset zoom.                                 |
| <kbd>Shift</kbd> + arrows                           | Pan the view.                               |

Set `enableKeyboardNavigation: false` if your app handles the keyboard itself.
