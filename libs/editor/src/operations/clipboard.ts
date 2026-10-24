import {
  canPlace,
  polygonBoundingBox,
  type Building,
  type Floorplan,
  type Row,
  type Vec2,
  type Zone,
} from '@open-seats/core';
import type { EditorContext } from './context';
import { NumberingService } from '../numbering/numbering-service';

/** Copy, cut, paste and duplicate for buildings, zones and rows. */
export class ClipboardOperations {
  private clipboard:
    | { type: 'building'; data: Building }
    | { type: 'zone'; data: Zone }
    | { type: 'row'; data: Row }
    | null = null;

  constructor(private readonly ctx: EditorContext) {}

  // Context Actions: Copy, Cut, Paste, Duplicate, Flip
  public copySelection(): boolean {
    if (this.ctx.getSelectedNodeIds().length === 0) return false;
    const selectedId = this.ctx.getSelectedNodeIds()[0];

    const building = this.ctx.floorplan.buildings.find(
      (b) => b.id === selectedId
    );
    if (building) {
      this.clipboard = {
        type: 'building',
        data: structuredClone(building),
      };
      return true;
    }

    for (const b of this.ctx.floorplan.buildings) {
      const zone = (b.zones ?? []).find((z) => z.id === selectedId);
      if (zone) {
        this.clipboard = {
          type: 'zone',
          data: structuredClone(zone),
        };
        return true;
      }
      const row = (b.rows ?? []).find((r) => r.id === selectedId);
      if (row) {
        this.clipboard = {
          type: 'row',
          data: structuredClone(row),
        };
        return true;
      }
    }
    return false;
  }

  public cutSelection(): boolean {
    if (this.ctx.getSelectedNodeIds().length === 0) return false;
    const success = this.copySelection();
    if (!success) return false;

    const idsToDelete = [...this.ctx.getSelectedNodeIds()];
    this.ctx.batch(`Cut ${idsToDelete.length} items`, () => {
      for (const id of idsToDelete) {
        this.ctx.deleteNode(id);
      }
    });
    this.ctx.clearSelection();
    return true;
  }

  public canPaste(): boolean {
    return this.clipboard !== null;
  }

  private resolveTargetBuilding(
    targetBuildingId?: string
  ): Building | undefined {
    if (targetBuildingId) {
      const found = this.ctx.floorplan.buildings.find(
        (b) => b.id === targetBuildingId
      );
      if (found) return found;
    }

    if (this.ctx.getSelectedNodeIds().length > 0) {
      const selId = this.ctx.getSelectedNodeIds()[0];
      const selectedBuilding = this.ctx.floorplan.buildings.find(
        (b) => b.id === selId
      );
      if (selectedBuilding) return selectedBuilding;

      for (const building of this.ctx.floorplan.buildings) {
        if (
          building.zones.some((z) => z.id === selId) ||
          building.rows.some((r) => r.id === selId)
        ) {
          return building;
        }
      }
    }

    return this.ctx.floorplan.buildings[0];
  }

  private pasteBuilding(original: Building, offset: Vec2): boolean {
    const newId = NumberingService.nextBuildingId();
    const bbox = polygonBoundingBox(original.points);
    const bWidth = Math.round(bbox.width || 200);
    const bHeight = Math.round(bbox.height || 200);

    const newBuildingTemplate: Building = {
      ...original,
      id: newId,
      label: `${original.label} Copy`,
      position: { ...original.position },
      points: original.points.map((p) => ({ ...p })),
      zones: original.zones.map((z) => ({
        ...z,
        id: NumberingService.nextZoneId(),
        points: z.points.map((p) => ({ ...p })),
        position: { ...z.position },
      })),
      rows: original.rows.map((r) => {
        const newRow: Row = {
          ...r,
          id: NumberingService.nextRowId(),
          position: { ...r.position },
          seats: r.seats.map((s) => ({
            ...s,
            id: NumberingService.nextSeatId(),
          })),
        };
        newRow.seats = NumberingService.renumberRowSeats(newRow);
        return newRow;
      }),
    };

    const candidateOffsets: Vec2[] = [
      offset,
      { x: 0, y: 0 },
      { x: bWidth + 40, y: 0 },
      { x: 0, y: bHeight + 40 },
      { x: -(bWidth + 40), y: 0 },
      { x: 0, y: -(bHeight + 40) },
      { x: bWidth + 40, y: bHeight + 40 },
      { x: 40, y: 40 },
      { x: 80, y: 80 },
    ];

    let placedBuilding: Building | null = null;
    for (const cand of candidateOffsets) {
      const newPos = this.ctx.snap({
        x: original.position.x + cand.x,
        y: original.position.y + cand.y,
      });
      const candidateBuilding: Building = {
        ...newBuildingTemplate,
        position: newPos,
      };

      if (!this.ctx.rules.enforce) {
        placedBuilding = candidateBuilding;
        break;
      }

      const testPlan: Floorplan = {
        ...this.ctx.floorplan,
        buildings: [...this.ctx.floorplan.buildings, candidateBuilding],
      };
      const violations = canPlace(
        testPlan,
        newId,
        {},
        { tolerance: this.ctx.rules.tolerance }
      );
      if (violations.length === 0) {
        placedBuilding = candidateBuilding;
        break;
      }
    }

    if (!placedBuilding) return false;

    const finalBuilding = placedBuilding;
    this.ctx.commandStack.execute({
      name: `Paste Building ${finalBuilding.label}`,
      execute: () => {
        this.ctx.floorplan.buildings.push(finalBuilding);
      },
      undo: () => {
        const idx = this.ctx.floorplan.buildings.findIndex(
          (b) => b.id === newId
        );
        if (idx >= 0) this.ctx.floorplan.buildings.splice(idx, 1);
      },
    });
    this.ctx.emitChange();
    this.ctx.selectNodes([newId]);
    return true;
  }

  private pasteZone(
    original: Zone,
    targetBuilding: Building,
    offset: Vec2
  ): boolean {
    const newId = NumberingService.nextZoneId();
    const bbox = polygonBoundingBox(original.points);
    const zWidth = Math.round(bbox.width || 120);
    const zHeight = Math.round(bbox.height || 80);

    const newZoneTemplate: Zone = {
      ...original,
      id: newId,
      position: { ...original.position },
      points: original.points.map((p) => ({ ...p })),
    };

    const candidateOffsets: Vec2[] = [
      offset,
      { x: 0, y: 0 },
      { x: 0, y: zHeight + 20 },
      { x: zWidth + 20, y: 0 },
      { x: -(zWidth + 20), y: 0 },
      { x: 0, y: -(zHeight + 20) },
      { x: zWidth + 20, y: zHeight + 20 },
      { x: 30, y: 30 },
      { x: 60, y: 60 },
    ];

    let placedZone: Zone | null = null;
    for (const cand of candidateOffsets) {
      const newPos = this.ctx.snap({
        x: original.position.x + cand.x,
        y: original.position.y + cand.y,
      });
      const candidateZone: Zone = { ...newZoneTemplate, position: newPos };

      if (!this.ctx.rules.enforce) {
        placedZone = candidateZone;
        break;
      }

      const testPlan: Floorplan = {
        ...this.ctx.floorplan,
        buildings: this.ctx.floorplan.buildings.map((b) =>
          b.id === targetBuilding.id
            ? { ...b, zones: [...(b.zones ?? []), candidateZone] }
            : b
        ),
      };
      const violations = canPlace(
        testPlan,
        newId,
        {},
        { tolerance: this.ctx.rules.tolerance }
      );
      if (violations.length === 0) {
        placedZone = candidateZone;
        break;
      }
    }

    if (!placedZone) return false;

    const finalZone = placedZone;
    this.ctx.commandStack.execute({
      name: `Paste Zone ${newId}`,
      execute: () => {
        targetBuilding.zones.push(finalZone);
      },
      undo: () => {
        const idx = targetBuilding.zones.findIndex((z) => z.id === newId);
        if (idx >= 0) targetBuilding.zones.splice(idx, 1);
      },
    });
    this.ctx.emitChange();
    this.ctx.selectNodes([newId]);
    return true;
  }

  private pasteRow(
    original: Row,
    targetBuilding: Building,
    offset: Vec2
  ): boolean {
    const newId = NumberingService.nextRowId();
    const nextLetter = NumberingService.rowLabel(targetBuilding.rows.length);

    const clonedSeats = original.seats.map((s) => ({
      ...s,
      id: NumberingService.nextSeatId(),
    }));

    const newRowTemplate: Row = {
      ...original,
      id: newId,
      label: nextLetter,
      seats: clonedSeats,
      position: { ...original.position },
    };
    newRowTemplate.seats = NumberingService.renumberRowSeats(newRowTemplate);

    const rowHeight =
      (original.tableWidth ?? 28) + (original.seatRadius ?? 14) * 4;
    const verticalStep = Math.max(70, Math.round(rowHeight + 10));

    const existingRows = targetBuilding.rows ?? [];
    const maxY =
      existingRows.length > 0
        ? Math.max(...existingRows.map((r) => r.position.y))
        : original.position.y;
    const minY =
      existingRows.length > 0
        ? Math.min(...existingRows.map((r) => r.position.y))
        : original.position.y;

    const candidatePositions: Vec2[] = [
      { x: original.position.x, y: maxY + verticalStep },
      { x: original.position.x + offset.x, y: original.position.y + offset.y },
      { x: original.position.x, y: original.position.y },
      { x: original.position.x, y: minY - verticalStep },
      { x: original.position.x, y: original.position.y + verticalStep },
      { x: original.position.x, y: original.position.y + verticalStep * 2 },
      { x: original.position.x, y: original.position.y + verticalStep * 3 },
      { x: original.position.x, y: original.position.y - verticalStep },
      { x: original.position.x, y: original.position.y - verticalStep * 2 },
      { x: original.position.x + 80, y: maxY + verticalStep },
      { x: original.position.x - 80, y: maxY + verticalStep },
    ];

    let placedRow: Row | null = null;
    for (const candPos of candidatePositions) {
      const snappedPos = this.ctx.snap(candPos);
      const candidateRow: Row = { ...newRowTemplate, position: snappedPos };

      if (!this.ctx.rules.enforce) {
        placedRow = candidateRow;
        break;
      }

      const testPlan: Floorplan = {
        ...this.ctx.floorplan,
        buildings: this.ctx.floorplan.buildings.map((b) =>
          b.id === targetBuilding.id
            ? { ...b, rows: [...(b.rows ?? []), candidateRow] }
            : b
        ),
      };
      const violations = canPlace(
        testPlan,
        newId,
        {},
        { tolerance: this.ctx.rules.tolerance }
      );
      if (violations.length === 0) {
        placedRow = candidateRow;
        break;
      }
    }

    if (!placedRow) return false;

    const finalRow = placedRow;
    this.ctx.commandStack.execute({
      name: `Paste Row ${nextLetter}`,
      execute: () => {
        targetBuilding.rows.push(finalRow);
      },
      undo: () => {
        const idx = targetBuilding.rows.findIndex((r) => r.id === newId);
        if (idx >= 0) targetBuilding.rows.splice(idx, 1);
      },
    });
    this.ctx.emitChange();
    this.ctx.selectNodes([newId]);
    return true;
  }

  public paste(
    targetBuildingId?: string,
    offset: Vec2 = { x: 30, y: 30 }
  ): boolean {
    if (!this.clipboard) return false;

    if (this.clipboard.type === 'building') {
      return this.pasteBuilding(this.clipboard.data, offset);
    }

    const targetBuilding = this.resolveTargetBuilding(targetBuildingId);
    if (!targetBuilding) return false;

    if (this.clipboard.type === 'zone') {
      return this.pasteZone(this.clipboard.data, targetBuilding, offset);
    }

    if (this.clipboard.type === 'row') {
      return this.pasteRow(this.clipboard.data, targetBuilding, offset);
    }

    return false;
  }

  public duplicateNode(nodeId: string): boolean {
    this.ctx.selectNodes([nodeId]);
    if (this.copySelection()) {
      return this.paste();
    }
    return false;
  }
}
