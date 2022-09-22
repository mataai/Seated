import { Shape } from '..';

export interface Item extends Shape {
  draggble: boolean;

  onClick?: CallableFunction;
}
