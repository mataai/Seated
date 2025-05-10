export interface SeatedEvent<T> {
	type: 'click' | 'dragstart' | 'dragend' | 'dragmove' | 'mouseover' | 'mouseout';
	data: T;
}
