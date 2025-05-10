import Konva from 'konva';

export abstract class SeatedObject {
	public isSelected = false;
	constructor(public readonly internalId: string, public data: any, public shape: Konva.Shape) {}
	public abstract setSelected(selected: boolean): void;
}
