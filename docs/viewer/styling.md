# Styling

## Seats

Seat colours come from [status definitions](./statuses#custom-statuses). Selection and hover have their own styles:

<<< @/snippets/viewer/styling.ts#styles

| Option          | Fields                          |
| :-------------- | :------------------------------ |
| `selectedStyle` | `fill`, `stroke`, `strokeWidth` |
| `hoverStyle`    | `stroke`, `strokeWidth`         |

## Buildings, zones and tables

These are part of the floorplan, and styled by whoever designs it:

- **Zones**: `fill`, `stroke`, `opacity`, and a `text` label with `color`, `fontSize`, `fontFamily`, `align`, `offset`.
- **Tables**: a row's `tableStyle` with `fill`, `stroke`, `strokeWidth`, `cornerRadius`.

## Tooltip

The built-in tooltip is an element with the class `open-seats-tooltip`. For full control over its look, use a [tooltip renderer](./tooltips#renderer-your-own-dom); its host has the extra class `open-seats-tooltip--custom` and no styling of its own.

```css
.open-seats-tooltip--custom .my-seat-card {
  padding: 8px 12px;
  border-radius: 8px;
  background: #18181b;
  color: #fafafa;
}
```
