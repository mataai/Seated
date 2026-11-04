# Seat labels

Seats are labelled `<building>-<row>-<number>`, for example `Grand Auditorium-C-7`. The editor keeps labels current: creating rows, adding or moving seats, renaming, copying and pasting all relabel the affected seats. Seat **ids** never change.

| Row type     | Numbering                                                                             |
| :----------- | :------------------------------------------------------------------------------------ |
| One-sided    | 1, 2, 3, … along the row                                                              |
| Double-sided | Side `a` gets odd numbers and side `b` even ones, so facing seats are 1 & 2, 3 & 4, … |

New rows are lettered `A`, `B`, … `Z`, `AA`, `AB`, …

## `NumberingService`

The same rules are available for your own tools, such as importers:

<<< @/snippets/editor/numbering.ts#labels

<<< @/snippets/editor/numbering.ts#renumber
