import { SeatedObject } from '../seated-object';

export class Seat extends SeatedObject {
	public override setSelected(selected: boolean): void {
		this.isSelected = selected;
	}
	public on(event: string, callback: () => void): void {
		this.shape.on(event, callback);
	}
}
