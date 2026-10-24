import {
  canPlace,
  inverseTransformPoint,
  transformPoint,
  type Building,
  type Floorplan,
  type Row,
  type Seat,
  type Vec2,
} from '@open-seats/core';
import type { EditorContext } from './context';
import { NumberingService } from '../numbering/numbering-service';
import type { Command } from '../history/command-stack';

/** Row and seat editing: creation, seat counts, spacing, and moving seats between rows. */
export class RowOperations {
  constructor(private readonly ctx: EditorContext) {}

  public createRow(
    buildingId: string,
    position: Vec2,
    seatCount: number,
    opts?: {
      side?: 'one' | 'both';
      seatSpacing?: number;
      seatRadius?: number;
      tableWidth?: number;
      rotation?: number;
    }
  ): Row | null {
    const building = this.ctx.floorplan.buildings.find(
      (b) => b.id === buildingId
    );
    if (!building) return null;

    const id = NumberingService.nextRowId();
    const rowIndex = building.rows.length;
    const rowLetter = NumberingService.rowLabel(rowIndex);
    const side = opts?.side ?? 'both';
    const seatSpacing = opts?.seatSpacing ?? 40;
    const seatRadius = opts?.seatRadius ?? 14;
    const tableWidth = opts?.tableWidth ?? 28;
    const rotation = opts?.rotation ?? 0;
    const snappedPos = this.ctx.snap(position);

    const seats: Seat[] = [];
    const count = Math.max(1, seatCount);

    if (side === 'both') {
      const slots = Math.ceil(count / 2);
      let created = 0;
      for (let i = 0; i < slots; i++) {
        seats.push({
          id: NumberingService.nextSeatId(),
          index: i,
          side: 'a',
          label: `${rowLetter}-${i + 1}a`,
        });
        created++;
        if (created < count) {
          seats.push({
            id: NumberingService.nextSeatId(),
            index: i,
            side: 'b',
            label: `${rowLetter}-${i + 1}b`,
          });
          created++;
        }
      }
    } else {
      for (let i = 0; i < count; i++) {
        seats.push({
          id: NumberingService.nextSeatId(),
          index: i,
          side: 'a',
          label: `${rowLetter}-${i + 1}`,
        });
      }
    }

    const newRow: Row = {
      id,
      label: rowLetter,
      position: snappedPos,
      rotation,
      side,
      seatSpacing,
      seatRadius,
      tableWidth,
      seats,
    };

    if (this.ctx.rules.enforce) {
      const testPlan: Floorplan = {
        ...this.ctx.floorplan,
        buildings: this.ctx.floorplan.buildings.map((b) =>
          b.id === buildingId ? { ...b, rows: [...(b.rows ?? []), newRow] } : b
        ),
      };

      const violations = canPlace(
        testPlan,
        id,
        {},
        { tolerance: this.ctx.rules.tolerance }
      );
      if (violations.length > 0) {
        return null;
      }
    }

    const command: Command = {
      name: `Create Row ${rowLetter}`,
      execute: () => {
        building.rows.push(newRow);
      },
      undo: () => {
        const idx = building.rows.findIndex((r) => r.id === id);
        if (idx >= 0) building.rows.splice(idx, 1);
      },
    };

    this.ctx.commandStack.execute(command);
    this.ctx.emitChange();
    return newRow;
  }

  public addSeatToRow(
    buildingId: string,
    rowId: string,
    seatSide: 'a' | 'b' = 'a'
  ): Seat | null {
    const building = this.ctx.floorplan.buildings.find(
      (b) => b.id === buildingId
    );
    if (!building) return null;

    const row = building.rows.find((r) => r.id === rowId);
    if (!row) return null;

    if (row.side === 'one' && seatSide === 'b') {
      return null;
    }

    const currentMaxIndex =
      row.seats.length > 0 ? Math.max(...row.seats.map((s) => s.index)) : -1;

    // Check if slot on currentMaxIndex is free for requested side
    const slotFilled = row.seats.some(
      (s) => s.index === currentMaxIndex && s.side === seatSide
    );
    const newIndex = slotFilled
      ? currentMaxIndex + 1
      : Math.max(0, currentMaxIndex);

    const newSeat: Seat = {
      id: NumberingService.nextSeatId(),
      index: newIndex,
      side: seatSide,
      label: '', // will be renumbered
    };

    const proposedSeats = [...row.seats, newSeat];
    const renumbered = NumberingService.renumberRowSeats({
      ...row,
      seats: proposedSeats,
    });

    if (this.ctx.rules.enforce) {
      const violations = canPlace(
        this.ctx.floorplan,
        rowId,
        { seats: renumbered },
        { tolerance: this.ctx.rules.tolerance }
      );
      if (violations.length > 0) {
        return null;
      }
    }

    const oldSeats = [...row.seats];
    const command: Command = {
      name: `Add Seat to Row ${row.label}`,
      execute: () => {
        row.seats = renumbered;
      },
      undo: () => {
        row.seats = oldSeats;
      },
    };

    this.ctx.commandStack.execute(command);
    this.ctx.emitChange();
    return newSeat;
  }

  public reparentRow(
    rowId: string,
    targetBuildingId: string,
    dropWorldPosition?: Vec2
  ): boolean {
    let sourceBuilding: Building | undefined;
    let row: Row | undefined;

    for (const b of this.ctx.floorplan.buildings) {
      const r = (b.rows ?? []).find((item) => item.id === rowId);
      if (r) {
        sourceBuilding = b;
        row = r;
        break;
      }
    }

    if (!sourceBuilding || !row || sourceBuilding.id === targetBuildingId) {
      return false;
    }

    const srcBuilding = sourceBuilding;
    const movingRow = row;

    const targetBuilding = this.ctx.floorplan.buildings.find(
      (b) => b.id === targetBuildingId
    );
    if (!targetBuilding) return false;

    // Apply coordinate transform from source to world (or use dropWorldPosition), then world to target
    const worldPos =
      dropWorldPosition ??
      transformPoint(
        movingRow.position,
        srcBuilding.position,
        srcBuilding.rotation
      );
    const newLocalPos = inverseTransformPoint(
      worldPos,
      targetBuilding.position,
      targetBuilding.rotation
    );
    const newLocalRot =
      movingRow.rotation + srcBuilding.rotation - targetBuilding.rotation;

    const proposedRow: Row = {
      ...movingRow,
      position: this.ctx.snap(newLocalPos),
      rotation: newLocalRot,
    };

    if (this.ctx.rules.enforce) {
      // Test containment and overlap in target building
      const testPlan: Floorplan = {
        ...this.ctx.floorplan,
        buildings: this.ctx.floorplan.buildings.map((b) => {
          if (b.id === srcBuilding.id && b.id === targetBuildingId) {
            return {
              ...b,
              rows: [...b.rows.filter((r) => r.id !== rowId), proposedRow],
            };
          }
          if (b.id === srcBuilding.id) {
            return {
              ...b,
              rows: b.rows.filter((r) => r.id !== rowId),
            };
          }
          if (b.id === targetBuildingId) {
            return {
              ...b,
              rows: [...(b.rows ?? []), proposedRow],
            };
          }
          return b;
        }),
      };

      const violations = canPlace(
        testPlan,
        rowId,
        {},
        { tolerance: this.ctx.rules.tolerance }
      );
      if (violations.length > 0) {
        return false;
      }
    }

    const oldPos = movingRow.position;
    const oldRot = movingRow.rotation;

    const command: Command = {
      name: `Reparent Row ${movingRow.label} to ${targetBuilding.label}`,
      execute: () => {
        srcBuilding.rows = srcBuilding.rows.filter((r) => r.id !== rowId);
        movingRow.position = proposedRow.position;
        movingRow.rotation = proposedRow.rotation;
        targetBuilding.rows.push(movingRow);
      },
      undo: () => {
        targetBuilding.rows = targetBuilding.rows.filter((r) => r.id !== rowId);
        movingRow.position = oldPos;
        movingRow.rotation = oldRot;
        srcBuilding.rows.push(movingRow);
      },
    };

    this.ctx.commandStack.execute(command);
    this.ctx.emitChange();
    return true;
  }

  public addSeatOnCanvas(buildingId: string, position: Vec2): Row | null {
    return this.createRow(buildingId, position, 1, {
      side: 'one',
      tableWidth: 0,
    });
  }

  public moveSeatToRow(
    sourceRowId: string,
    seatId: string,
    targetRowId: string,
    targetSide: 'a' | 'b' = 'a'
  ): boolean {
    if (sourceRowId === targetRowId) return false;

    let sourceRow: Row | undefined;
    let targetRow: Row | undefined;

    for (const b of this.ctx.floorplan.buildings) {
      for (const r of b.rows ?? []) {
        if (r.id === sourceRowId) sourceRow = r;
        if (r.id === targetRowId) targetRow = r;
      }
    }

    if (!sourceRow || !targetRow) return false;
    if (targetRow.side === 'one' && targetSide === 'b') return false;

    const seatIdx = sourceRow.seats.findIndex((s) => s.id === seatId);
    if (seatIdx < 0) return false;

    const movedSeat = sourceRow.seats[seatIdx];

    const currentMaxIdx =
      targetRow.seats.length > 0
        ? Math.max(...targetRow.seats.map((s) => s.index))
        : -1;
    const slotFilled = targetRow.seats.some(
      (s) => s.index === currentMaxIdx && s.side === targetSide
    );
    const newIndex = slotFilled
      ? currentMaxIdx + 1
      : Math.max(0, currentMaxIdx);

    const proposedSeat: Seat = {
      ...movedSeat,
      index: newIndex,
      side: targetSide,
    };

    const proposedTargetSeats = NumberingService.renumberRowSeats({
      ...targetRow,
      seats: [...targetRow.seats, proposedSeat],
    });

    const proposedSourceSeats = NumberingService.renumberRowSeats({
      ...sourceRow,
      seats: sourceRow.seats.filter((s) => s.id !== seatId),
    });

    if (this.ctx.rules.enforce) {
      const violations = canPlace(
        this.ctx.floorplan,
        targetRowId,
        { seats: proposedTargetSeats },
        { tolerance: this.ctx.rules.tolerance }
      );
      if (violations.length > 0) return false;
    }

    const oldSourceSeats = [...sourceRow.seats];
    const oldTargetSeats = [...targetRow.seats];

    const srcRow = sourceRow;
    const dstRow = targetRow;

    this.ctx.commandStack.execute({
      name: `Move Seat ${movedSeat.label} to Row ${dstRow.label}`,
      execute: () => {
        srcRow.seats = proposedSourceSeats;
        dstRow.seats = proposedTargetSeats;
      },
      undo: () => {
        srcRow.seats = oldSourceSeats;
        dstRow.seats = oldTargetSeats;
      },
    });

    this.ctx.emitChange();
    return true;
  }

  public setRowSide(rowId: string, side: 'one' | 'both'): boolean {
    let targetRow: Row | undefined;
    for (const b of this.ctx.floorplan.buildings) {
      const r = (b.rows ?? []).find((row) => row.id === rowId);
      if (r) {
        targetRow = r;
        break;
      }
    }
    if (!targetRow || targetRow.side === side) return false;

    let proposedSeats = [...targetRow.seats];
    if (side === 'one') {
      proposedSeats = proposedSeats
        .filter((s) => s.side === 'a')
        .map((s, idx) => ({ ...s, index: idx }));
    }
    const renumbered = NumberingService.renumberRowSeats({
      ...targetRow,
      side,
      seats: proposedSeats,
    });

    if (this.ctx.rules.enforce) {
      const violations = canPlace(
        this.ctx.floorplan,
        rowId,
        { side, seats: renumbered },
        { tolerance: this.ctx.rules.tolerance }
      );
      if (violations.length > 0) return false;
    }

    const row = targetRow;
    const oldSide = row.side;
    const oldSeats = [...row.seats];

    this.ctx.commandStack.execute({
      name: `Set Row ${row.label} side to ${side}`,
      execute: () => {
        row.side = side;
        row.seats = renumbered;
      },
      undo: () => {
        row.side = oldSide;
        row.seats = oldSeats;
      },
    });

    this.ctx.emitChange();
    return true;
  }

  public setRowTableWidth(rowId: string, tableWidth: number): boolean {
    let targetRow: Row | undefined;
    for (const b of this.ctx.floorplan.buildings) {
      const r = (b.rows ?? []).find((row) => row.id === rowId);
      if (r) {
        targetRow = r;
        break;
      }
    }
    if (!targetRow || tableWidth < 0) return false;

    if (this.ctx.rules.enforce) {
      const violations = canPlace(
        this.ctx.floorplan,
        rowId,
        { tableWidth },
        { tolerance: this.ctx.rules.tolerance }
      );
      if (violations.length > 0) return false;
    }

    const row = targetRow;
    const oldWidth = row.tableWidth;
    this.ctx.commandStack.execute({
      name: `Set Row ${row.label} table width`,
      execute: () => {
        row.tableWidth = tableWidth;
      },
      undo: () => {
        row.tableWidth = oldWidth;
      },
    });

    this.ctx.emitChange();
    return true;
  }

  public setRowSeatSpacing(rowId: string, seatSpacing: number): boolean {
    let targetRow: Row | undefined;
    for (const b of this.ctx.floorplan.buildings) {
      const r = (b.rows ?? []).find((row) => row.id === rowId);
      if (r) {
        targetRow = r;
        break;
      }
    }
    if (!targetRow || seatSpacing < 2 * targetRow.seatRadius) return false;

    if (this.ctx.rules.enforce) {
      const violations = canPlace(
        this.ctx.floorplan,
        rowId,
        { seatSpacing },
        { tolerance: this.ctx.rules.tolerance }
      );
      if (violations.length > 0) {
        this.ctx.emitter.emit('violationsUpdated', violations);
        return false;
      }
    }

    const row = targetRow;
    const oldSpacing = row.seatSpacing;
    this.ctx.commandStack.execute({
      name: `Set Row ${row.label} seat spacing`,
      execute: () => {
        row.seatSpacing = seatSpacing;
      },
      undo: () => {
        row.seatSpacing = oldSpacing;
      },
    });

    this.ctx.emitChange();
    return true;
  }

  public setRowSeatRadius(rowId: string, seatRadius: number): boolean {
    if (seatRadius <= 0) return false;
    let targetRow: Row | undefined;
    for (const b of this.ctx.floorplan.buildings) {
      const r = (b.rows ?? []).find((item) => item.id === rowId);
      if (r) {
        targetRow = r;
        break;
      }
    }
    if (!targetRow || targetRow.seatSpacing < 2 * seatRadius) return false;

    if (this.ctx.rules.enforce) {
      const violations = canPlace(
        this.ctx.floorplan,
        rowId,
        { seatRadius },
        { tolerance: this.ctx.rules.tolerance }
      );
      if (violations.length > 0) return false;
    }

    const row = targetRow;
    const oldRadius = row.seatRadius;
    this.ctx.commandStack.execute({
      name: `Set Row ${row.label} seat radius`,
      execute: () => {
        row.seatRadius = seatRadius;
      },
      undo: () => {
        row.seatRadius = oldRadius;
      },
    });

    this.ctx.emitChange();
    return true;
  }

  public setRowSeatCount(rowId: string, seatCount: number): boolean {
    if (seatCount < 1) return false;
    let targetRow: Row | undefined;
    for (const b of this.ctx.floorplan.buildings) {
      const r = (b.rows ?? []).find((item) => item.id === rowId);
      if (r) {
        targetRow = r;
        break;
      }
    }
    if (!targetRow) return false;
    if (targetRow.seats.length === seatCount) return true;

    const oldSeats = [...targetRow.seats];
    const side = targetRow.side;
    let proposedSeats: Seat[] = [];

    if (seatCount > targetRow.seats.length) {
      proposedSeats = [...targetRow.seats];
      const needed = seatCount - targetRow.seats.length;

      if (side === 'both') {
        let currentMaxIdx =
          proposedSeats.length > 0
            ? Math.max(...proposedSeats.map((s) => s.index))
            : -1;
        for (let i = 0; i < needed; i++) {
          const hasA = proposedSeats.some(
            (s) => s.index === currentMaxIdx && s.side === 'a'
          );
          const hasB = proposedSeats.some(
            (s) => s.index === currentMaxIdx && s.side === 'b'
          );

          let targetSide: 'a' | 'b' = 'a';
          let targetIndex = currentMaxIdx;

          if (!hasA) {
            targetSide = 'a';
          } else if (!hasB) {
            targetSide = 'b';
          } else {
            currentMaxIdx++;
            targetIndex = currentMaxIdx;
            targetSide = 'a';
          }

          proposedSeats.push({
            id: NumberingService.nextSeatId(),
            index: targetIndex,
            side: targetSide,
            label: '',
          });
        }
      } else {
        const currentMaxIdx =
          proposedSeats.length > 0
            ? Math.max(...proposedSeats.map((s) => s.index))
            : -1;
        for (let i = 0; i < needed; i++) {
          proposedSeats.push({
            id: NumberingService.nextSeatId(),
            index: currentMaxIdx + 1 + i,
            side: 'a',
            label: '',
          });
        }
      }
    } else {
      const sorted = [...targetRow.seats].sort((a, b) => {
        if (b.index !== a.index) return b.index - a.index;
        return b.side.localeCompare(a.side);
      });
      proposedSeats = sorted.slice(sorted.length - seatCount);
    }

    const renumbered = NumberingService.renumberRowSeats({
      ...targetRow,
      seats: proposedSeats,
    });

    if (this.ctx.rules.enforce) {
      const violations = canPlace(
        this.ctx.floorplan,
        rowId,
        { seats: renumbered },
        { tolerance: this.ctx.rules.tolerance }
      );
      if (violations.length > 0) return false;
    }

    const row = targetRow;
    this.ctx.commandStack.execute({
      name: `Set Row ${row.label} seat count to ${seatCount}`,
      execute: () => {
        row.seats = renumbered;
      },
      undo: () => {
        row.seats = oldSeats;
      },
    });

    this.ctx.emitChange();
    return true;
  }
}
