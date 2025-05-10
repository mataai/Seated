import Konva from 'konva';
import { container, singleton } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { KonvaMediator } from '../mediators';
import { ObjectMediator } from '../mediators/object.mediator';
import { SeatedObject } from '../objects';
import { EngineState } from '../engine/engine.state';

@singleton()
export class BackgroundFactory {
  private readonly _konvaMediator: KonvaMediator =
    container.resolve(KonvaMediator);
  private readonly _backgroundMediator: ObjectMediator =
    container.resolve(ObjectMediator);

  public async createSeat(imageUrl: string): Promise<Konva.Image> {
    return new Promise((resolve) => {
      Konva.Image.fromURL(imageUrl, (image) => {
        image.setAttrs({
          x: 0,
          y: 0,
          width: this._konvaMediator.stage.width(),
          height: this._konvaMediator.stage.height(),

        });

        const object = new SeatedObject(uuidv4(), image, { imageUrl });
        image.draggable(EngineState.editable);
        image.id(object.internalId);
        this._backgroundMediator.registerObject(object);
        resolve(image);
      });
    });
  }
}
