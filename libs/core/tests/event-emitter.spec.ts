import { describe, expect, it, vi } from 'vitest';
import { TypedEventEmitter } from '../src';

interface TestEvents {
  seatSelected: { seatId: string };
  ready: void;
  count: number;
}

describe('TypedEventEmitter', () => {
  it('registers listener and receives emitted events', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const cb = vi.fn();

    emitter.on('seatSelected', cb);
    emitter.emit('seatSelected', { seatId: 's-1' });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ seatId: 's-1' });
  });

  it('unsubscribes using returned function and off()', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    const unsub = emitter.on('seatSelected', cb1);
    emitter.on('seatSelected', cb2);

    unsub();
    emitter.emit('seatSelected', { seatId: 's-1' });
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);

    emitter.off('seatSelected', cb2);
    emitter.emit('seatSelected', { seatId: 's-2' });
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('supports once() for single trigger', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const cb = vi.fn();

    emitter.once('count', cb);
    emitter.emit('count', 1);
    emitter.emit('count', 2);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(1);
    expect(emitter.listenerCount('count')).toBe(0);
  });
});
