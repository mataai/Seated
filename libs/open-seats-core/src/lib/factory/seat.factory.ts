import { v4 as uuidv4 } from 'uuid';
import Konva from 'konva';
import { Seat, SeatConfig } from '../objects';
import { EngineState } from '../engine/engine.state';

export class SeatFactory {
  public createSeat(seatConfig: SeatConfig): Seat {
    const id = uuidv4();
    const circle = new Konva.Circle({
      x: seatConfig.x,
      y: seatConfig.y,
      stroke: 'black',
      radius: seatConfig.radius,
      fill: seatConfig.color,
      id: seatConfig.id || id,
      strokeWidth: seatConfig.radius / 8,
      draggable: EngineState.editable,
    });

    const seat = new Seat(id, circle);

    return seat;
  }
}
