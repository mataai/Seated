export interface SeatStatusStyle {
  fill: string;
  stroke?: string;
  opacity?: number;
  icon?: string;
}

export interface SeatStatusDefinition {
  key: string;
  label?: string;
  style: SeatStatusStyle;
  selectable: boolean;
  hoverable?: boolean;
}

export const DEFAULT_STATUSES: SeatStatusDefinition[] = [
  { key: 'available', style: { fill: '#4caf50' }, selectable: true },
  { key: 'reserved', style: { fill: '#9e9e9e' }, selectable: false },
  { key: 'locked', style: { fill: '#f44336' }, selectable: false },
];

export const FALLBACK_STATUS_STYLE: SeatStatusStyle = {
  fill: '#9e9e9e',
  stroke: '#616161',
  opacity: 0.8,
};

export class StatusRegistry {
  private registry = new Map<string, SeatStatusDefinition>();
  public defaultStatusKey: string;

  constructor(
    initialStatuses: SeatStatusDefinition[] = DEFAULT_STATUSES,
    defaultStatusKey = 'available'
  ) {
    this.defaultStatusKey = defaultStatusKey;
    this.registerMany(initialStatuses);
  }

  public register(def: SeatStatusDefinition): void {
    this.registry.set(def.key, { ...def });
  }

  public registerMany(defs: SeatStatusDefinition[]): void {
    for (const def of defs) {
      this.register(def);
    }
  }

  public has(key: string): boolean {
    return this.registry.has(key);
  }

  /**
   * Retrieves a seat status definition.
   * Unknown status keys return a fallback style and log a warning. Never throws.
   */
  public get(key: string): SeatStatusDefinition {
    const existing = this.registry.get(key);
    if (existing) {
      return existing;
    }

    console.warn(
      `[OpenSeats] Unknown seat status "${key}". Using fallback style.`
    );

    return {
      key,
      label: key,
      style: { ...FALLBACK_STATUS_STYLE },
      selectable: false,
      hoverable: false,
    };
  }

  public getAll(): SeatStatusDefinition[] {
    return Array.from(this.registry.values());
  }
}
