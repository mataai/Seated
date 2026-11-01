import type { Building, Row, Seat } from '@open-seats/core';

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
   * Seat number within its row. One-sided rows count 1, 2, 3...
   * Double-sided rows put odd numbers on side "a" and even numbers on side
   * "b", so the seats facing each other at slot `i` are 2i+1 and 2i+2.
   */
  public static seatNumber(row: Pick<Row, 'side'>, seat: Seat): number {
    if (row.side !== 'both') return seat.index + 1;
    return seat.side === 'b' ? 2 * seat.index + 2 : 2 * seat.index + 1;
  }

  /** Formats a seat label as `<building>-<row>-<number>`. */
  public static seatLabel(
    buildingLabel: string | undefined,
    rowLabel: string | undefined,
    seatNumber: number
  ): string {
    return [buildingLabel, rowLabel || 'Row', String(seatNumber)]
      .filter((part) => part !== undefined && part !== '')
      .join('-');
  }

  /**
   * Renumbers seats along a row while strictly preserving existing seat IDs.
   * Format: `<building>-<row>-<number>`, e.g. "Main Hall-A-3".
   */
  public static renumberRowSeats(row: Row, buildingLabel?: string): Seat[] {
    return row.seats.map((seat) => ({
      ...seat,
      label: NumberingService.seatLabel(
        buildingLabel,
        row.label,
        NumberingService.seatNumber(row, seat)
      ),
    }));
  }

  /** Renumbers every row of a building (e.g. after a rename). */
  public static renumberBuildingSeats(building: Building): Row[] {
    return building.rows.map((row) => ({
      ...row,
      seats: NumberingService.renumberRowSeats(row, building.label),
    }));
  }

  /**
   * Creates a new unique seat ID.
   */
  public static nextSeatId(): string {
    const randomPart = Math.random().toString(36).substring(2, 9);
    const timePart = Date.now().toString(36);
    return `seat_${randomPart}_${timePart}`;
  }

  /**
   * Creates a new unique row ID.
   */
  public static nextRowId(): string {
    const randomPart = Math.random().toString(36).substring(2, 9);
    return `row_${randomPart}`;
  }

  /**
   * Creates a new unique building ID.
   */
  public static nextBuildingId(): string {
    const randomPart = Math.random().toString(36).substring(2, 9);
    return `bld_${randomPart}`;
  }

  /**
   * Creates a new unique zone ID.
   */
  public static nextZoneId(): string {
    const randomPart = Math.random().toString(36).substring(2, 9);
    return `zone_${randomPart}`;
  }
}
