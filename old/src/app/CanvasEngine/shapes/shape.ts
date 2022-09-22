import { ShapeTypes } from './shape-types.enum';

export interface Shape {
  type: ShapeTypes;
  x: number;
  y: number;
  _color: string;
  _filled: boolean;

  draw(context: CanvasRenderingContext2D): void;
}
