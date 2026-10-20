# @open-seats/angular

First-class Angular 19+ integration for OpenSeats, providing `<seats-viewer>` and `<seats-editor>` standalone components.

## Key Features
- **Zone Performance**: Automatically executes canvas rendering and hit-testing outside the Angular zone (`ngZone.runOutsideAngular()`) and re-enters only for event emission.
- **Standalone Components**: Ready to import into any standalone Angular component or NgModule.
- **Reactive Inputs & Outputs**: Declarative bindings for floorplans, seat statuses, tools, selection events, and layout updates.
- **Proper Packaging**: Built with `ng-packagr` and Ivy partial compilation mode for optimal bundle sizes.

## Quick Start
```typescript
import { Component } from '@angular/core';
import { SeatsViewerComponent } from '@open-seats/angular';

@Component({
  selector: 'my-booking-page',
  standalone: true,
  imports: [SeatsViewerComponent],
  template: `
    <seats-viewer
      [floorplan]="plan"
      [statuses]="statuses"
      (selectionChanged)="onSelection($event)"
    />
  `,
})
export class MyBookingPageComponent {
  plan = myFloorplan;
  statuses = { 's-1': 'available', 's-2': 'reserved' };

  onSelection(event: any) {
    console.log('Selected:', event.selectedSeatIds);
  }
}
```
