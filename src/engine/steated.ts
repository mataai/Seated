import Konva from 'konva';
import { filter, Observable, Subject, tap } from 'rxjs';
import { NIL, v4 as uuidv4 } from 'uuid';
import { KonvaOutput, Seat, SeatConfig, SeatedConst, SeatedSaveData, SeatedSeatSaveData, SeatedTableSaveData, SeatEvent } from '../models';
import { Vector2d } from '../models/konva.models';
import { TableConfig } from '../models/objects/tables/table.config';
import { Table } from '../models/objects/tables/table';

export class Seated {
	private _stage: Konva.Stage;
	private _seatLayer: Konva.Layer;
	private _seats: Seat[] = [];
	private _tables: Table[] = [];

	private _lastCircleSelected: Konva.Circle | null = null;

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
		this._setLastPosition();
	}

	public setEditionMode(editionMode: boolean): void {
		this._editionMode = editionMode;
		console.log(this._editionMode);
		this._seats.forEach((seat) => seat.shape.draggable(this._editionMode));
	}

	public createSeat(seatConfig: SeatConfig): void {
		const id = uuidv4();
		const circle = new Konva.Circle({
			x: seatConfig.x ?? (this._lastCircleSelected ? this._lastCircleSelected.x() + 20 : this._container.getBoundingClientRect().width / 2),
			y: seatConfig.y ?? this._lastCircleSelected?.y() ?? this._container.getBoundingClientRect().height / 2,
			stroke: 'black',
			radius: seatConfig.radius,
			fill: seatConfig.color,
			id: seatConfig.id || id,
			strokeWidth: seatConfig.radius / 8,
			draggable: this._editionMode,
		});

		const seat = new Seat(id, null, circle);

		this._lastCircleSelected = circle;
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

	public createTable(tableConfig: TableConfig): void {
		const id = uuidv4();
		var tr = new Konva.Transformer({
			boundBoxFunc: function (oldBoundBox, newBoundBox) {
			  // "boundBox" is an object with
			  // x, y, width, height and rotation properties
			  // transformer tool will try to fit nodes into that box
			  return newBoundBox;
			},
		  });

		const rect = new Konva.Rect({
			x: tableConfig.x ?? this._container.getBoundingClientRect().width / 2,
			y: tableConfig.y ?? this._container.getBoundingClientRect().height / 2,
			rotation: tableConfig.rotation,
			width: tableConfig.width,
			height: tableConfig.height,
			fill: tableConfig.color,
			id: tableConfig.id || id,
			draggable: this._editionMode,
		});

		const table = new Table(id, null, rect);

		this._tables.push(table);

		this._seatLayer.add(rect);
		this._seatLayer.add(tr);
		tr.nodes([rect]);
	}

	public import(data?: SeatedSaveData): void {
		this._seats.forEach((seat) => {
			seat.shape.destroy();
		});
		this._tables.forEach((table) => {
			table.shape.destroy();
		})
		this._seats = [];
		this._tables = [];
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
			data.tables.forEach((table) =>{
				this.createTable({
					x: table.shape.x,
					y: table.shape.y,
					width: table.shape.width,
					height: table.shape.height,
					rotation: table.shape.rotation,
					color: table.shape.fill,
					id:table.internalId,
					data:table.data
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
		const tables: SeatedTableSaveData[] = this._tables.map((table) => {
			const outShape = {
				id: table.shape.id(),
				x: table.shape.x(),
				y: table.shape.y(),
				width: table.shape.width() * table.shape.scaleX(),
				height: table.shape.height() * table.shape.scaleY(),
				rotation: table.shape.rotation(),
				fill: table.shape.fill()
			};
			return { ...table, shape: outShape };
		});
		return { tables:tables ,seats: seats, dimentions: { width: output.attrs.width!, height: output.attrs.height! } };
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

	private _setLastPosition(): void {
		this.seatEventObservable$.subscribe(({ type, data }) => {
			if (type === 'dragstart') {
				this._lastCircleSelected = data.shape as Konva.Circle;
			}
		});
	}

	// last position of selected seat
	private _lastPosition:Vector2d | null = null;

	private _initiateClipCheck():void{
		this.seatEventObservable$.subscribe(({type,data:selectedSeat}) => {
			if(type === "dragmove"){
				//Check collision with table
				for(let element of this._tables){
					const selectedSeatX = selectedSeat.shape.x();
					const selectedSeatY = selectedSeat.shape.y();

					// Checks clipping for each axis
					const isClippingX = selectedSeatX >= element.shape.x() - selectedSeat.shape.width()/2 && selectedSeatX <= (element.shape.x() + (element.shape.width()*element.shape.scaleX()) + selectedSeat.shape.width()/2);
					const isClippingY =  selectedSeatY >= element.shape.y() - selectedSeat.shape.width()/2 && selectedSeatY <= (element.shape.y() + (element.shape.height()*element.shape.scaleY()) + selectedSeat.shape.width()/2);

					if(this._lastPosition != null && isClippingX && isClippingY){
						selectedSeat.shape.setPosition(this._lastPosition); // reverts selected seat's position
						break;
					}

				}

				for(let element of this._seats){

					// Prevent item from clipping with itself
					if(element.internalId == selectedSeat.internalId){
						continue;
					}

					const isClippingX = Math.abs(selectedSeat.shape.x() - element.shape.x()) <  SeatedConst.SEAT_CLIP_RADIUS;
					const isClippingY = Math.abs(selectedSeat.shape.y() - element.shape.y()) <  SeatedConst.SEAT_CLIP_RADIUS;

					// finding magnitude(distance) between two points
					const vectorDistanceBetweenTwoPointsToPreventIdiotsFromBeingIdiots : Vector2d = {x: element.shape.x() - selectedSeat.shape.x(),y: element.shape.y() - selectedSeat.shape.y()};
					const magnitude = Math.sqrt(Math.pow(vectorDistanceBetweenTwoPointsToPreventIdiotsFromBeingIdiots.x,2) + Math.pow(vectorDistanceBetweenTwoPointsToPreventIdiotsFromBeingIdiots.y,2));


					// Idiot proof checkup to prevent people from stacking seats
					if(this._lastPosition != null && magnitude <= element.shape.width()){
						selectedSeat.shape.setPosition(this._lastPosition);
						break;
					}

					// Clips dragged seat on the x axis
					if(isClippingX && !isClippingY){
						selectedSeat.shape.setPosition({x:element.shape.x(), y:selectedSeat.shape.y()})
						break;
					}
					// Clips dragged seat on the y axis
					if(isClippingY && !isClippingX){
						selectedSeat.shape.setPosition({x:selectedSeat.shape.x(), y:element.shape.y()})
						break;
					}

					//registers last position of the selected seat for the idiot proof function
				}
				this._lastPosition = selectedSeat.shape.getPosition();
			}
		})
	}
}
