import Konva from 'konva';
import { SeatConfig } from '../models';

export class Seated {
	private _stage: Konva.Stage;

	private _seatLayer: Konva.Layer;

	constructor(private _container: HTMLDivElement, private _editionMode: boolean, data?: string) {
		if (data) {
			this._stage = Konva.Node.create(data, _container);
		} else {
			this._stage = new Konva.Stage({
				container: _container, // id of container <div>
				width: _container.getBoundingClientRect().width,
				height: _container.getBoundingClientRect().height,
			});
		}

		this._seatLayer = new Konva.Layer({ name: 'seatLayer' });

		this._stage.add(this._seatLayer);
		this._seatLayer.draw();
	}

	public createSeat(seatConfig: SeatConfig): void {
		let circle = new Konva.Circle({
			x: seatConfig.x ?? this._stage.width() / 2,
			y: seatConfig.y ?? this._stage.height() / 2,
			stroke: 'black',
			radius: seatConfig.radius,
			fill: seatConfig.fill,
			id: seatConfig.id,
			strokeWidth: seatConfig.radius / 8,
			draggable: this._editionMode,
		});

		if (seatConfig.onClick) {
			circle.on('click tap', seatConfig.onClick);
		}
		if (seatConfig.onDragStart) {
			circle.on('dragstart', seatConfig.onDragStart);
		}
		if (seatConfig.onDragEnd) {
			circle.on('dragend', seatConfig.onDragEnd);
		}
		if (seatConfig.onDragMove) {
			circle.on('dragmove', seatConfig.onDragMove);
		}
		if (seatConfig.onMouseOver) {
			circle.on('mouseover', seatConfig.onMouseOver);
		}
		if (seatConfig.onMouseOut) {
			circle.on('mouseout', seatConfig.onMouseOut);
		}

		// add the shape to the layer
		this._seatLayer.add(circle);
	}

	public import(data: string): void {
		this._stage = Konva.Node.create(data, this._container);
	}

	public export(): string {
		return this._stage.toJSON();
	}
}
