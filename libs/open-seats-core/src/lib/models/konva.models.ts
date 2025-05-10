export type globalCompositeOperationType =
	| ''
	| 'source-over'
	| 'source-in'
	| 'source-out'
	| 'source-atop'
	| 'destination-over'
	| 'destination-in'
	| 'destination-out'
	| 'destination-atop'
	| 'lighter'
	| 'copy'
	| 'xor'
	| 'multiply'
	| 'screen'
	| 'overlay'
	| 'darken'
	| 'lighten'
	| 'color-dodge'
	| 'color-burn'
	| 'hard-light'
	| 'soft-light'
	| 'difference'
	| 'exclusion'
	| 'hue'
	| 'saturation'
	| 'color'
	| 'luminosity';

export interface ICanvasConfig {
	width?: number;
	height?: number;
	pixelRatio?: number;
}
export interface Vector2d {
	x: number;
	y: number;
}

export interface NodeConfig {
	// allow any custom attribute
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	visible?: boolean;
	listening?: boolean;
	id?: string;
	name?: string;
	opacity?: number;
	scale?: Vector2d;
	scaleX?: number;
	scaleY?: number;
	rotation?: number;
	rotationDeg?: number;
	offset?: Vector2d;
	offsetX?: number;
	offsetY?: number;
	draggable?: boolean;
	dragDistance?: number;
	preventDefault?: boolean;
	globalCompositeOperation?: globalCompositeOperationType;
}
export interface LayerAttributes {
	name: string;
}

export interface idkNode {
	attrs: NodeConfig;
	className: string;
}

export interface Layer {
	attrs: LayerAttributes;
	className: string;
	children: idkNode[];
}

export interface KonvaOutput {
	attrs: ICanvasConfig;
	className: string;
	children?: Layer[];
}
