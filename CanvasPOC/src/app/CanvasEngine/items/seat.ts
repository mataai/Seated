import { Item } from '../engine';
import { Circle } from '../shapes';

export class Seat extends Circle implements Item {
  draggble = true;
  constructor(
    x: number,
    y: number,
    radius: number,
    color: string,
    filled: boolean,
    public onClick?: CallableFunction
  ) {
    super(x, y, radius, color, filled);
  }
}
