import Konva from 'konva';
import { Observable, Subject } from 'rxjs';
import { NIL, v4 as uuidv4 } from 'uuid';
import { KonvaOutput, Seat, SeatConfig, SeatedConst, SeatedSaveData, SeatedSeatSaveData, SeatEvent } from '../models';
import { Vector2d } from '../models/konva.models';

export class Seated {
	private _stage: Konva.Stage;
	private _seatLayer: Konva.Layer;
	private _seats: Seat[] = [];

	private _importedData?: SeatedSaveData;


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
		console.log(this._editionMode);
		this._seats.forEach((seat) => seat.shape.draggable(this._editionMode));
	}

	public createSeat(seatConfig: SeatConfig): void {
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

		const seat = new Seat(id, null, circle);

		this._seats.push(seat);

		circle.on('click tap', () => {
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
	}

	public import(data?: SeatedSaveData): void {
		this._seats.forEach((seat) => {
			seat.shape.destroy();
		});
		this._seats = [];
		console.log(data);
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
			data.seats.forEach((x) => {
				this.createSeat({
					x: x.shape.x,
					y: x.shape.y,
					radius: x.shape.radius,
					color: x.shape.fill,
					id: x.internalId,
					data: x.data,
				});
				return x;
			});
			this._scaleChange();
		}
	}

	public export(): SeatedSaveData {
		const output: KonvaOutput = this._stage.toObject();
		const seats: SeatedSeatSaveData[] = output.children[0].children.map((x) => {
			const seat = this._seats.find((seat) => seat.internalId === x.attrs.id!)!;
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
		return { seats: seats, dimentions: { width: output.attrs.width!, height: output.attrs.height! } };
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


	// last position of selected seat
	private _lastPosition:Vector2d | null = null;

	private _initiateClipCheck():void{
		this.seatEventObservable$.subscribe(selectedSeat => {
			if(selectedSeat.type === "dragmove"){
				for(let element of this._seats){
					const isClippingX = Math.abs(selectedSeat.data.shape.x() - element.shape.x()) <  SeatedConst.SEAT_CLIP_RADIUS;
					const isClippingY = Math.abs(selectedSeat.data.shape.y() - element.shape.y()) <  SeatedConst.SEAT_CLIP_RADIUS;

					// finding magnitude(distance) between two points
					const vectorDistanceBetweenTwoPointsToPreventIdiotsFromBeingidiots : Vector2d = {x: element.shape.x() - selectedSeat.data.shape.x(),y: element.shape.y() - selectedSeat.data.shape.y()};
					const magnitude = Math.sqrt(Math.pow(vectorDistanceBetweenTwoPointsToPreventIdiotsFromBeingidiots.x,2) + Math.pow(vectorDistanceBetweenTwoPointsToPreventIdiotsFromBeingidiots.y,2));


					// Idiot proof checkup to prevent people from stacking seats
					if(this._lastPosition != null && magnitude <= element.shape.width()){
						selectedSeat.data.shape.setPosition(this._lastPosition);
						break;
					}

					// Clips dragged seat on the x axis
					if(isClippingX && !isClippingY){
						selectedSeat.data.shape.setPosition({x:element.shape.x(), y:selectedSeat.data.shape.y()})
						break;
					}
					// Clips dragged seat on the y axis
					if(isClippingY && !isClippingX){
						selectedSeat.data.shape.setPosition({x:selectedSeat.data.shape.x(), y:element.shape.y()})
						break;
					}

					//registers last position of the selected seat for the idiot proof function
					this._lastPosition = selectedSeat.data.shape.getPosition();
				}
			}
		})
	}
}
