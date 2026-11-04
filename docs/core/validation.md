# Validation

Both functions check the [layout rules](/guide/layout-rules) and return a list of `Violation`s (`{ rule, ids }`). An empty list means the layout is fine.

## Validate a whole floorplan

<<< @/snippets/core/core.ts#validate

Use this on your server before saving a floorplan from an untrusted client.

## Check a single change

`canPlace` answers "would this change be allowed?" without modifying anything. The editor uses it before every edit.

<<< @/snippets/core/core.ts#can-place

`canPlace(floorplan, nodeId, proposed, options?)` accepts any mix of `position`, `rotation`, `points`, and for rows `side`, `seatSpacing`, `seatRadius`, `tableWidth`, `tableLength` and `seats`.

## Options

| Option      | Default | Description                                                       |
| :---------- | :------ | :---------------------------------------------------------------- |
| `tolerance` | `0.01`  | Distance within which touching shapes don't count as overlapping. |
