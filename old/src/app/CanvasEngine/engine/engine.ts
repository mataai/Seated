import { Circle, Shape } from '..';
import { Seat } from '../items';
import { ShapeTypes } from '../shapes/shape-types.enum';
import { Item } from './item';
import { Mouse } from './mouse';

export class Engine {
  private _ctx: CanvasRenderingContext2D;
  private _items: Item[] = [];
  private _mouse: Mouse = new Mouse(0, 0, false, false);

  private _selectedItem?: Item;

  constructor(
    private _canvas: HTMLCanvasElement,
    private _backgroundColor = 'white'
  ) {
    const context = _canvas.getContext('2d');
    if (!context) throw new Error();
    this._ctx = _canvas.getContext('2d') as CanvasRenderingContext2D;
    this.fit_dpi();
    window.addEventListener('resize', this.fit_dpi);
    window.requestAnimationFrame(() => this.animate());
    window.addEventListener('mousemove', (event) => {
      this._mouse.x = event.clientX;
      this._mouse.y = event.clientY;
      if (this._mouse.clicked && this._selectedItem) {
        this._selectedItem.x = this._mouse.x;
        this._selectedItem.y = this._mouse.y;
      }
    });
    this._canvas.addEventListener('dblclick', () => {
      console.log('double click', this._getShapeAtMouse());
    });
    window.addEventListener('mousedown', () => {
      this._mouse.clicked = true;
      this._selectedItem = this._getShapeAtMouse();
    });

    window.addEventListener('mouseup', () => {
      this._mouse.clicked = false;
      this._selectedItem = undefined;
    });
  }

  private _getShapeAtMouse(): Item | undefined {
    for (const item of this._items) {
      switch (item.type) {
        case ShapeTypes.CIRCLE:
          const distance = Math.sqrt(
            (item.x - this._mouse.x) ** 2 + (item.y - this._mouse.y) ** 2
          );
          if (distance <= (item as unknown as Circle).radius) {
            if (!!item.onClick) {
              item.onClick();
            }
            return item;
          }
          break;
        case ShapeTypes.RECTANGLE:
          break;
        default:
          return undefined;
      }
    }
    return undefined;
  }

  public fit_dpi(): void {
    let style_width = +getComputedStyle(this._canvas)
      .getPropertyValue('width')
      .slice(0, -2);
    let style_height = +getComputedStyle(this._canvas)
      .getPropertyValue('height')
      .slice(0, -2);
    this._canvas.setAttribute(
      'height',
      String(style_height * window.devicePixelRatio)
    );
    this._canvas.setAttribute(
      'width',
      String(style_width * window.devicePixelRatio)
    );
  }

  private animate(): void {
    if (!this._ctx) return;
    this._ctx.fillStyle = this._backgroundColor;
    this._ctx?.fillRect(
      0,
      0,
      +getComputedStyle(this._canvas).getPropertyValue('width').slice(0, -2) *
        window.devicePixelRatio,
      +getComputedStyle(this._canvas).getPropertyValue('height').slice(0, -2) *
        window.devicePixelRatio
    );
    this._drawShapes();
    window.requestAnimationFrame(() => this.animate());
  }

  private _drawShapes() {
    for (const item of this._items) {
      item.draw(this._ctx);
    }
  }

  public loadData(data: string) {
    this._items = [];
    const items = JSON.parse(data) as Item[];
    items.forEach((item) => {
      switch (item.type) {
        case ShapeTypes.CIRCLE:
          this.addShape(
            new Seat(
              item.x,
              item.y,
              (item as unknown as Circle).radius,
              item._color,
              item._filled
            )
          );
          break;

        default:
          break;
      }
    });
  }
  public saveData() {
    return JSON.stringify(this._items);
  }

  public addShape(shape: Item): void {
    this._items.push(shape);
    this._mouse.trackLocation = !!this._items.find((x) => x.draggble);
  }
}
