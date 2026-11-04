# Seat statuses

Every seat has a status key. The status decides the seat's colour and whether it can be selected. Seats you don't mention have the default status, `available`.

## Built-in statuses

| Key         | Colour          | Selectable |
| :---------- | :-------------- | :--------- |
| `available` | green `#4caf50` | yes        |
| `reserved`  | grey `#9e9e9e`  | no         |
| `locked`    | red `#f44336`   | no         |

An unknown key falls back to a grey, non-selectable style and logs a warning, so a typo never makes a seat bookable.

## Custom statuses

Pass your own definitions to replace the built-in list:

<<< @/snippets/viewer/statuses.ts#definitions

| Field                               | Description                                  |
| :---------------------------------- | :------------------------------------------- |
| `key`                               | The value you use in `statuses`.             |
| `label`                             | Human-readable name (handy for your legend). |
| `style.fill` / `stroke` / `opacity` | Seat appearance.                             |
| `selectable`                        | Whether customers can select it.             |
| `hoverable`                         | Set `false` to disable the hover highlight.  |

## Updating statuses

<<< @/snippets/viewer/statuses.ts#update

If a seat in the user's selection becomes unselectable, it's deselected automatically and `selectionInvalidated` fires. See [Selection](./selection#react-to-changes).

## Snapshots and patches

For ordered updates, for example from a server, use snapshots and patches with revisions. This is what [live sources](/live/) use under the hood:

<<< @/snippets/viewer/statuses.ts#snapshot
