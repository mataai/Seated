export interface SeatEvent {
	type: 'click' | 'dragstart' | 'dragend' | 'dragmove' | 'mouseover' | 'mouseout';
	data: any;
}
