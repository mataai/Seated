import { describe, expect, it, vi } from 'vitest';
import { FALLBACK_STATUS_STYLE, StatusRegistry } from '../src';

describe('StatusRegistry', () => {
  it('initializes with DEFAULT_STATUSES', () => {
    const registry = new StatusRegistry();
    expect(registry.has('available')).toBe(true);
    expect(registry.has('reserved')).toBe(true);
    expect(registry.has('locked')).toBe(true);
    expect(registry.get('available').selectable).toBe(true);
    expect(registry.get('reserved').selectable).toBe(false);
  });

  it('allows registering custom statuses', () => {
    const registry = new StatusRegistry();
    registry.register({
      key: 'vip',
      label: 'VIP Only',
      style: { fill: '#ffd700', stroke: '#b8860b' },
      selectable: true,
    });

    expect(registry.has('vip')).toBe(true);
    const vip = registry.get('vip');
    expect(vip.style.fill).toBe('#ffd700');
  });

  it('handles unknown status key by returning fallback and never throwing', () => {
    const registry = new StatusRegistry();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Intentionally suppressed for test
    });

    expect(() => {
      const def = registry.get('completely_unknown_key');
      expect(def).toBeDefined();
      expect(def.key).toBe('completely_unknown_key');
      expect(def.style.fill).toBe(FALLBACK_STATUS_STYLE.fill);
      expect(def.selectable).toBe(false);
    }).not.toThrow();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown seat status "completely_unknown_key"')
    );
    warnSpy.mockRestore();
  });
});
