import './test-setup';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { SeatsEditorComponent } from '../src/components/seats-editor.component';
import { SAMPLE_FLOORPLAN } from '@open-seats/core';

describe('SeatsEditorComponent', () => {
  let fixture: ComponentFixture<SeatsEditorComponent>;
  let component: SeatsEditorComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeatsEditorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SeatsEditorComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('initializes editor and sets tool', () => {
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.componentRef.setInput('tool', 'pan');
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(
      component
        .containerRef()
        .nativeElement.querySelector('.open-seats-editor-canvas')
    ).toBeTruthy();
  });

  it('switches tools and emits toolChange', () => {
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.detectChanges();

    let currentTool = '';
    component.toolChange.subscribe((t) => {
      currentTool = t;
    });

    component.setTool('building');
    expect(currentTool).toBe('building');
  });

  it('toggles preview mode and emits previewToggle', () => {
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.detectChanges();

    let previewState = false;
    component.previewToggle.subscribe((isPreview) => {
      previewState = isPreview;
    });

    const isPreview = component.togglePreview(true);
    expect(isPreview).toBe(true);
    expect(previewState).toBe(true);

    component.togglePreview(false);
    expect(previewState).toBe(false);
  });

  it('creates building and supports undo/redo', () => {
    fixture.componentRef.setInput('floorplan', {
      schemaVersion: 1,
      dimensions: { width: 1000, height: 1000 },
      buildings: [],
    });
    fixture.detectChanges();

    const newBuilding = component.createBuilding(
      [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 200 },
        { x: 0, y: 200 },
      ],
      'Building Alpha',
      { x: 50, y: 50 }
    );

    expect(newBuilding).toBeTruthy();
    expect(component.getFloorplan()?.buildings.length).toBe(1);

    expect(component.canUndo()).toBe(true);
    component.undo();
    expect(component.getFloorplan()?.buildings.length).toBe(0);

    expect(component.canRedo()).toBe(true);
    component.redo();
    expect(component.getFloorplan()?.buildings.length).toBe(1);
  });

  it('manages building drawing creation mode and updates state', () => {
    fixture.componentRef.setInput('floorplan', {
      schemaVersion: 1,
      dimensions: { width: 1000, height: 1000 },
      buildings: [],
    });
    fixture.detectChanges();

    expect(component.isDrawingBuilding).toBe(false);
    expect(component.draftPointsCount).toBe(0);

    component.startBuildingCreation('New Arena');
    fixture.detectChanges();

    expect(component.isDrawingBuilding).toBe(true);
    expect(component.currentTool).toBe('building');

    component.cancelBuildingCreation();
    fixture.detectChanges();

    expect(component.isDrawingBuilding).toBe(false);
    expect(component.currentTool).toBe('select');
  });

  it('updates buildingCreationError when buildingCreationFailed event is received', () => {
    fixture.componentRef.setInput('floorplan', {
      schemaVersion: 1,
      dimensions: { width: 1000, height: 1000 },
      buildings: [],
    });
    fixture.detectChanges();

    component.startBuildingCreation('New Arena');
    fixture.detectChanges();

    (component as any).editor?.emitter?.emit('buildingCreationFailed', {
      reason: 'Cannot create building: overlaps with an existing building.',
    });
    fixture.detectChanges();

    expect(component.buildingCreationError).toBe(
      'Cannot create building: overlaps with an existing building.'
    );

    component.cancelBuildingCreation();
    fixture.detectChanges();
    expect(component.buildingCreationError).toBeNull();
  });

  it('manages table drawing creation mode and updates state', () => {
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.detectChanges();

    expect(component.isDrawingRow).toBe(false);
    expect(component.draftRowPointsCount).toBe(0);

    component.startRowCreation();
    fixture.detectChanges();

    expect(component.isDrawingRow).toBe(true);
    expect(component.currentTool).toBe('row');

    component.cancelRowCreation();
    fixture.detectChanges();

    expect(component.isDrawingRow).toBe(false);
    expect(component.currentTool).toBe('select');
  });

  it('updates rowCreationError when rowCreationFailed event is received', () => {
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.detectChanges();

    component.startRowCreation();
    fixture.detectChanges();

    (component as any).editor?.emitter?.emit('rowCreationFailed', {
      reason: 'Click inside a building to place the table.',
    });
    fixture.detectChanges();

    expect(component.rowCreationError).toBe(
      'Click inside a building to place the table.'
    );

    component.cancelRowCreation();
    fixture.detectChanges();
    expect(component.rowCreationError).toBeNull();
  });

  it('initiates row creation without pre-defining a target building', () => {
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.detectChanges();

    const startRowCreationSpy = vi.spyOn(
      (component as any).editor,
      'startRowCreation'
    );

    component.startRowCreation();
    fixture.detectChanges();

    expect(startRowCreationSpy).toHaveBeenCalledWith({
      side: component.newRowSide,
      seatSpacing: component.newRowSeatSpacing,
      seatRadius: component.newRowSeatRadius,
      tableWidth: component.newRowTableWidth,
    });
  });

  it('switches tabs and synchronizes tab with tool selection', () => {
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.detectChanges();

    expect(component.editionsTab).toBe('buildings');

    component.switchEditionsTab('tables');
    expect(component.editionsTab).toBe('tables');

    component.startRowCreation();
    expect(component.isDrawingRow).toBe(true);

    // Switching away cancels active drawing
    component.switchEditionsTab('zones');
    expect(component.editionsTab).toBe('zones');
    expect(component.isDrawingRow).toBe(false);

    // Setting tool to building switches tab to buildings
    component.setTool('building');
    expect(component.editionsTab).toBe('buildings');
  });

  it('cancels active drawing when switching tools', () => {
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.detectChanges();

    component.startRowCreation();
    expect(component.isDrawingRow).toBe(true);

    component.setTool('select');
    expect(component.isDrawingRow).toBe(false);

    component.startBuildingCreation();
    expect(component.isDrawingBuilding).toBe(true);

    component.setTool('pan');
    expect(component.isDrawingBuilding).toBe(false);
  });

  it('normalizes "rows" tab to "tables"', () => {
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.detectChanges();

    component.switchEditionsTab('rows');
    expect(component.editionsTab).toBe('tables');
  });

  it('deletes selected item via deleteSelected and enables/disables delete button', () => {
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.detectChanges();

    const deleteBtn = fixture.nativeElement.querySelector('.delete-btn');
    expect(deleteBtn.disabled).toBe(true);

    const bId = SAMPLE_FLOORPLAN.buildings[0].id;
    component.selectNode(bId, 'building');
    fixture.detectChanges();

    expect(component.selectedNodeId).toBe(bId);
    expect(deleteBtn.disabled).toBe(false);

    const deleteSpy = vi.spyOn((component as any).editor, 'deleteNode');
    component.deleteSelected();
    expect(deleteSpy).toHaveBeenCalledWith(bId);
  });

  it('collapses and expands left and right panels', () => {
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.detectChanges();

    const leftSidebar =
      fixture.nativeElement.querySelector('.editor-left-panel');
    const rightSidebar = fixture.nativeElement.querySelector(
      '.editor-right-panel'
    );

    expect(leftSidebar.classList.contains('collapsed')).toBe(false);
    expect(rightSidebar.classList.contains('collapsed')).toBe(false);
    expect(
      fixture.nativeElement.querySelector('.canvas-panel-toggle.left-toggle')
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.canvas-panel-toggle.right-toggle')
    ).toBeNull();

    let leftCollapsedState: boolean | undefined;
    let rightCollapsedState: boolean | undefined;
    component.leftPanelCollapseChange.subscribe(
      (c) => (leftCollapsedState = c)
    );
    component.rightPanelCollapseChange.subscribe(
      (c) => (rightCollapsedState = c)
    );

    // Collapse left panel
    component.toggleLeftPanel();
    fixture.detectChanges();
    expect(component.isLeftPanelCollapsed).toBe(true);
    expect(leftCollapsedState).toBe(true);
    expect(leftSidebar.classList.contains('collapsed')).toBe(true);
    expect(
      fixture.nativeElement.querySelector('.canvas-panel-toggle.left-toggle')
    ).toBeTruthy();

    // Collapse right panel
    component.toggleRightPanel();
    fixture.detectChanges();
    expect(component.isRightPanelCollapsed).toBe(true);
    expect(rightCollapsedState).toBe(true);
    expect(rightSidebar.classList.contains('collapsed')).toBe(true);
    expect(
      fixture.nativeElement.querySelector('.canvas-panel-toggle.right-toggle')
    ).toBeTruthy();

    // Re-expand via clicking canvas docked toggles
    const leftDockBtn = fixture.nativeElement.querySelector(
      '.canvas-panel-toggle.left-toggle'
    );
    leftDockBtn.click();
    fixture.detectChanges();
    expect(component.isLeftPanelCollapsed).toBe(false);
    expect(leftCollapsedState).toBe(false);
    expect(leftSidebar.classList.contains('collapsed')).toBe(false);

    const rightDockBtn = fixture.nativeElement.querySelector(
      '.canvas-panel-toggle.right-toggle'
    );
    rightDockBtn.click();
    fixture.detectChanges();
    expect(component.isRightPanelCollapsed).toBe(false);
    expect(rightCollapsedState).toBe(false);
    expect(rightSidebar.classList.contains('collapsed')).toBe(false);
  });

  it('respects initial leftPanelCollapsed and rightPanelCollapsed inputs', () => {
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.componentRef.setInput('leftPanelCollapsed', true);
    fixture.componentRef.setInput('rightPanelCollapsed', true);
    fixture.detectChanges();

    expect(component.isLeftPanelCollapsed).toBe(true);
    expect(component.isRightPanelCollapsed).toBe(true);

    const leftSidebar =
      fixture.nativeElement.querySelector('.editor-left-panel');
    const rightSidebar = fixture.nativeElement.querySelector(
      '.editor-right-panel'
    );
    expect(leftSidebar.classList.contains('collapsed')).toBe(true);
    expect(rightSidebar.classList.contains('collapsed')).toBe(true);
  });

  describe('Floorplan import', () => {
    const importedPlan = {
      schemaVersion: 1,
      dimensions: { width: 1000, height: 700 },
      buildings: [
        {
          id: 'imported-b',
          label: 'Imported Hall',
          position: { x: 10, y: 10 },
          rotation: 0,
          points: [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 200 },
            { x: 0, y: 200 },
          ],
          zones: [],
          rows: [],
        },
      ],
    };
    const jsonFile = (content: string, name = 'plan.json') =>
      new File([content], name, { type: 'application/json' });

    beforeEach(() => {
      fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
      fixture.detectChanges();
    });

    it('shows an Import Floorplan button in the left panel', () => {
      const buttons = Array.from(
        fixture.nativeElement.querySelectorAll('.editor-left-panel button')
      ) as HTMLButtonElement[];
      expect(
        buttons.some((b) => b.textContent?.includes('Import Floorplan'))
      ).toBe(true);
    });

    it('replaces the plan after confirmation and emits floorplanChange', async () => {
      vi.spyOn(component as any, 'confirmReplace').mockReturnValue(true);
      const emitted: unknown[] = [];
      component.floorplanChange.subscribe((p) => emitted.push(p));

      const ok = await component.importFloorplanFile(
        jsonFile(JSON.stringify(importedPlan))
      );

      expect(ok).toBe(true);
      expect(component.floorplanImportError).toBeNull();
      const plan = component.getFloorplan()!;
      expect(plan.buildings.map((b) => b.id)).toEqual(['imported-b']);
      expect(plan.dimensions).toEqual({ width: 1000, height: 700 });
      expect(component.canUndo()).toBe(false);
      expect(emitted.length).toBeGreaterThan(0);
    });

    it('keeps the current plan when the user cancels', async () => {
      vi.spyOn(component as any, 'confirmReplace').mockReturnValue(false);
      const before = component.getFloorplan();
      const ok = await component.importFloorplanFile(
        jsonFile(JSON.stringify(importedPlan))
      );
      expect(ok).toBe(false);
      expect(component.getFloorplan()).toEqual(before);
    });

    it('reports invalid JSON without touching the plan', async () => {
      const before = component.getFloorplan();
      const ok = await component.importFloorplanFile(
        jsonFile('{ not json', 'broken.json')
      );
      expect(ok).toBe(false);
      expect(component.floorplanImportError).toContain('not valid JSON');
      expect(component.getFloorplan()).toEqual(before);

      fixture.detectChanges();
      const alert = fixture.nativeElement.querySelector(
        '.editor-left-panel .upload-error-box'
      );
      expect(alert?.textContent).toContain('broken.json');
    });

    it('reports schema errors with the failing path', async () => {
      const before = component.getFloorplan();
      const ok = await component.importFloorplanFile(
        jsonFile(JSON.stringify({ ...importedPlan, schemaVersion: 2 }))
      );
      expect(ok).toBe(false);
      expect(component.floorplanImportError).toContain('not a valid floorplan');
      expect(component.floorplanImportError).toContain('schemaVersion');
      expect(component.getFloorplan()).toEqual(before);
    });
  });

  describe('Blueprint / Background floorplan features', () => {
    it('displays blueprint dropzone when no background is present', () => {
      fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
      fixture.detectChanges();

      const dropzone = fixture.nativeElement.querySelector(
        '.blueprint-dropzone'
      );
      expect(dropzone).toBeTruthy();
      expect(dropzone.textContent).toContain('Upload Floorplan Blueprint');
    });

    it('uploads an image blueprint, applies tracing defaults, and updates controls', async () => {
      fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
      fixture.detectChanges();

      const dummyFile = new File(['image-bytes'], 'architectural_plan.png', {
        type: 'image/png',
      });

      await component.uploadBackgroundFile(dummyFile);
      fixture.detectChanges();

      expect(component.currentBackground).toBeDefined();
      expect(component.currentBackground?.filename).toBe(
        'architectural_plan.png'
      );
      expect(component.currentBackground?.opacity).toBe(0.6);
      expect(component.currentBackground?.locked).toBe(true);
      expect(component.currentBackground?.visible).toBe(true);

      // Verify blueprint card displays loaded state
      const loadedView = fixture.nativeElement.querySelector(
        '.blueprint-loaded-view'
      );
      expect(loadedView).toBeTruthy();
      expect(loadedView.textContent).toContain('architectural_plan.png');

      // Test opacity adjustment
      component.setBackgroundOpacity(40);
      fixture.detectChanges();
      expect(component.currentBackground?.opacity).toBe(0.4);

      // Test scale adjustment
      component.setBackgroundScale(1.5);
      fixture.detectChanges();
      expect(component.currentBackground?.scale).toBe(1.5);

      // A native change event from an inner input must not reach the host
      // (where it would hit `(change)` output listeners) or erase the blueprint
      const hostChangeListener = vi.fn();
      fixture.nativeElement.addEventListener('change', hostChangeListener);
      const slider = fixture.nativeElement.querySelector(
        '.blueprint-loaded-view input[type="range"]'
      );
      expect(slider).toBeTruthy();
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      expect(hostChangeListener).not.toHaveBeenCalled();
      expect(component.currentBackground).toBeTruthy();
      expect(component.currentBackground?.scale).toBe(1.5);

      // Logarithmic scale slider reaches well beyond 3x
      component.setBackgroundScaleFromSlider(1);
      expect(component.currentBackground?.scale).toBe(10);
      expect(component.backgroundScaleSliderValue).toBeCloseTo(1);
      component.setBackgroundScaleFromSlider(
        component.BACKGROUND_SCALE_LOG_MAX
      );
      expect(component.currentBackground?.scale).toBeCloseTo(31.6);
      component.setBackgroundScale(1.5);

      // Test position adjustment
      component.setBackgroundPosition(100, 50);
      fixture.detectChanges();
      expect(component.currentBackground?.position).toEqual({ x: 100, y: 50 });

      // Test toggle lock
      component.toggleBackgroundLocked();
      fixture.detectChanges();
      expect(component.currentBackground?.locked).toBe(false);

      // Test toggle visibility
      component.toggleBackgroundVisibility();
      fixture.detectChanges();
      expect(component.currentBackground?.visible).toBe(false);

      // Test fit to canvas
      component.backgroundDimensions = { width: 1000, height: 600 };
      component.fitBackgroundToCanvas();
      fixture.detectChanges();
      expect(component.currentBackground?.scale).toBeGreaterThan(0);

      // Test remove
      component.removeBackground();
      fixture.detectChanges();
      expect(component.currentBackground).toBeUndefined();
      expect(
        fixture.nativeElement.querySelector('.blueprint-dropzone')
      ).toBeTruthy();
    });
  });
});
