import { SAMPLE_FLOORPLAN } from '@open-seats/core';
import { createViewer } from '@open-seats/viewer';

declare function fetchPrice(seatId: string): Promise<number>;

// #region provider
const viewer = createViewer(document.getElementById('seat-map')!, {
  floorplan: SAMPLE_FLOORPLAN,
  tooltipDebounceMs: 150, // wait before calling the provider (default 150)
  tooltipProvider: async ({ seat, row, building, status }) => {
    if (status === 'blocked') return null; // no tooltip
    const price = await fetchPrice(seat.id);
    return {
      title: seat.label,
      subtitle: `${building.label} · Row ${row.label}`,
      content: `$${price} · ${status}`,
    };
  },
});
// #endregion provider

// #region html
createViewer(document.getElementById('other-map')!, {
  floorplan: SAMPLE_FLOORPLAN,
  // `html` is sanitized with DOMPurify (scripts, handlers, <style>, <form> removed).
  tooltipProvider: async ({ seat }) => ({
    html: `<strong>${seat.label}</strong><br><img src="/views/${seat.id}.jpg" width="160">`,
  }),
});
// #endregion html

// #region refresh
// Tooltips are cached per seat and refetched automatically when the seat's
// status or data changes. Force a refetch after other changes, e.g. prices:
viewer.refreshTooltips(['s-a-1a', 's-a-2a']);
viewer.refreshTooltips(); // all seats
// #endregion refresh
