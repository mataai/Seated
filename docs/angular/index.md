# Angular

`@open-seats/angular` provides standalone components for Angular 19–22:

| Import                 | Selector                    | Wraps                                          |
| :--------------------- | :-------------------------- | :--------------------------------------------- |
| `SeatsViewerComponent` | `<seats-viewer>`            | [Viewer](/viewer/)                             |
| `SeatsEditorComponent` | `<seats-editor>`            | [Editor](/editor/) plus a complete designer UI |
| `SeatTooltipDirective` | `<ng-template seatTooltip>` | [Custom tooltip content](./tooltips)           |

```sh
npm install @open-seats/angular @open-seats/viewer @open-seats/editor
```

```ts
import { SeatsViewerComponent, SeatsEditorComponent } from '@open-seats/angular';

@Component({
  standalone: true,
  imports: [SeatsViewerComponent, SeatsEditorComponent],
  // …
})
```

## Conventions

- **Inputs are signal inputs**; pass plain values or signals' values.
- **Outputs mirror the vanilla events**, with the same payloads, and run inside the Angular zone. A single live update emits all its outputs in one change-detection pass.
- **Give the component a size.** It fills its host, which is `display: block`.
- **Need something without an input?** Every component exposes the wrapped instance's methods (`clearSelection()`, `undo()`, …). Grab it with `viewChild(SeatsViewerComponent)`.
- **Anything else** can go through the `[options]` input, which accepts every vanilla option. It's read when the component is created.
