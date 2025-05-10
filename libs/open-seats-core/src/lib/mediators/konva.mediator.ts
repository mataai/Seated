import Konva from 'konva';
import { KonvaOutput, SeatedSaveData } from '../models';

export class KonvaMediator {
  public static instance: KonvaMediator;
  private _stage: Konva.Stage;
  private _seatLayer!: Konva.Layer;
  private _backgroundLayer!: Konva.Layer;
  private _background!: Konva.Image | null;

  constructor(private _container: HTMLDivElement) {
    KonvaMediator.instance = this;
    this._stage = this.createStage(
      _container.getBoundingClientRect().width,
      _container.getBoundingClientRect().height,
      _container
    );
  }

  public createStage(
    x: number,
    y: number,
    container: HTMLDivElement
  ): Konva.Stage {
    const stage = new Konva.Stage({
      container: container, // id of container <div>
      width: x,
      height: y,
      draggable: true,
    });
    this._seatLayer = new Konva.Layer({ name: 'seatLayer' });
    this._backgroundLayer = new Konva.Layer({ name: 'backgroundLayer' });
    this._seatLayer.setZIndex(5);
    this._backgroundLayer.setZIndex(0);
    stage.add(this._backgroundLayer);
    stage.add(this._seatLayer);
    this._seatLayer.draw();
    stage.on('wheel', this._handleScroll.bind(this));
    return stage;
  }

  public addToSeatLayer(children: Konva.Shape | Konva.Group) {
    this._seatLayer.add(children);
  }

  public import(data: SeatedSaveData): void {
    this._seatLayer.clear();
    this._stage.destroyChildren();
    this._stage.clear();
    this._stage = this.createStage(
      data.dimentions.width,
      data.dimentions.height,
      this._container
    );

    this.setBackground(data.background);
  }

  public export(): { konva: KonvaOutput; background: string } {
    return {
      konva: this._stage.toObject(),
      background: (this._background?.attrs.image as HTMLImageElement).src,
    };
  }

  public setBackground(image: string) {
    if (this._background) {
      this._background.destroy();
      this._background = null;
    }
    Konva.Image.fromURL(image, (image) => {
      this._background = image;
      this._background.setAttrs({
        x: 0,
        y: 0,
        width: this._stage.width(),
        height: this._stage.height(),
      });
      this._backgroundLayer.add(this._background);
      this._backgroundLayer.draw();
    });
    this._backgroundLayer.add(this._background!);
    this._backgroundLayer.draw();
  }

  private _handleScroll(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const oldScale = this._stage.scaleX();
    const mousePointTo = {
      x: (e.evt.clientX - this._stage.x()) / oldScale,
      y: (e.evt.clientY - this._stage.y()) / oldScale,
    };
    const newScale = e.evt.deltaY > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    this._stage.scale({ x: newScale, y: newScale });
    const newPos = {
      x: e.evt.clientX - mousePointTo.x * newScale,
      y: e.evt.clientY - mousePointTo.y * newScale,
    };
    this._stage.position(newPos);
    this._stage.batchDraw();
  }
}
