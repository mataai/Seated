import type { RenderSeatContext, TooltipInfo, TooltipProvider } from './types';

export class TooltipManager {
  private container: HTMLElement;
  private tooltipEl: HTMLDivElement | null = null;
  private provider?: TooltipProvider;
  private debounceMs: number;
  private cache = new Map<string, TooltipInfo>();
  private activeTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentSeatId: string | null = null;

  constructor(
    container: HTMLElement,
    provider?: TooltipProvider,
    debounceMs = 150
  ) {
    this.container = container;
    this.provider = provider;
    this.debounceMs = debounceMs;

    if (this.provider) {
      this.initDom();
    }
  }

  private initDom(): void {
    if (typeof document === 'undefined') return;

    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'open-seats-tooltip';
    Object.assign(this.tooltipEl.style, {
      position: 'absolute',
      display: 'none',
      pointerEvents: 'none',
      zIndex: '9999',
      padding: '8px 12px',
      background: 'rgba(24, 24, 27, 0.92)',
      color: '#f4f4f5',
      fontSize: '13px',
      lineHeight: '1.4',
      borderRadius: '6px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(8px)',
      transition: 'opacity 0.15s ease, transform 0.15s ease',
      opacity: '0',
      transform: 'translateY(4px)',
    });

    if (getComputedStyle(this.container).position === 'static') {
      this.container.style.position = 'relative';
    }

    this.container.appendChild(this.tooltipEl);
  }

  public show(ctx: RenderSeatContext, evt: MouseEvent): void {
    if (!this.provider || !this.tooltipEl) return;

    this.currentSeatId = ctx.seat.id;
    this.position(evt);

    // Check cache
    const cached = this.cache.get(ctx.seat.id);
    if (cached) {
      this.renderContent(cached);
      this.visible(true);
      return;
    }

    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout);
    }

    this.activeTimeout = setTimeout(async () => {
      if (this.currentSeatId !== ctx.seat.id) return;

      try {
        const info = await this.provider!(ctx);
        if (info && this.currentSeatId === ctx.seat.id) {
          this.cache.set(ctx.seat.id, info);
          this.renderContent(info);
          this.visible(true);
        }
      } catch (err) {
        console.error('[OpenSeats] TooltipProvider error:', err);
      }
    }, this.debounceMs);
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
      this.tooltipEl.innerHTML = info.html;
      return;
    }

    let markup = '';
    if (info.title) {
      markup += `<div style="font-weight: 600; margin-bottom: 2px;">${info.title}</div>`;
    }
    if (info.subtitle) {
      markup += `<div style="color: #a1a1aa; font-size: 11px;">${info.subtitle}</div>`;
    }
    if (info.content) {
      markup += `<div style="margin-top: 4px;">${info.content}</div>`;
    }

    this.tooltipEl.innerHTML = markup;
  }

  private visible(show: boolean): void {
    if (!this.tooltipEl) return;
    if (show) {
      this.tooltipEl.style.display = 'block';
      requestAnimationFrame(() => {
        if (this.tooltipEl) {
          this.tooltipEl.style.opacity = '1';
          this.tooltipEl.style.transform = 'translateY(0)';
        }
      });
    } else {
      this.tooltipEl.style.opacity = '0';
      this.tooltipEl.style.transform = 'translateY(4px)';
      setTimeout(() => {
        if (this.tooltipEl && this.tooltipEl.style.opacity === '0') {
          this.tooltipEl.style.display = 'none';
        }
      }, 150);
    }
  }

  public hide(): void {
    this.currentSeatId = null;
    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout);
      this.activeTimeout = null;
    }
    this.visible(false);
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public destroy(): void {
    this.hide();
    this.clearCache();
    if (this.tooltipEl && this.tooltipEl.parentNode) {
      this.tooltipEl.parentNode.removeChild(this.tooltipEl);
    }
    this.tooltipEl = null;
  }
}
