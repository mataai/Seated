# Layout rules

OpenSeats keeps floorplans physically sensible. The editor refuses edits that break these rules (unless you turn enforcement off), and the viewer reports existing problems without refusing to render.

## The rules

| Rule                                                                   | Violation `rule`   |
| :--------------------------------------------------------------------- | :----------------- |
| Buildings don't overlap each other.                                    | `building-overlap` |
| Zones don't overlap other zones in the same building.                  | `zone-overlap`     |
| Rows don't overlap other rows in the same building.                    | `row-overlap`      |
| Zones and rows don't overlap each other.                               | `zone-row-overlap` |
| Seats in a row don't overlap (`seatSpacing ≥ 2 × seatRadius`).         | `seat-overlap`     |
| Zones and rows lie inside their building (concave shapes are handled). | `out-of-bounds`    |
| Polygons have ≥ 3 points, a non-zero area and no self-intersections.   | `invalid-polygon`  |

Shapes may touch: edges within the tolerance (default `0.01`) don't count as overlapping.

## In the editor

With `rules.enforce` (the default), every edit is checked with [`canPlace`](/core/validation) first. A rejected edit changes nothing: creation methods return `null`, other methods return `false`, and `violationsUpdated` fires with the reasons.

```ts
const editor = createEditor(el, { rules: { enforce: true, tolerance: 0.01 } });

editor.on('violationsUpdated', (violations) => {
  for (const { rule, ids } of violations) console.warn(rule, ids);
});
```

## In the viewer

The viewer is lenient: it renders whatever it gets and lists problems in `viewer.violations` and the `violationsUpdated` event.

```ts
viewer.load(floorplan);
if (viewer.violations.length) console.warn(viewer.violations);
```

## Anywhere else

Use [`validateLayout`](/core/validation) from `@open-seats/core`, for example to reject invalid floorplans on your server.
