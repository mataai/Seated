import { Vector2d } from "./konva.models";

export interface SeatedSeatSaveData<T = any> {
	internalId: string;
	data: T;
	shape: {
		stroke: string;
		radius: number;
		fill: string;
		id: string;
		strokeWidth: number;
	} & Vector2d;
}

export interface SeatedRowSaveData<T = any> {
	internalId: string;
	position: Vector2d;
	seats: SeatedSeatSaveData<T>[];
}

export interface SeatedSaveData<T = any> {
	dimentions: {
		width: number;
		height: number;
	};
	seats: SeatedSeatSaveData<T>[];
	rows: SeatedRowSaveData<T>[];
}
