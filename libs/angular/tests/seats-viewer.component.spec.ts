import './test-setup';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { SeatsViewerComponent } from '../src/components/seats-viewer.component';
import { SAMPLE_FLOORPLAN } from '@open-seats/core';
import type { StatusSink, StatusSource } from '@open-seats/viewer';

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
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(
      component.containerRef().nativeElement.querySelector('.konvajs-content')
    ).toBeTruthy();
  });

  it('selects, deselects and clears seat selection', () => {
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
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
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.detectChanges();

    component.setStatus('seat-a-1', 'reserved');
    expect(component.getStatus('seat-a-1')).toBe('reserved');

    component.setStatuses({ 'seat-a-2': 'locked' });
    expect(component.getStatus('seat-a-2')).toBe('locked');
  });

  it('emits selectionChanged event when seats are selected', () => {
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.detectChanges();

    let emitted: string[] = [];
    component.selectionChanged.subscribe((payload) => {
      emitted = payload.selectedSeatIds;
    });

    component.selectSeats(['seat-a-1']);
    expect(emitted).toContain('seat-a-1');
  });

  it('connects the statusSource input and forwards live events', async () => {
    let sink: StatusSink | null = null;
    const stop = vi.fn();
    const source: StatusSource = {
      subscribe: (s) => {
        sink = s;
        return stop;
      },
    };
    const states: (string | null)[] = [];
    const invalidated: string[][] = [];
    const statusChanges: unknown[] = [];
    component.statusesChanged.subscribe((payload) =>
      statusChanges.push(payload)
    );
    component.connectionStateChanged.subscribe(({ state }) =>
      states.push(state)
    );
    component.selectionInvalidated.subscribe(({ seatIds }) =>
      invalidated.push(seatIds)
    );

    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.componentRef.setInput('statusSource', source);
    fixture.detectChanges();
    await Promise.resolve();

    component.selectSeats(['s-a-3a']);
    sink!.snapshot({ 's-a-3a': 'reserved' }, 1);
    sink!.connectionState('live');

    expect(component.getStatus('s-a-3a')).toBe('reserved');
    expect(component.getSelectedSeatIds()).toEqual([]);
    expect(invalidated).toEqual([['s-a-3a']]);
    expect(statusChanges).toEqual([
      { changes: { 's-a-3a': 'reserved' }, replaced: true },
    ]);
    expect(states).toEqual(['live']);
    expect(component.getConnectionState()).toBe('live');

    fixture.componentRef.setInput('statusSource', null);
    fixture.detectChanges();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(component.getConnectionState()).toBeNull();
  });

  it('never falls back to options.statusSource once the statusSource input is used', async () => {
    const fromOptions = manualSource();
    const custom = manualSource();
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.componentRef.setInput('options', {
      statusSource: fromOptions.source,
    });
    fixture.componentRef.setInput('statusSource', custom.source);
    fixture.detectChanges();
    await Promise.resolve();
    expect(custom.subscribe).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('statusSource', null);
    fixture.detectChanges();
    fixture.componentRef.setInput('statusSource', undefined);
    fixture.detectChanges();

    expect(custom.stop).toHaveBeenCalledTimes(1);
    expect(fromOptions.subscribe).not.toHaveBeenCalled();
    expect(component.getConnectionState()).toBeNull();
  });

  it('uses options.statusSource and follows its changes when the input is unused', async () => {
    const first = manualSource();
    const second = manualSource();
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.componentRef.setInput('options', { statusSource: first.source });
    fixture.detectChanges();
    await Promise.resolve();
    expect(first.subscribe).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('options', { statusSource: second.source });
    fixture.detectChanges();
    expect(first.stop).toHaveBeenCalledTimes(1);
    expect(second.subscribe).toHaveBeenCalledTimes(1);
  });

  it('enters the Angular zone once per live update', async () => {
    const live = manualSource();
    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.componentRef.setInput('statusSource', live.source);
    fixture.detectChanges();
    await Promise.resolve();
    component.selectSeats(['s-a-3a']);

    const zone = TestBed.inject(NgZone);
    const run = vi.spyOn(zone, 'run');
    const emitted: string[] = [];
    component.statusesChanged.subscribe(() => emitted.push('statuses'));
    component.seatDeselected.subscribe(() => emitted.push('deselected'));
    component.selectionInvalidated.subscribe(() => emitted.push('invalidated'));
    component.selectionChanged.subscribe(() => emitted.push('selection'));

    zone.runOutsideAngular(() =>
      live.sink().patch({ 's-a-3a': 'reserved' }, 1)
    );

    expect(emitted).toEqual([
      'statuses',
      'deselected',
      'invalidated',
      'selection',
    ]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('passes the seatData input to the viewer, replacing it on change', () => {
    const changes: unknown[] = [];
    component.seatDataChanged.subscribe((payload) => changes.push(payload));

    fixture.componentRef.setInput('floorplan', SAMPLE_FLOORPLAN);
    fixture.componentRef.setInput('seatData', { 's-a-1a': { ticket: 'T-1' } });
    fixture.detectChanges();
    expect(component.getSeatData('s-a-1a')).toEqual({ ticket: 'T-1' });

    fixture.componentRef.setInput('seatData', { 's-a-2a': { ticket: 'T-2' } });
    fixture.detectChanges();
    expect(component.getSeatData('s-a-1a')).toBeUndefined();
    expect(component.getSeatData('s-a-2a')).toEqual({ ticket: 'T-2' });
    expect(changes).toEqual([
      {
        changes: { 's-a-2a': { ticket: 'T-2' } },
        replaced: true,
        source: 'app',
      },
    ]);
  });
});

function manualSource() {
  let current: StatusSink | null = null;
  const stop = vi.fn(() => {
    current = null;
  });
  const subscribe = vi.fn((s: StatusSink) => {
    current = s;
    return stop;
  });
  const source: StatusSource = { subscribe };
  return {
    source,
    subscribe,
    stop,
    sink: () => {
      if (!current) throw new Error('not subscribed');
      return current;
    },
  };
}
