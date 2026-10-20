import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Floorplan } from '@open-seats/core';
import { createEditor, type EditorInstance } from '../src';

describe('Editor (@open-seats/editor)', () => {
  let container: HTMLDivElement;
  let editor: EditorInstance | null = null;

  const initialPlan: Floorplan = {
    schemaVersion: 1,
    dimensions: { width: 1000, height: 800 },
    buildings: [
      {
        id: 'b-1',
        label: 'Main Building',
        position: { x: 50, y: 50 },
        rotation: 0,
        points: [
          { x: 0, y: 0 },
          { x: 500, y: 0 },
          { x: 500, y: 400 },
          { x: 0, y: 400 },
        ],
        zones: [],
        rows: [],
      },
      {
        id: 'b-2',
        label: 'Annex',
        position: { x: 600, y: 50 },
        rotation: 0,
        points: [
          { x: 0, y: 0 },
          { x: 300, y: 0 },
          { x: 300, y: 400 },
          { x: 0, y: 400 },
        ],
        zones: [],
        rows: [],
      },
    ],
  };

  beforeEach(() => {
    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 1000, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 800, configurable: true });
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (editor) {
      editor.destroy();
      editor = null;
    }
    container.remove();
  });

  it('initializes with floorplan and supports tool switching', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    expect(editor.getFloorplan().buildings.length).toBe(2);
    expect(editor.getTool()).toBe('select');

    editor.setTool('row');
    expect(editor.getTool()).toBe('row');
  });

  it('creates a row and supports undo/redo', () => {
    editor = createEditor(container, { floorplan: initialPlan });

    const newRow = editor.createRow('b-1', { x: 100, y: 100 }, 4);
    expect(newRow).toBeDefined();
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(1);
    expect(editor.canUndo()).toBe(true);

    // Undo
    expect(editor.undo()).toBe(true);
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(0);
    expect(editor.canRedo()).toBe(true);

    // Redo
    expect(editor.redo()).toBe(true);
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(1);
  });

  it('strictly enforces layout rules (rejects out-of-bounds row creation)', () => {
    editor = createEditor(container, { floorplan: initialPlan });

    // Try placing a row outside building b-1 bounds (e.g. at x = 490, y = 390)
    const invalidRow = editor.createRow('b-1', { x: 490, y: 390 }, 6);
    expect(invalidRow).toBeNull();
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(0);
  });

  it('adds a seat to a row with stable ID generation', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const row = editor.createRow('b-1', { x: 100, y: 100 }, 2)!;
    const initialSeatsCount = row.seats.length;
    const originalSeatId = row.seats[0].id;

    const addedSeat = editor.addSeatToRow('b-1', row.id, 'a');
    expect(addedSeat).toBeDefined();

    const updatedRow = editor.getFloorplan().buildings[0].rows[0];
    expect(updatedRow.seats.length).toBe(initialSeatsCount + 1);
    // Original seat ID must remain stable!
    expect(updatedRow.seats[0].id).toBe(originalSeatId);
  });

  it('reparents a row into another building with coordinate transformation', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const row = editor.createRow('b-1', { x: 100, y: 100 }, 2)!;
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(1);

    // Reparent row from b-1 to b-2 at drop position inside b-2
    const success = editor.reparentRow(row.id, 'b-2', { x: 700, y: 150 });
    expect(success).toBe(true);

    const plan = editor.getFloorplan();
    expect(plan.buildings[0].rows.length).toBe(0);
    expect(plan.buildings[1].rows.length).toBe(1);
    expect(plan.buildings[1].rows[0].id).toBe(row.id);
  });

  it('toggles preview mode embedding the viewer', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    expect(editor.isPreview()).toBe(false);

    editor.togglePreview(true);
    expect(editor.isPreview()).toBe(true);
    expect(container.querySelector('.open-seats-preview-viewer')).toBeDefined();

    editor.togglePreview(false);
    expect(editor.isPreview()).toBe(false);
  });

  it('supports grid snapping', () => {
    editor = createEditor(container, {
      floorplan: initialPlan,
      gridSnapping: { enabled: true, size: 20 },
    });

    const row = editor.createRow('b-1', { x: 103, y: 97 }, 2)!;
    expect(row.position.x).toBe(100);
    expect(row.position.y).toBe(100);
  });

  it('creates single-seat rows on canvas (lone seat = one-seat row)', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const singleSeatRow = editor.addSeatOnCanvas('b-1', { x: 200, y: 200 });

    expect(singleSeatRow).toBeDefined();
    expect(singleSeatRow?.seats.length).toBe(1);
    expect(singleSeatRow?.side).toBe('one');
    expect(singleSeatRow?.tableWidth).toBe(0);
  });

  it('moves a seat into another row preserving its id and renumbering', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const row1 = editor.createRow('b-1', { x: 80, y: 80 }, 2)!;
    const row2 = editor.createRow('b-1', { x: 80, y: 180 }, 2)!;

    const movingSeatId = row1.seats[1].id;
    const success = editor.moveSeatToRow(row1.id, movingSeatId, row2.id, 'a');
    expect(success).toBe(true);

    const plan = editor.getFloorplan();
    const updatedRow1 = plan.buildings[0].rows.find((r) => r.id === row1.id)!;
    const updatedRow2 = plan.buildings[0].rows.find((r) => r.id === row2.id)!;

    expect(updatedRow1.seats.length).toBe(1);
    expect(updatedRow2.seats.length).toBe(3);
    // Preserved seat ID
    expect(updatedRow2.seats.some((s) => s.id === movingSeatId)).toBe(true);

    // Undo restores original state
    editor.undo();
    const undonePlan = editor.getFloorplan();
    expect(undonePlan.buildings[0].rows[0].seats.length).toBe(2);
    expect(undonePlan.buildings[0].rows[1].seats.length).toBe(2);
  });

  it('edits polygon vertices: moveVertex, addVertex, and deleteVertex with 3-vertex floor', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const b1 = editor.getFloorplan().buildings[0];
    const initialPointsCount = b1.points.length;

    // Move vertex
    const moveOk = editor.moveVertex('b-1', 1, { x: 480, y: 0 });
    expect(moveOk).toBe(true);
    expect(editor.getFloorplan().buildings[0].points[1].x).toBe(480);

    // Add vertex on edge
    const addOk = editor.addVertex('b-1', 1, { x: 480, y: 200 });
    expect(addOk).toBe(true);
    expect(editor.getFloorplan().buildings[0].points.length).toBe(initialPointsCount + 1);

    // Delete vertex
    const deleteOk = editor.deleteVertex('b-1', 2);
    expect(deleteOk).toBe(true);
    expect(editor.getFloorplan().buildings[0].points.length).toBe(initialPointsCount);

    // Delete down to 3 vertices
    editor.deleteVertex('b-1', 0);
    expect(editor.getFloorplan().buildings[0].points.length).toBe(3);

    // Cannot delete when at 3 vertices (polygons require >= 3 vertices)
    const rejectDelete = editor.deleteVertex('b-1', 0);
    expect(rejectDelete).toBe(false);
    expect(editor.getFloorplan().buildings[0].points.length).toBe(3);
  });

  it('toggles row side and updates table width with validation', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const row = editor.createRow('b-1', { x: 100, y: 100 }, 4, { side: 'both', tableWidth: 30 })!;

    // Toggle side to 'one'
    const sideOk = editor.setRowSide(row.id, 'one');
    expect(sideOk).toBe(true);
    expect(editor.getFloorplan().buildings[0].rows[0].side).toBe('one');

    // Update table width
    const widthOk = editor.setRowTableWidth(row.id, 40);
    expect(widthOk).toBe(true);
    expect(editor.getFloorplan().buildings[0].rows[0].tableWidth).toBe(40);
  });

  it('handles keyboard shortcuts for undo, redo, and delete', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const row = editor.createRow('b-1', { x: 100, y: 100 }, 2)!;
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(1);

    // Ctrl+Z -> Undo
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(0);

    // Ctrl+Y -> Redo
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }));
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(1);

    // Select row and press Delete
    editor.selectNodes([row.id]);
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(0);
  });
});

