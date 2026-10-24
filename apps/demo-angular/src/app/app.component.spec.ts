import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates component in viewer mode by default', () => {
    expect(component).toBeTruthy();
    expect(component.mode).toBe('viewer');
    expect(component.floorplan.buildings.length).toBeGreaterThan(0);
  });

  it('switches between viewer and editor modes', () => {
    component.setMode('editor');
    expect(component.mode).toBe('editor');

    component.setMode('viewer');
    expect(component.mode).toBe('viewer');
  });

  it('updates tool in editor mode', () => {
    component.setMode('editor');
    component.setTool('pan');
    expect(component.currentTool).toBe('pan');
  });

  it('tracks selection changes', () => {
    component.onSelectionChanged({
      selectedSeatIds: ['s-a-1a'],
      selectedSeats: [
        {
          seat: { id: 's-a-1a', index: 0, side: 'a', label: 'A-1a' },
          row: component.floorplan.buildings[0].rows[0],
          building: component.floorplan.buildings[0],
        },
      ],
    });

    expect(component.selectedSeatIds).toEqual(['s-a-1a']);
    expect(component.selectedSeatLabels).toEqual(['A-1a']);
  });
});
