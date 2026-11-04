import DOMPurify from 'dompurify';
import type {
  RenderSeatContext,
  TooltipInfo,
  TooltipRenderHandle,
} from './types';

/** The viewer wraps the app's provider to add the seat's status and data. */
type SeatTooltipFetcher = (
  ctx: RenderSeatContext
) => Promise<TooltipInfo | null>;

/**
 * Fills `host` with custom content; may return a cleanup function or a handle
 * that can update the content in place.
 */
export type SeatTooltipRenderFn = (
  ctx: RenderSeatContext,
  host: HTMLElement
) => void | (() => void) | TooltipRenderHandle<RenderSeatContext>;

/** Custom content currently in the tooltip element. */
interface RenderedContent {
  seatId: string;
  update?: (ctx: RenderSeatContext) => void;
  destroy?: () => void;
  /** Its seat changed while it was not shown: render again before reuse. */
  stale: boolean;
}

const FADE_MS = 150;

const BUILT_IN_STYLE = {
  padding: '8px 12px',
  background: 'rgba(24, 24, 27, 0.92)',
  color: '#f4f4f5',
  fontSize: '13px',
  lineHeight: '1.4',
  borderRadius: '6px',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(8px)',
} satisfies Partial<CSSStyleDeclaration>;

export class TooltipManager {
  private container: HTMLElement;
  private tooltipEl: HTMLDivElement | null = null;
  private provider?: SeatTooltipFetcher;
  private debounceMs: number;
  private cache = new Map<string, TooltipInfo>();
  private activeTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Seat the pending debounce (`activeTimeout`) is for. */
  private pendingSeatId: string | null = null;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;
  private shown = false;
  /** Incremented per provider call; only the latest response is used. */
  private fetchSeq = 0;
  private currentSeatId: string | null = null;
  /** Seat the tooltip is shown (or pending) for, to refetch on invalidate. */
  private currentCtx: RenderSeatContext | null = null;
  /** Custom renderer; when set it is used instead of `provider`. */
  private renderer?: SeatTooltipRenderFn;
  private rendered: RenderedContent | null = null;

  constructor(
    container: HTMLElement,
    provider?: SeatTooltipFetcher,
    debounceMs = 150,
    renderer?: SeatTooltipRenderFn
  ) {
    this.container = container;
    this.provider = provider;
    this.debounceMs = debounceMs;
    this.renderer = renderer;

    if (this.provider || this.renderer) {
      this.initDom();
    }
  }

  private initDom(): void {
    if (typeof document === 'undefined') return;

    this.tooltipEl = document.createElement('div');
    Object.assign(this.tooltipEl.style, {
      position: 'absolute',
      display: 'none',
      pointerEvents: 'none',
      zIndex: '9999',
      transition: 'opacity 0.15s ease, transform 0.15s ease',
      opacity: '0',
      transform: 'translateY(4px)',
    });
    this.applyLook();

    if (getComputedStyle(this.container).position === 'static') {
      this.container.style.position = 'relative';
    }

    this.container.appendChild(this.tooltipEl);
  }

  /** Custom content brings its own look; only the built-in one is styled. */
  private applyLook(): void {
    if (!this.tooltipEl) return;
    this.tooltipEl.className = this.renderer
      ? 'open-seats-tooltip open-seats-tooltip--custom'
      : 'open-seats-tooltip';
    for (const [key, value] of Object.entries(BUILT_IN_STYLE)) {
      this.tooltipEl.style.setProperty(
        key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
        this.renderer ? '' : value
      );
    }
  }

  /**
   * Replaces the custom renderer (`undefined` goes back to the provider). Any
   * shown tooltip is removed at once.
   */
  public setRenderer(renderer?: SeatTooltipRenderFn): void {
    if (renderer === this.renderer) return;
    this.reset();
    this.renderer = renderer;
    if (!this.tooltipEl && (this.provider || this.renderer)) {
      this.initDom();
    } else {
      this.applyLook();
    }
  }

  public show(ctx: RenderSeatContext, evt: MouseEvent): void {
    if (!this.tooltipEl || (!this.provider && !this.renderer)) return;

    this.currentSeatId = ctx.seat.id;
    this.currentCtx = ctx;
    this.position(evt);

    if (this.renderer) {
      const rendered = this.rendered;
      if (rendered && rendered.seatId === ctx.seat.id && !rendered.stale) {
        this.cancelDebounce();
        this.visible(true);
        return;
      }
      this.debounce(ctx, () => this.renderCustom(ctx));
      return;
    }

    // Check cache
    const cached = this.cache.get(ctx.seat.id);
    if (cached) {
      this.cancelDebounce();
      this.renderContent(cached);
      this.visible(true);
      return;
    }

    this.debounce(ctx, () => void this.fetch(ctx));
  }

  private debounce(ctx: RenderSeatContext, run: () => void): void {
    this.cancelDebounce();
    this.pendingSeatId = ctx.seat.id;
    this.activeTimeout = setTimeout(() => {
      this.activeTimeout = null;
      this.pendingSeatId = null;
      if (this.currentSeatId !== ctx.seat.id) return;
      run();
    }, this.debounceMs);
  }

  private cancelDebounce(): void {
    if (this.activeTimeout) clearTimeout(this.activeTimeout);
    this.activeTimeout = null;
    this.pendingSeatId = null;
  }

  /** Replaces the tooltip content with the custom renderer's output. */
  private renderCustom(ctx: RenderSeatContext): void {
    if (!this.renderer || !this.tooltipEl) return;
    this.clearCustom();
    try {
      const result = this.renderer(ctx, this.tooltipEl);
      this.rendered = {
        seatId: ctx.seat.id,
        stale: false,
        ...(typeof result === 'function'
          ? { destroy: result }
          : { update: result?.update, destroy: result?.destroy }),
      };
      this.visible(true);
    } catch (err) {
      console.error('[OpenSeats] Tooltip renderer error:', err);
    }
  }

  /** Refreshes the shown custom content in place when it can, else re-renders. */
  private refreshCustom(
    ctx: RenderSeatContext,
    rendered: RenderedContent
  ): void {
    if (!rendered.update) {
      this.renderCustom(ctx);
      return;
    }
    try {
      rendered.update(ctx);
    } catch (err) {
      console.error('[OpenSeats] Tooltip renderer update error:', err);
    }
  }

  private clearCustom(): void {
    const rendered = this.rendered;
    this.rendered = null;
    if (rendered?.destroy) {
      try {
        rendered.destroy();
      } catch (err) {
        console.error('[OpenSeats] Tooltip renderer cleanup error:', err);
      }
    }
    if (rendered && this.tooltipEl) this.tooltipEl.textContent = '';
  }

  private async fetch(ctx: RenderSeatContext): Promise<void> {
    if (!this.provider) return;
    const seq = ++this.fetchSeq;
    try {
      const info = await this.provider(ctx);
      // A newer request (or a hide) superseded this one.
      if (seq !== this.fetchSeq || this.currentSeatId !== ctx.seat.id) return;
      if (info) {
        this.cache.set(ctx.seat.id, info);
        this.renderContent(info);
        this.visible(true);
      } else {
        this.visible(false);
      }
    } catch (err) {
      console.error('[OpenSeats] TooltipProvider error:', err);
    }
  }

  /**
   * Drops cached tooltips for the given seats (all seats when omitted). If the
   * tooltip is currently shown for one of them, it is refreshed.
   */
  public invalidate(seatIds?: Iterable<string>): void {
    const ids = seatIds ? new Set(seatIds) : null;
    const affected = (seatId: string) => !ids || ids.has(seatId);
    if (ids) {
      for (const id of ids) this.cache.delete(id);
    } else {
      this.cache.clear();
    }
    const ctx = this.currentCtx;

    if (this.renderer) {
      const rendered = this.rendered;
      if (!rendered || !affected(rendered.seatId)) return;
      if (ctx && ctx.seat.id === rendered.seatId) {
        this.refreshCustom(ctx, rendered);
      } else {
        // Fading out or kept for a quick return: render again when reused.
        rendered.stale = true;
      }
      return;
    }

    // A pending debounce for this seat fetches fresh data anyway.
    if (!ctx || !affected(ctx.seat.id) || this.pendingSeatId === ctx.seat.id) {
      return;
    }
    void this.fetch(ctx);
  }

  public position(evt: MouseEvent): void {
    if (!this.tooltipEl) return;

    const rect = this.container.getBoundingClientRect();
    const x = evt.clientX - rect.left + 12;
    const y = evt.clientY - rect.top - 12;

    this.tooltipEl.style.left = `${x}px`;
    this.tooltipEl.style.top = `${y}px`;
  }

  private renderContent(info: TooltipInfo): void {
    if (!this.tooltipEl) return;

    if (info.html) {
      this.tooltipEl.textContent = '';
      this.tooltipEl.appendChild(this.sanitizeHtml(info.html));
      return;
    }

    this.tooltipEl.textContent = '';

    if (info.title) {
      const titleEl = document.createElement('div');
      titleEl.style.fontWeight = '600';
      titleEl.style.marginBottom = '2px';
      titleEl.textContent = info.title;
      this.tooltipEl.appendChild(titleEl);
    }
    if (info.subtitle) {
      const subEl = document.createElement('div');
      subEl.style.color = '#a1a1aa';
      subEl.style.fontSize = '11px';
      subEl.textContent = info.subtitle;
      this.tooltipEl.appendChild(subEl);
    }
    if (info.content) {
      const contentEl = document.createElement('div');
      contentEl.style.marginTop = '4px';
      contentEl.textContent = info.content;
      this.tooltipEl.appendChild(contentEl);
    }
  }

  private sanitizeHtml(rawHtml: string): DocumentFragment {
    return DOMPurify.sanitize(rawHtml, {
      RETURN_DOM_FRAGMENT: true,
      FORBID_TAGS: ['style', 'form'],
    });
  }

  private visible(show: boolean): void {
    if (!this.tooltipEl) return;
    this.shown = show;
    if (show) {
      if (this.hideTimeout) clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
      this.tooltipEl.style.display = 'block';
      requestAnimationFrame(() => {
        if (this.tooltipEl && this.shown) {
          this.tooltipEl.style.opacity = '1';
          this.tooltipEl.style.transform = 'translateY(0)';
        }
      });
    } else {
      this.tooltipEl.style.opacity = '0';
      this.tooltipEl.style.transform = 'translateY(4px)';
      if (this.hideTimeout) clearTimeout(this.hideTimeout);
      this.hideTimeout = setTimeout(() => {
        this.hideTimeout = null;
        if (this.tooltipEl) this.tooltipEl.style.display = 'none';
        // Custom content is torn down once faded out, unless a seat is
        // hovered again (its own render replaces it).
        if (this.currentSeatId === null) this.clearCustom();
      }, FADE_MS);
    }
  }

  public hide(): void {
    this.currentSeatId = null;
    this.currentCtx = null;
    this.cancelDebounce();
    this.visible(false);
  }

  /** Hides at once, without the fade, and tears custom content down. */
  private reset(): void {
    this.currentSeatId = null;
    this.currentCtx = null;
    this.cancelDebounce();
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    this.hideTimeout = null;
    this.shown = false;
    this.clearCustom();
    if (this.tooltipEl) {
      this.tooltipEl.textContent = '';
      Object.assign(this.tooltipEl.style, {
        display: 'none',
        opacity: '0',
        transform: 'translateY(4px)',
      });
    }
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public destroy(): void {
    this.reset();
    this.clearCache();
    if (this.tooltipEl && this.tooltipEl.parentNode) {
      this.tooltipEl.parentNode.removeChild(this.tooltipEl);
    }
    this.tooltipEl = null;
  }
}
