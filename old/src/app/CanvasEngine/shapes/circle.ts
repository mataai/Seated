import { Shape } from '.';
import { ShapeTypes } from './shape-types.enum';

export class Circle implements Shape {
  type = ShapeTypes.CIRCLE;
  x: number;
  y: number;
  radius: number;

  _color: string;
  _filled: boolean;
  constructor(
    x: number,
    y: number,
    radius: number,
    color: string,
    filled: boolean
  ) {
    this._color = color;
    this._filled = filled;
    this.x = x;
    this.y = y;
    this.radius = radius;
  }
  draw(context: CanvasRenderingContext2D): void {
    context.beginPath();
    context.arc(this.x, this.y, this.radius, 0, 2 * Math.PI, false);
    context.fillStyle = this._color;
    context.fill();
    context.lineWidth = 5;
    context.strokeStyle = this._color;
    context.stroke();
  }
}
