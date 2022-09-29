import { Seat } from '../seats/seat';
export interface SeatEvent {
	type: 'click' | 'dragstart' | 'dragend' | 'dragmove' | 'mouseover' | 'mouseout';
	data: Seat;
}
