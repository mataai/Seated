import './test-setup';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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
    component.floorplan = SAMPLE_FLOORPLAN;
    component.tool = 'pan';
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(component.containerRef.nativeElement.querySelector('.open-seats-editor-canvas')).toBeTruthy();
  });

  it('switches tools and emits toolChange', () => {
    component.floorplan = SAMPLE_FLOORPLAN;
    fixture.detectChanges();

    let currentTool = '';
    component.toolChange.subscribe((t) => {
      currentTool = t;
    });

    component.setTool('building');
    expect(currentTool).toBe('building');
  });

  it('toggles preview mode and emits previewToggle', () => {
    component.floorplan = SAMPLE_FLOORPLAN;
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
    component.floorplan = {
      schemaVersion: 1,
      dimensions: { width: 1000, height: 1000 },
      buildings: [],
    };
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
    component.floorplan = {
      schemaVersion: 1,
      dimensions: { width: 1000, height: 1000 },
      buildings: [],
    };
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
    component.floorplan = {
      schemaVersion: 1,
      dimensions: { width: 1000, height: 1000 },
      buildings: [],
    };
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
});
