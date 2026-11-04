# Rows & tables

A row is a line of seats. With `side: 'one'` the seats sit along one edge; with `side: 'both'` they sit on both sides of a table, so it works for banquet tables as well as theatre rows.

| Field         | Meaning                                                                                   |
| :------------ | :---------------------------------------------------------------------------------------- |
| `side`        | `'one'` or `'both'`.                                                                      |
| `seatSpacing` | Distance between seat centres along the row. Must be at least `2 × seatRadius`.           |
| `seatRadius`  | Seat size.                                                                                |
| `tableWidth`  | Table depth between the two sides (`0` for no table).                                     |
| `tableLength` | Table length. When the seat count changes, the length is kept and the spacing recomputed. |

## Configure a row

<<< @/snippets/editor/rows.ts#configure

## Move seats and rows

<<< @/snippets/editor/rows.ts#move

## Invalid changes

<<< @/snippets/editor/rows.ts#result

Each of these is a single undo step, and seat labels are kept up to date.
