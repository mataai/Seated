import type { Row, Seat } from '@open-seats/core';

export class NumberingService {
  /**
   * Generates a row letter from an index: 0 -> "A", 25 -> "Z", 26 -> "AA"...
   */
  public static rowLabel(index: number): string {
    let label = '';
    let num = index;
    while (num >= 0) {
      label = String.fromCharCode(65 + (num % 26)) + label;
      num = Math.floor(num / 26) - 1;
    }
    return label;
  }

  /**
   * Renumbers seats along a row while strictly preserving existing seat IDs.
   * Format: e.g. "A-1", "A-2"... or "A-1a", "A-1b" if both sides.
   */
  public static renumberRowSeats(row: Row): Seat[] {
    const rowPrefix = row.label || 'Row';

    return row.seats.map((seat) => {
      let seatLabel = '';
      if (row.side === 'both') {
        seatLabel = `${rowPrefix}-${seat.index + 1}${seat.side}`;
      } else {
        seatLabel = `${rowPrefix}-${seat.index + 1}`;
      }

      return {
        ...seat,
        label: seatLabel,
      };
    });
  }

  /**
   * Creates a new unique seat ID.
   */
  public static nextSeatId(): string {
    return 'seat_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
  }

  /**
   * Creates a new unique row ID.
   */
  public static nextRowId(): string {
    return 'row_' + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Creates a new unique building ID.
   */
  public static nextBuildingId(): string {
    return 'bld_' + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Creates a new unique zone ID.
   */
  public static nextZoneId(): string {
    return 'zone_' + Math.random().toString(36).substring(2, 9);
  }
}
