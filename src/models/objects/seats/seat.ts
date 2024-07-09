import Konva from 'konva';

export class Seat {
	public readonly internalId: string;
	public data: any;
	public parentId? = '';
	public shape: Konva.Shape;

	constructor(id: string, data: any, shape: Konva.Shape, parentId?: string) {
		this.internalId = id;
		this.data = data;
		this.shape = shape;
		this.parentId = parentId;
	}
}
