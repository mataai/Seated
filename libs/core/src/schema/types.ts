export interface Vec2 {
  x: number;
  y: number;
}

export interface FloorplanDimensions {
  width: number;
  height: number;
}

export interface FloorplanBackground {
  src: string;
  position?: Vec2;
  scale?: number;
  opacity?: number;
  locked?: boolean;
}

export interface Seat {
  id: string;
  index: number;
  side: 'a' | 'b';
  label: string;
  data?: Record<string, unknown>;
}

export interface RowTableStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

export interface Row {
  id: string;
  label: string;
  position: Vec2;
  rotation: number;
  side: 'one' | 'both';
  seatSpacing: number;
  seatRadius: number;
  tableWidth: number;
  tableStyle?: RowTableStyle;
  seats: Seat[];
  data?: Record<string, unknown>;
}

export interface ZoneText {
  value: string;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  align?: 'left' | 'center' | 'right';
  offset?: Vec2;
}

export interface Zone {
  id: string;
  position: Vec2;
  rotation: number;
  points: Vec2[];
  fill: string;
  stroke?: string;
  opacity?: number;
  text?: ZoneText;
  data?: Record<string, unknown>;
}

export interface Building {
  id: string;
  label: string;
  position: Vec2;
  rotation: number;
  points: Vec2[];
  zones: Zone[];
  rows: Row[];
  data?: Record<string, unknown>;
}

export interface Floorplan {
  schemaVersion: 1;
  dimensions: FloorplanDimensions;
  background?: FloorplanBackground;
  buildings: Building[];
}
