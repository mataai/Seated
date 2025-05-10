import { Subject, Observable } from 'rxjs';
import { SeatedObject } from '../objects';
import { SeatedEvent } from '../events';
import { EngineState } from '../engine/engine.state';
import { singleton } from 'tsyringe';
import Konva from 'konva';

@singleton()
export class ObjectMediator {
  private _eventSubject: Subject<SeatedEvent<SeatedObject>> = new Subject<
    SeatedEvent<SeatedObject>
  >();
  public get eventObservable$(): Observable<SeatedEvent<SeatedObject>> {
    return this._eventSubject.asObservable();
  }

  private _objects: SeatedObject[] = [];
  private _backgroundLayer!: Konva.Layer;

  constructor() {
    this._initiateObservers();
  }

  public setBackgroundLayer(layer: Konva.Layer): void {
    this._backgroundLayer = layer;
  }

  public registerObject(object: SeatedObject): void {
    this._objects.push(object);
    object.shape.on('click tap', () => {
      this._eventSubject.next({ type: 'click', data: object });
    });
    object.shape.on('dragstart', () => {
      this._eventSubject.next({ type: 'dragstart', data: object });
    });
    object.shape.on('dragend', () => {
      this._eventSubject.next({ type: 'dragend', data: object });
    });
    object.shape.on('dragmove', () => {
      this._eventSubject.next({ type: 'dragmove', data: object });
    });
    object.shape.on('mouseover', () => {
      this._eventSubject.next({ type: 'mouseover', data: object });
    });
    object.shape.on('mouseout', () => {
      this._eventSubject.next({ type: 'mouseout', data: object });
    });
    this._eventSubject.next({ type: 'dragend', data: object });
    this._backgroundLayer.add(object.shape);
  }

  public clear(): void {
    this._objects = [];
  }

  public export(): [] {
    return [];
  }

  private _initiateObservers(): void {
    EngineState.editableObs.subscribe((v) => {
      this._objects.forEach((obj) => {
        obj.shape.draggable(v);
      });
    });

    EngineState.selectedNodeObs.subscribe((v) => {
      this._objects.forEach((object) => {
        object.setSelected(v?.internalId == object.internalId);
      });
    });
    this.eventObservable$.subscribe(({ type, data: selected }) => {
      switch (type) {
        case 'click':
          EngineState.setSelectedNode(selected);
          break;
        default:
          break;
      }
    });
  }
}
