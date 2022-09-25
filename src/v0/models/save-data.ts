export interface SeatedSeatSaveData {
	internalId: string;
	data: any;
	shape: { x: number; y: number; stroke: string; radius: number; fill: string; id: string; strokeWidth: number };
}

export interface SeatedSaveData {
	dimentions: { width: number; height: number };
	seats: SeatedSeatSaveData[];
}
