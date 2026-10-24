import './test-setup';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { SeatsViewerComponent } from '../src/components/seats-viewer.component';
import { SAMPLE_FLOORPLAN } from '@open-seats/core';

describe('SeatsViewerComponent', () => {
  let fixture: ComponentFixture<SeatsViewerComponent>;
  let component: SeatsViewerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeatsViewerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SeatsViewerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('initializes viewer inside container after view init', () => {
    component.floorplan = SAMPLE_FLOORPLAN;
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(
      component.containerRef.nativeElement.querySelector('.konvajs-content')
    ).toBeTruthy();
  });

  it('selects, deselects and clears seat selection', () => {
    component.floorplan = SAMPLE_FLOORPLAN;
    fixture.detectChanges();

    component.selectSeats(['seat-a-1']);
    expect(component.getSelectedSeatIds()).toContain('seat-a-1');

    component.deselectSeats(['seat-a-1']);
    expect(component.getSelectedSeatIds()).not.toContain('seat-a-1');

    component.selectSeats(['seat-a-1', 'seat-a-2']);
    component.clearSelection();
    expect(component.getSelectedSeatIds().length).toBe(0);
  });

  it('sets seat status and retrieves it', () => {
    component.floorplan = SAMPLE_FLOORPLAN;
    fixture.detectChanges();

    component.setStatus('seat-a-1', 'reserved');
    expect(component.getStatus('seat-a-1')).toBe('reserved');

    component.setStatuses({ 'seat-a-2': 'locked' });
    expect(component.getStatus('seat-a-2')).toBe('locked');
  });

  it('emits selectionChanged event when seats are selected', () => {
    component.floorplan = SAMPLE_FLOORPLAN;
    fixture.detectChanges();

    let emitted: string[] = [];
    component.selectionChanged.subscribe((payload) => {
      emitted = payload.selectedSeatIds;
    });

    component.selectSeats(['seat-a-1']);
    expect(emitted).toContain('seat-a-1');
  });
});
