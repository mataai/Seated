declare const authToken: string;
// #region connect
import { SAMPLE_FLOORPLAN } from '@open-seats/core';
import { createViewer, socketIoStatusSource } from '@open-seats/viewer';
import { io } from 'socket.io-client';

// You create the socket, so URL, auth, path and transports stay in your hands.
const socket = io('https://api.example.com', {
  auth: { floorplanId: 'grand-hall', token: authToken },
});

const viewer = createViewer(document.getElementById('seat-map')!, {
  floorplan: SAMPLE_FLOORPLAN,
  statusSource: socketIoStatusSource(socket, { syncTimeoutMs: 10_000 }),
});
// #endregion connect

// #region state
const badge = document.querySelector<HTMLElement>('#live-badge')!;
const labels = { connecting: 'Connecting…', live: 'Live', offline: 'Offline' };

viewer.on('connectionStateChanged', ({ state, error }) => {
  // 'connecting' | 'live' | 'offline' | null (no source)
  badge.dataset['state'] = state ?? 'off';
  badge.textContent = state ? labels[state] : 'Off';
  if (error) console.warn('Live updates:', error);
});
// #endregion state

// #region switch
// Change or stop the source at any time.
viewer.setStatusSource(null);
socket.disconnect();
// #endregion switch
