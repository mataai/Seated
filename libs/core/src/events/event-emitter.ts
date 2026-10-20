export type Listener<T> = (payload: T) => void;
export type Unsubscribe = () => void;

export class TypedEventEmitter<EventMap extends object> {
  private listeners = new Map<
    keyof EventMap,
    Set<Listener<EventMap[keyof EventMap]>>
  >();

  public on<K extends keyof EventMap>(
    event: K,
    listener: Listener<EventMap[K]>
  ): Unsubscribe {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<EventMap[keyof EventMap]>);

    return () => {
      this.off(event, listener);
    };
  }

  public once<K extends keyof EventMap>(
    event: K,
    listener: Listener<EventMap[K]>
  ): Unsubscribe {
    const onceWrapper: Listener<EventMap[K]> = (payload: EventMap[K]) => {
      this.off(event, onceWrapper);
      listener(payload);
    };

    return this.on(event, onceWrapper);
  }

  public off<K extends keyof EventMap>(
    event: K,
    listener: Listener<EventMap[K]>
  ): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener as Listener<EventMap[keyof EventMap]>);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;

    // Iterate over a shallow copy so listeners modifying the set during emit won't cause issues
    const copy = Array.from(set);
    for (const listener of copy) {
      (listener as Listener<EventMap[K]>)(payload);
    }
  }

  public listenerCount<K extends keyof EventMap>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  public removeAllListeners(event?: keyof EventMap): void {
    if (event !== undefined) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
