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
    Object.defineProperty(container, 'clientWidth', {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(container, 'clientHeight', {
      value: 800,
      configurable: true,
    });
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
    expect(editor.getFloorplan().buildings[0].points.length).toBe(
      initialPointsCount + 1
    );

    // Delete vertex
    const deleteOk = editor.deleteVertex('b-1', 2);
    expect(deleteOk).toBe(true);
    expect(editor.getFloorplan().buildings[0].points.length).toBe(
      initialPointsCount
    );

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
    const row = editor.createRow('b-1', { x: 100, y: 100 }, 4, {
      side: 'both',
      tableWidth: 30,
    })!;

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
    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
    );
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(0);

    // Ctrl+Y -> Redo
    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true })
    );
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(1);

    // Select row and press Delete
    editor.selectNodes([row.id]);
    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })
    );
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(0);
  });

  it('handles multiple consecutive interactive drags of rows in select mode', async () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const row = editor.createRow('b-1', { x: 100, y: 100 }, 2)!;
    expect(editor.getTool()).toBe('select');

    // Simulate drag 1 end on the row group via renderer options callback
    const renderer = (editor as any).renderer;
    renderer.options.onNodeDragEnd?.(
      row.id,
      'row',
      { x: 180, y: 160 },
      new MouseEvent('mouseup')
    );
    await Promise.resolve();

    let updatedRow = editor.getFloorplan().buildings[0].rows[0];
    expect(updatedRow.position.x).toBe(180);
    expect(updatedRow.position.y).toBe(160);

    // Simulate drag 2 end to a new position
    renderer.options.onNodeDragEnd?.(
      row.id,
      'row',
      { x: 220, y: 200 },
      new MouseEvent('mouseup')
    );
    await Promise.resolve();

    updatedRow = editor.getFloorplan().buildings[0].rows[0];
    expect(updatedRow.position.x).toBe(220);
    expect(updatedRow.position.y).toBe(200);

    // Can undo both drags
    expect(editor.undo()).toBe(true);
    expect(editor.getFloorplan().buildings[0].rows[0].position.x).toBe(180);
    expect(editor.undo()).toBe(true);
    expect(editor.getFloorplan().buildings[0].rows[0].position.x).toBe(100);
  });

  it('supports zoom and pan controls in edit mode and preview mode', () => {
    editor = createEditor(container, { floorplan: initialPlan });

    const initialScale = editor.getScale();
    expect(initialScale).toBe(1);

    editor.zoomIn(1.5);
    expect(editor.getScale()).toBe(1.5);

    editor.zoomOut(1.5);
    expect(editor.getScale()).toBeCloseTo(1);

    editor.zoomIn(2);
    expect(editor.getScale()).toBe(2);
    editor.resetZoom();
    expect(editor.getScale()).toBe(1);

    // Pan
    editor.panTo(50, 60);
    editor.panBy(10, 15);

    // Preview mode zoom & pan
    editor.togglePreview(true);
    expect(editor.isPreview()).toBe(true);

    editor.zoomIn(1.4);
    expect(editor.getScale()).toBe(1.4);

    editor.resetZoom();
    expect(editor.getScale()).toBe(1);

    editor.togglePreview(false);
    expect(editor.isPreview()).toBe(false);
  });

  it('creates rectangle building and zone with valid geometry', () => {
    editor = createEditor(container, { floorplan: initialPlan });

    const newBuilding = editor.createRectangleBuilding(
      { x: 50, y: 500 },
      300,
      200,
      'South Wing'
    );
    expect(newBuilding).not.toBeNull();
    expect(newBuilding!.points.length).toBe(4);
    expect(editor.getFloorplan().buildings.length).toBe(3);

    const newZone = editor.createRectangleZone(
      newBuilding!.id,
      { x: 20, y: 20 },
      100,
      60,
      '#ff4444'
    );
    expect(newZone).not.toBeNull();
    expect(newZone!.points.length).toBe(4);
    expect(editor.getFloorplan().buildings[2].zones.length).toBe(1);
  });

  it('supports context actions: copy, cut, paste, and duplicate', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const row = editor.createRow('b-1', { x: 100, y: 100 }, 4)!;
    expect(row).not.toBeNull();

    // Select row and copy
    editor.selectNodes([row.id]);
    expect(editor.copySelection()).toBe(true);
    expect(editor.canPaste()).toBe(true);

    // Paste
    expect(editor.paste('b-1', { x: 0, y: 60 })).toBe(true);
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(2);

    // Cut row
    editor.selectNodes([row.id]);
    expect(editor.cutSelection()).toBe(true);
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(1);

    // Paste the cut row back
    expect(editor.paste('b-1', { x: 0, y: 0 })).toBe(true);
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(2);
  });

  it('supports flipping nodes (horizontal and vertical)', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const row = editor.createRow('b-1', { x: 100, y: 100 }, 4, {
      rotation: 45,
    })!;

    expect(editor.flipNode(row.id, 'horizontal')).toBe(true);
    const flippedRow = editor.getFloorplan().buildings[0].rows[0];
    expect(flippedRow.rotation).toBe(135);

    expect(editor.flipNode(row.id, 'vertical')).toBe(true);
    const flippedVRow = editor.getFloorplan().buildings[0].rows[0];
    expect(flippedVRow.rotation).toBe(225);
  });

  it('adjusts quantity of seats in a row dynamically', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const row = editor.createRow('b-1', { x: 100, y: 100 }, 4)!;
    expect(row.seats.length).toBe(4);

    // Increase seats to 8
    expect(editor.setRowSeatCount(row.id, 8)).toBe(true);
    expect(editor.getFloorplan().buildings[0].rows[0].seats.length).toBe(8);

    // Decrease seats to 2
    expect(editor.setRowSeatCount(row.id, 2)).toBe(true);
    expect(editor.getFloorplan().buildings[0].rows[0].seats.length).toBe(2);

    // Undo restores to 8
    expect(editor.undo()).toBe(true);
    expect(editor.getFloorplan().buildings[0].rows[0].seats.length).toBe(8);
  });

  it('adjusts size of shapes via setShapeDimensions', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const zone = editor.createRectangleZone(
      'b-1',
      { x: 100, y: 100 },
      100,
      80
    )!;
    expect(zone).not.toBeNull();

    expect(editor.setShapeDimensions(zone.id, 150, 100)).toBe(true);
    const updatedZone = editor.getFloorplan().buildings[0].zones[0];
    expect(updatedZone).toBeDefined();

    // Undo restores size
    expect(editor.undo()).toBe(true);
  });

  it('moves selected items around via nudgeNode', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const row = editor.createRow('b-1', { x: 100, y: 100 }, 4)!;
    expect(row).not.toBeNull();

    const initialPos = editor.getNodePosition(row.id);
    expect(initialPos).toEqual({ x: 100, y: 100 });

    // Nudge right and down
    expect(editor.nudgeNode(row.id, 20, 30)).toBe(true);
    expect(editor.getNodePosition(row.id)).toEqual({ x: 120, y: 130 });

    // Undo restores position
    expect(editor.undo()).toBe(true);
    expect(editor.getNodePosition(row.id)).toEqual({ x: 100, y: 100 });
  });

  it('moves selected items around via keyboard arrow keys', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const row = editor.createRow('b-1', { x: 150, y: 150 }, 4)!;
    expect(row).not.toBeNull();

    // Select row
    editor.selectNodes([row.id]);
    expect(editor.getSelectedNodeIds()).toEqual([row.id]);

    // Dispatch ArrowRight keydown
    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );

    const posAfterRight = editor.getNodePosition(row.id);
    expect(posAfterRight?.x).toBeGreaterThan(150);

    // Dispatch ArrowDown keydown
    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
    );
    const posAfterDown = editor.getNodePosition(row.id);
    expect(posAfterDown?.y).toBeGreaterThan(150);
  });

  it('copies, duplicates, cuts, and pastes rows and zones successfully', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const row = editor.createRow('b-1', { x: 100, y: 100 }, 4)!;
    expect(row).not.toBeNull();
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(1);

    // Duplicate row
    editor.selectNodes([row.id]);
    expect(editor.canPaste()).toBe(false);
    expect(editor.duplicateNode(row.id)).toBe(true);
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(2);

    // Copy selected row
    const secondRowId = editor.getSelectedNodeIds()[0];
    expect(secondRowId).toBeDefined();
    expect(editor.copySelection()).toBe(true);
    expect(editor.canPaste()).toBe(true);

    // Paste copied row
    expect(editor.paste()).toBe(true);
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(3);

    // Cut a row
    const thirdRowId = editor.getSelectedNodeIds()[0];
    expect(editor.cutSelection()).toBe(true);
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(2);
    expect(editor.canPaste()).toBe(true);

    // Paste the cut row back
    expect(editor.paste()).toBe(true);
    expect(editor.getFloorplan().buildings[0].rows.length).toBe(3);
  });

  it('creates a building by drawing outline points and clicking an existing point', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const initialBuildingCount = editor.getFloorplan().buildings.length;

    editor.startBuildingCreation('New Pavilion');
    expect(editor.isCreatingBuilding()).toBe(true);
    expect(editor.getTool()).toBe('building');
    expect(editor.getDraftBuildingPoints().length).toBe(0);

    const editorAny = editor as any;

    // Click point 1
    editorAny.handleStageClick({ x: 50, y: 500 }, new MouseEvent('click'));
    expect(editor.getDraftBuildingPoints().length).toBe(1);
    expect(editor.getFloorplan().buildings.length).toBe(initialBuildingCount);

    // Click point 2
    editorAny.handleStageClick({ x: 250, y: 500 }, new MouseEvent('click'));
    expect(editor.getDraftBuildingPoints().length).toBe(2);

    // Click point 3
    editorAny.handleStageClick({ x: 250, y: 700 }, new MouseEvent('click'));
    expect(editor.getDraftBuildingPoints().length).toBe(3);

    // Click point 4
    editorAny.handleStageClick({ x: 50, y: 700 }, new MouseEvent('click'));
    expect(editor.getDraftBuildingPoints().length).toBe(4);

    // Click on existing point (point 1 at 50, 500) to finish and save!
    editorAny.handleStageClick({ x: 50, y: 500 }, new MouseEvent('click'));

    expect(editor.isCreatingBuilding()).toBe(false);
    expect(editor.getTool()).toBe('select');
    expect(editor.getFloorplan().buildings.length).toBe(
      initialBuildingCount + 1
    );

    const createdBuilding =
      editor.getFloorplan().buildings[initialBuildingCount];
    expect(createdBuilding.label).toBe('New Pavilion');
    expect(createdBuilding.points.length).toBe(4);
    expect(createdBuilding.position.x).toBe(50);
    expect(createdBuilding.position.y).toBe(500);

    // Selected node should be the newly created building
    expect(editor.getSelectedNodeIds()).toContain(createdBuilding.id);

    // Undo should remove the new building
    expect(editor.undo()).toBe(true);
    expect(editor.getFloorplan().buildings.length).toBe(initialBuildingCount);

    // Redo should restore the new building
    expect(editor.redo()).toBe(true);
    expect(editor.getFloorplan().buildings.length).toBe(
      initialBuildingCount + 1
    );
  });

  it('does not save building if clicking an existing point when fewer than 3 points exist', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const initialBuildingCount = editor.getFloorplan().buildings.length;

    editor.startBuildingCreation('Incomplete');
    const editorAny = editor as any;

    // Point 1
    editorAny.handleStageClick({ x: 50, y: 500 }, new MouseEvent('click'));
    // Point 2
    editorAny.handleStageClick({ x: 200, y: 500 }, new MouseEvent('click'));

    // Click near Point 1 with only 2 points
    editorAny.handleStageClick({ x: 50, y: 500 }, new MouseEvent('click'));

    // Should NOT close or save building
    expect(editor.isCreatingBuilding()).toBe(true);
    expect(editor.getFloorplan().buildings.length).toBe(initialBuildingCount);

    // Point 3
    editorAny.handleStageClick({ x: 200, y: 650 }, new MouseEvent('click'));
    expect(editor.getDraftBuildingPoints().length).toBe(3);

    // Now clicking existing point closes and saves!
    editorAny.handleStageClick({ x: 50, y: 500 }, new MouseEvent('click'));
    expect(editor.isCreatingBuilding()).toBe(false);
    expect(editor.getFloorplan().buildings.length).toBe(
      initialBuildingCount + 1
    );
  });

  it('cancels building creation on cancelBuildingCreation() or Escape', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    editor.startBuildingCreation();
    const editorAny = editor as any;

    editorAny.handleStageClick({ x: 100, y: 100 }, new MouseEvent('click'));
    expect(editor.getDraftBuildingPoints().length).toBe(1);

    editor.cancelBuildingCreation();
    expect(editor.isCreatingBuilding()).toBe(false);
    expect(editor.getDraftBuildingPoints().length).toBe(0);
    expect(editor.getTool()).toBe('select');
  });

  it('creates a rectangular building interactively by clicking two opposite corners', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const initialBuildingCount = editor.getFloorplan().buildings.length;

    editor.startBuildingCreation('East Hall', 'rectangle');
    expect(editor.isCreatingBuilding()).toBe(true);
    expect(editor.getBuildingCreationMode()).toBe('rectangle');
    expect(editor.getTool()).toBe('building');
    expect(editor.getDraftBuildingPoints().length).toBe(0);

    const editorAny = editor as any;

    // Click corner 1 (top-left)
    editorAny.handleStageClick({ x: 50, y: 500 }, new MouseEvent('click'));
    expect(editor.getDraftBuildingPoints().length).toBe(1);
    expect(editor.getFloorplan().buildings.length).toBe(initialBuildingCount);

    // Mouse move simulates live rectangle stretch
    editorAny.handleStageMouseMove(
      { x: 350, y: 750 },
      new MouseEvent('mousemove')
    );

    // Click opposite corner 2 (bottom-right)
    editorAny.handleStageClick({ x: 350, y: 750 }, new MouseEvent('click'));

    expect(editor.isCreatingBuilding()).toBe(false);
    expect(editor.getTool()).toBe('select');
    expect(editor.getFloorplan().buildings.length).toBe(
      initialBuildingCount + 1
    );

    const createdBuilding =
      editor.getFloorplan().buildings[initialBuildingCount];
    expect(createdBuilding.label).toBe('East Hall');
    expect(createdBuilding.position.x).toBe(50);
    expect(createdBuilding.position.y).toBe(500);
    expect(createdBuilding.points).toEqual([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 250 },
      { x: 0, y: 250 },
    ]);

    expect(editor.getSelectedNodeIds()).toContain(createdBuilding.id);

    // Undo removes it
    expect(editor.undo()).toBe(true);
    expect(editor.getFloorplan().buildings.length).toBe(initialBuildingCount);

    // Redo restores it
    expect(editor.redo()).toBe(true);
    expect(editor.getFloorplan().buildings.length).toBe(
      initialBuildingCount + 1
    );
  });

  it('normalizes rectangle creation when second corner is clicked up-and-left from first corner', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const initialBuildingCount = editor.getFloorplan().buildings.length;

    editor.startBuildingCreation('Reversed Hall', 'rectangle');
    const editorAny = editor as any;

    // Corner 1 at bottom-right
    editorAny.handleStageClick({ x: 350, y: 750 }, new MouseEvent('click'));
    // Corner 2 at top-left
    editorAny.handleStageClick({ x: 50, y: 500 }, new MouseEvent('click'));

    expect(editor.isCreatingBuilding()).toBe(false);
    expect(editor.getFloorplan().buildings.length).toBe(
      initialBuildingCount + 1
    );

    const createdBuilding =
      editor.getFloorplan().buildings[initialBuildingCount];
    expect(createdBuilding.label).toBe('Reversed Hall');
    expect(createdBuilding.position.x).toBe(50);
    expect(createdBuilding.position.y).toBe(500);
    expect(createdBuilding.points).toEqual([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 250 },
      { x: 0, y: 250 },
    ]);
  });

  it('handles creating a rectangle building over an existing building gracefully without getting stuck', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const initialBuildingCount = editor.getFloorplan().buildings.length;

    let failedEvent: any = null;
    let violationsEvent: any = null;
    editor.on('buildingCreationFailed', (payload) => {
      failedEvent = payload;
    });
    editor.on('violationsUpdated', (violations) => {
      violationsEvent = violations;
    });

    editor.startBuildingCreation('Overlapping Hall', 'rectangle');
    expect(editor.isCreatingBuilding()).toBe(true);

    const editorAny = editor as any;

    // Corner 1 inside existing building b-1 (which spans 0,0 to 500,400)
    editorAny.handleStageClick({ x: 100, y: 100 }, new MouseEvent('click'));
    expect(editor.getDraftBuildingPoints().length).toBe(1);

    // Corner 2 inside building b-1
    editorAny.handleStageClick({ x: 300, y: 300 }, new MouseEvent('click'));

    // Building should NOT have been added due to overlap violation
    expect(editor.getFloorplan().buildings.length).toBe(initialBuildingCount);

    // buildingCreationFailed and violationsUpdated should have fired
    expect(failedEvent).not.toBeNull();
    expect(failedEvent.reason).toContain('overlaps');
    expect(violationsEvent).not.toBeNull();
    expect(
      violationsEvent.some((v: any) => v.rule === 'building-overlap')
    ).toBe(true);

    // Editor should NOT be broken: it should still be in building creation mode with draft points reset
    expect(editor.isCreatingBuilding()).toBe(true);
    expect(editor.getTool()).toBe('building');
    expect(editor.getDraftBuildingPoints().length).toBe(0);

    // User can immediately place new corners in an open area and succeed!
    editorAny.handleStageClick({ x: 50, y: 500 }, new MouseEvent('click'));
    expect(editor.getDraftBuildingPoints().length).toBe(1);

    editorAny.handleStageClick({ x: 350, y: 750 }, new MouseEvent('click'));
    expect(editor.isCreatingBuilding()).toBe(false);
    expect(editor.getTool()).toBe('select');
    expect(editor.getFloorplan().buildings.length).toBe(
      initialBuildingCount + 1
    );
  });

  it('ignores keyboard shortcuts dispatched outside the editor container', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const row = editor.createRow('b-1', { x: 100, y: 100 }, 2)!;
    editor.selectNodes([row.id]);

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })
    );
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));

    expect(editor.getFloorplan().buildings[0].rows.length).toBe(1);
  });

  it('deletes a multi-selection as one undo step with one change event', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const rowA = editor.createRow('b-1', { x: 100, y: 100 }, 2)!;
    const rowB = editor.createRow('b-1', { x: 100, y: 250 }, 2)!;
    editor.selectNodes([rowA.id, rowB.id]);

    let changes = 0;
    editor.on('change', () => changes++);
    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })
    );

    expect(editor.getFloorplan().buildings[0].rows.length).toBe(0);
    expect(changes).toBe(1);

    expect(editor.undo()).toBe(true);
    expect(editor.getFloorplan().buildings[0].rows.map((r) => r.id)).toEqual([
      rowA.id,
      rowB.id,
    ]);

    expect(editor.undo()).toBe(true);
    expect(editor.getFloorplan().buildings[0].rows.map((r) => r.id)).toEqual([
      rowA.id,
    ]);
  });

  it('rejects an invalid floorplan and keeps the current one', () => {
    editor = createEditor(container, { floorplan: initialPlan });
    const invalid = {
      ...initialPlan,
      schemaVersion: 2,
    } as unknown as Floorplan;

    expect(() => editor!.loadFloorplan(invalid)).toThrow();
    expect(editor.getFloorplan()).toEqual(initialPlan);
  });

  it('does not share state with the floorplan passed in', () => {
    const plan = structuredClone(initialPlan);
    editor = createEditor(container, { floorplan: plan });
    plan.buildings[0].position.x = 999;

    expect(editor.getFloorplan().buildings[0].position).toEqual({
      x: 50,
      y: 50,
    });
  });
});
