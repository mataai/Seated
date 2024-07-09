import { Vector2d } from "../../konva.models";
import { Seat } from "../seats/seat";

export class Row {
	public readonly internalId: string;
	public seatCount = 0;
	public seats: Seat[] = [];
	public position: Vector2d;
	public rotation: number = 0;

	constructor(id: string, position: Vector2d) {
		this.internalId = id;
		this.position = position;
	}
}
