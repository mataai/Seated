export interface SeatConfig {
	x?: number;
	y?: number;
	radius: number;
	fill: string;
	id: string;

	onClick?: (data: unknown) => void;
	onDragStart?: (data: unknown) => void;
	onDragEnd?: (data: unknown) => void;
	onDragMove?: (data: unknown) => void;
	onMouseOver?: (data: unknown) => void;
	onMouseOut?: (data: unknown) => void;
}
