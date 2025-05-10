export interface SeatedSeatSaveData {
	internalId: string;
	data: any;
	shape: { x: number; y: number; stroke: string; radius: number; fill: string; id: string; strokeWidth: number };
}

export interface SeatedTableSaveData{
	internalId: string;
	data: any;
	shape: { x: number; y: number;width:number; height:number;rotation:number; fill: string; id: string;};
}

export interface SeatedSaveData {
	dimentions: { width: number; height: number };
	seats: SeatedSeatSaveData[];
	tables: SeatedTableSaveData[];
  background: string;
}
