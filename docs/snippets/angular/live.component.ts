import { Component, signal, type OnDestroy } from '@angular/core';
import { SeatsViewerComponent } from '@open-seats/angular';
import { SAMPLE_FLOORPLAN } from '@open-seats/core';
import {
  socketIoStatusSource,
  type SeatData,
  type StatusConnectionState,
} from '@open-seats/viewer';
import { io } from 'socket.io-client';

// #region live
@Component({
  selector: 'app-live-seats',
  standalone: true,
  imports: [SeatsViewerComponent],
  template: `
    <p>Status: {{ state() ?? 'off' }}</p>
    <seats-viewer
      [floorplan]="floorplan"
      [statusSource]="source"
      [seatData]="myTickets()"
      (connectionStateChanged)="state.set($event.state)"
    />
  `,
})
export class LiveSeatsComponent implements OnDestroy {
  private readonly socket = io('https://api.example.com', {
    auth: { floorplanId: 'grand-hall' },
  });

  readonly floorplan = SAMPLE_FLOORPLAN;
  readonly source = socketIoStatusSource(this.socket);
  readonly state = signal<StatusConnectionState | null>(null);
  /** This user's own data; live updates never overwrite it. */
  readonly myTickets = signal<Record<string, SeatData>>({});

  ngOnDestroy(): void {
    this.socket.disconnect();
  }
}
// #endregion live
