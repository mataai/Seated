import Konva from 'konva';
import { Observable, Subject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import {
	KonvaOutput,
	Row,
	Seat,
	SeatConfig,
	SeatedConst,
	SeatedSaveData,
	SeatedSeatSaveData,
	SeatEvent
} from '../models';
import { Vector2d } from '../models/konva.models';
import { KeydownTracker } from './keydown-tracker';

export class Seated {
	private _stage: Konva.Stage;
	private _seatLayer: Konva.Layer;
	private _rows: Row[] = [];
	private _seats: Seat[] = [];
	private _selected: Seat | Row | Row[] | Seat[] | null = null;
	// last position of selected seat
	private _lastPosition: Vector2d | null = null;
	private _importedData?: SeatedSaveData;

	public get selected() {
		return this._selected;
	}

	public get editMode() {
		return this._editionMode;
	}

	private _seatEventSubject: Subject<SeatEvent> = new Subject<SeatEvent>();
	public get seatEventObservable$(): Observable<SeatEvent> {
		return this._seatEventSubject.asObservable();
	}

	constructor(private _container: HTMLDivElement, private _editionMode: boolean) {
		this._stage = new Konva.Stage({
			container: _container, // id of container <div>
			width: _container.getBoundingClientRect().width,
			height: _container.getBoundingClientRect().height,
		});
		// Initialize tracking of keydown events
		KeydownTracker.getInstance();
		this._seatLayer = new Konva.Layer({ name: 'seatLayer', draggable: false });
		this._stage.add(this._seatLayer);
		this._stage.container().style.backgroundColor = '#333333'; // Change background color
		this._seatLayer.draw();
		window.addEventListener('resize', () => {
			this._scaleChange();
		});
		this._initiateClipCheck();
	}

	public setEditionMode(editionMode: boolean): void {
		this._editionMode = editionMode;
		this._seats.forEach((seat) => seat.shape.draggable(this._editionMode));
	}

	public createSeat(seatConfig: SeatConfig): Seat {
		const id = uuidv4();
		const circle = new Konva.Circle({
			x: seatConfig.x ?? this._container.getBoundingClientRect().width / 2,
			y: seatConfig.y ?? this._container.getBoundingClientRect().height / 2,
			stroke: 'black',
			radius: seatConfig.radius,
			fill: seatConfig.color,
			id: seatConfig.id || id,
			strokeWidth: seatConfig.radius / 8,
			draggable: this._editionMode,
		});

		const seat = new Seat(id, null, circle, seatConfig.parentId);

		this._seats.push(seat);

		circle.on('click tap', () => {
			if (this._editionMode) {
				if (!seat.parentId) {
					if (this._selected) {
						if (KeydownTracker.getInstance().isKeyDown('Control')) {
							if (Array.isArray(this._selected) && this._selected.includes(seat)) {
								this._selected.push(seat);
							} else {
								this._selected = [this._selected, seat];
							}
						}
					} else {
						this._selected = seat;
					}
				} else {
					this._selected = this._rows.find((row) => row.internalId === seat.parentId) || null;
				}
			}
			this._seatEventSubject.next({ type: 'click', data: seat });
		});
		circle.on('dragstart', () => {
			this._seatEventSubject.next({ type: 'dragstart', data: seat });
		});
		circle.on('dragend', () => {
			this._seatEventSubject.next({ type: 'dragend', data: seat });
		});
		circle.on('dragmove', () => {
			this._seatEventSubject.next({ type: 'dragmove', data: seat });
		});
		circle.on('mouseover', () => {
			this._seatEventSubject.next({ type: 'mouseover', data: seat });
		});
		circle.on('mouseout', () => {
			this._seatEventSubject.next({ type: 'mouseout', data: seat });
		});

		this._seatLayer.add(circle);
		return seat;
	}

	public createRow(vector: Vector2d): Row {
		const id = uuidv4();
		const row = new Row(id, vector);
		row.seatCount = 1;
		const seatConfig: SeatConfig = {
			x: vector.x,
			y: vector.y,
			radius: SeatedConst.SEAT_RADIUS,
			color: SeatedConst.SEAT_COLOR,
			parentId: id,
			id: uuidv4(),
		};

		row.seats.push(this.createSeat(seatConfig));
		this._rows.push(row);

		return row;
	}

	public import(data?: SeatedSaveData): void {
		this._seats.forEach((seat) => {
			seat.shape.destroy();
		});
		this._seats = [];
		if (!data) {
			this._createStage(
				this._container.getBoundingClientRect().width,
				this._container.getBoundingClientRect().height,
				this._container,
			);
		} else {
			this._importedData = data;

			this._createStage(data.dimentions.width, data.dimentions.height, this._container);
			this._seatLayer.clear();
			data.seats.forEach((seat) => {
				this.createSeat({
					x: seat.shape.x,
					y: seat.shape.y,
					radius: seat.shape.radius,
					color: seat.shape.fill,
					id: seat.internalId,
					data: seat.data,
				});
			});
			this._scaleChange();
		}
	}

	public export(): SeatedSaveData {
		const output: KonvaOutput = this._stage.toObject();
		const seats: SeatedSeatSaveData[] = this._seats.map((seat) => {
			const outShape = {
				id: seat.shape.id(),
				x: seat.shape.x(),
				y: seat.shape.y(),
				radius: seat.shape.width() / 2,
				fill: seat.shape.fill(),
				stroke: seat.shape.stroke(),
				strokeWidth: seat.shape.strokeWidth(),
			};
			return { ...seat, shape: outShape };
		});
		return {
			seats: seats,
			rows: [],
			dimentions: {
				width: output.attrs.width!,
				height: output.attrs.height!
			}
		};
	}

	private _createStage(x: number, y: number, container: HTMLDivElement): void {
		this._stage = new Konva.Stage({
			container: container, // id of container <div>
			width: x,
			height: y,
		});
		this._seatLayer = new Konva.Layer({ name: 'seatLayer' });
		this._stage.add(this._seatLayer);
		this._seatLayer.draw();
	}

	private _scaleChange(): void {
		if (!this._importedData) return;
		const containerWidth = this._container.offsetWidth;
		const sceneWidth = this._importedData.dimentions.width;
		const sceneHeight = this._importedData.dimentions.height;
		const scale = containerWidth / sceneWidth;
		this._stage.width(sceneWidth * scale);
		this._stage.height(sceneHeight * scale);
		this._stage.scale({ x: scale, y: scale });
	}

	private _initiateClipCheck(): void {
		this.seatEventObservable$.subscribe(({ type, data: selectedSeat }) => {
			if (type === "dragmove") {
				for (let element of this._seats) {

					// Prevent item from clipping with itself
					if (element.internalId == selectedSeat.internalId) {
						continue;
					}

					const isClippingX = Math.abs(selectedSeat.shape.x() - element.shape.x()) < SeatedConst.SEAT_CLIP_RADIUS;
					const isClippingY = Math.abs(selectedSeat.shape.y() - element.shape.y()) < SeatedConst.SEAT_CLIP_RADIUS;

					// finding magnitude(distance) between two points
					const vectorDistanceBetweenTwoPointsToPreventIdiotsFromBeingIdiots: Vector2d = { x: element.shape.x() - selectedSeat.shape.x(), y: element.shape.y() - selectedSeat.shape.y() };
					const magnitude = Math.sqrt(Math.pow(vectorDistanceBetweenTwoPointsToPreventIdiotsFromBeingIdiots.x, 2) + Math.pow(vectorDistanceBetweenTwoPointsToPreventIdiotsFromBeingIdiots.y, 2));


					// Idiot proof checkup to prevent people from stacking seats
					if (this._lastPosition != null && magnitude <= element.shape.width()) {
						selectedSeat.shape.setPosition(this._lastPosition);
						break;
					}

					// Clips dragged seat on the x axis
					if (isClippingX && !isClippingY) {
						selectedSeat.shape.setPosition({ x: element.shape.x(), y: selectedSeat.shape.y() })
						break;
					}
					// Clips dragged seat on the y axis
					if (isClippingY && !isClippingX) {
						selectedSeat.shape.setPosition({ x: selectedSeat.shape.x(), y: element.shape.y() })
						break;
					}

					//registers last position of the selected seat for the idiot proof function
				}
				this._lastPosition = selectedSeat.shape.getPosition();
			}
		})
	}
}
