import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { AppComponent, LIVE_SERVER_URL } from './app.component';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      // No live server in unit tests.
      providers: [{ provide: LIVE_SERVER_URL, useValue: null }],
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

  it('keeps the status counts in sync with live status changes', () => {
    const total = component.floorplan.buildings
      .flatMap((b) => b.rows)
      .reduce((n, r) => n + r.seats.length, 0);
    expect(component.statusCounts).toEqual({
      available: total - 6,
      reserved: 5,
      locked: 1,
    });

    component.onStatusesChanged({
      changes: { 's-a-1a': null, 's-a-3a': 'reserved' },
      replaced: false,
    });
    expect(component.statusCounts).toEqual({
      available: total - 6,
      reserved: 5,
      locked: 1,
    });

    component.onStatusesChanged({
      changes: { 's-a-1a': 'locked' },
      replaced: true,
    });
    expect(component.statusCounts).toEqual({
      available: total - 1,
      reserved: 0,
      locked: 1,
    });
  });
});
