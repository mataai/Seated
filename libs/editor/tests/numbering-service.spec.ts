import { describe, expect, it } from 'vitest';
import type { Row } from '@open-seats/core';
import { NumberingService } from '../src/numbering/numbering-service';

const baseRow = (side: 'one' | 'both', seats: Row['seats']): Row => ({
  id: 'r-1',
  label: 'B',
  position: { x: 0, y: 0 },
  rotation: 0,
  side,
  seatSpacing: 40,
  seatRadius: 14,
  tableWidth: 28,
  seats,
});

const seat = (index: number, side: 'a' | 'b') => ({
  id: `s-${index}${side}`,
  index,
  side,
  label: '',
});

describe('NumberingService', () => {
  it('labels one-sided rows <building>-<row>-<n> sequentially', () => {
    const row = baseRow('one', [seat(0, 'a'), seat(1, 'a'), seat(2, 'a')]);
    expect(
      NumberingService.renumberRowSeats(row, 'Hall').map((s) => s.label)
    ).toEqual(['Hall-B-1', 'Hall-B-2', 'Hall-B-3']);
  });

  it('numbers side a odd and side b even on double-sided tables, with no side suffix', () => {
    const row = baseRow('both', [
      seat(0, 'a'),
      seat(0, 'b'),
      seat(1, 'a'),
      seat(1, 'b'),
      seat(2, 'a'),
    ]);
    expect(
      NumberingService.renumberRowSeats(row, 'Hall').map((s) => s.label)
    ).toEqual(['Hall-B-1', 'Hall-B-2', 'Hall-B-3', 'Hall-B-4', 'Hall-B-5']);
  });

  it('omits the building part when there is no building label', () => {
    const row = baseRow('one', [seat(0, 'a')]);
    expect(NumberingService.renumberRowSeats(row)[0].label).toBe('B-1');
  });

  it('preserves seat ids', () => {
    const row = baseRow('both', [seat(0, 'a'), seat(0, 'b')]);
    expect(
      NumberingService.renumberRowSeats(row, 'Hall').map((s) => s.id)
    ).toEqual(['s-0a', 's-0b']);
  });
});
