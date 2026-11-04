import { SAMPLE_FLOORPLAN } from '@open-seats/core';
import { createViewer, type TooltipContext } from '@open-seats/viewer';

// #region renderer
function renderCard(card: HTMLElement, ctx: TooltipContext) {
  const price = ctx.data?.['price'];
  const title = document.createElement('strong');
  title.textContent = `${ctx.seat.label} · Row ${ctx.row.label}`;
  const detail = document.createElement('div');
  detail.textContent = price ? `${ctx.status} · $${price}` : ctx.status;
  card.replaceChildren(title, detail);
}

const viewer = createViewer(document.getElementById('seat-map')!, {
  floorplan: SAMPLE_FLOORPLAN,
  // The viewer handles the delay, positioning and show/hide; `host` is an
  // unstyled element for you to fill.
  tooltipRenderer: (ctx, host) => {
    const card = document.createElement('div');
    card.className = 'my-seat-card';
    renderCard(card, ctx);
    host.appendChild(card);

    return {
      // Called with fresh state when this seat's status or data changes.
      update: (next) => renderCard(card, next),
      // Called once the tooltip has faded out.
      destroy: () => host.replaceChildren(),
    };
  },
});
// #endregion renderer

// #region swap
// Replace the renderer later, or pass null to go back to `tooltipProvider`.
viewer.setTooltipRenderer(null);
// #endregion swap
