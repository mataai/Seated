import { Subject, Observable } from 'rxjs';
import { Circle } from 'konva/lib/shapes/Circle';
import { Seat, Table } from '../objects';
import { SeatedEvent } from '../events';
import { SeatedSeatSaveData, SeatedTableSaveData, Vector2d } from '../models';
import { EngineState } from '../engine/engine.state';
import { SeatedConst } from '../const';

export class SeatMediator extends Observable<SeatMediator> {
	private _tableEventSubject: Subject<SeatedEvent<Table>> = new Subject<SeatedEvent<Table>>();
	private _seatEventSubject: Subject<SeatedEvent<Seat>> = new Subject<SeatedEvent<Seat>>();
	public get seatEventObservable$(): Observable<SeatedEvent<Seat>> {
		return this._seatEventSubject.asObservable();
	}

	private _seats: Seat[] = [];
	private _tables: Table[] = [];
	private _lastPosition: Vector2d | null = null;

	constructor() {
		super();
		this._initiateObservers();
	}

	public registerTable(table: Table): void {
		console.log('table');
		this._tables.push(table);
		console.log(this._tables);
		table.shape.on('click tap', () => {
			this._tableEventSubject.next({ type: 'click', data: table });
		});
		table.shape.on('dragstart', () => {
			this._tableEventSubject.next({ type: 'dragstart', data: table });
		});
		table.shape.on('dragend', () => {
			this._tableEventSubject.next({ type: 'dragend', data: table });
		});
		table.shape.on('dragmove', () => {
			this._tableEventSubject.next({ type: 'dragmove', data: table });
		});
		table.shape.on('mouseover', () => {
			this._tableEventSubject.next({ type: 'mouseover', data: table });
		});
		table.shape.on('mouseout', () => {
			this._tableEventSubject.next({ type: 'mouseout', data: table });
		});
		this._tableEventSubject.next({ type: 'dragend', data: table });
	}
	public registerSeat(seat: Seat): void {
		this._seats.push(seat);
		seat.on('click tap', () => {
			this._seatEventSubject.next({ type: 'click', data: seat });
		});
		seat.on('dragstart', () => {
			this._seatEventSubject.next({ type: 'dragstart', data: seat });
		});
		seat.on('dragend', () => {
			this._seatEventSubject.next({ type: 'dragend', data: seat });
		});
		seat.on('dragmove', () => {
			this._seatEventSubject.next({ type: 'dragmove', data: seat });
		});
		seat.on('mouseover', () => {
			this._seatEventSubject.next({ type: 'mouseover', data: seat });
		});
		seat.on('mouseout', () => {
			this._seatEventSubject.next({ type: 'mouseout', data: seat });
		});
		this._seatEventSubject.next({ type: 'dragend', data: seat });
	}

	public clear(): void {
		this._seats = [];
		this._tables = [];
	}

	public export(): { seats: SeatedSeatSaveData[]; tables: SeatedTableSaveData[] } {
		return {
			tables: this._tables.map((table) => {
				const outShape = {
					id: table.shape.id(),
					x: table.shape.x(),
					y: table.shape.y(),
					width: table.shape.width() * table.shape.scaleX(),
					height: table.shape.height() * table.shape.scaleY(),
					rotation: table.shape.rotation(),
					fill: table.shape.fill(),
				};
				return { ...table, shape: outShape };
			}),
			seats: this._seats.map((seat) => {
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
			}),
		};
	}

	private _initiateObservers(): void {
		EngineState.editableObs.subscribe((v) => {
			this._seats.forEach((seat) => {
				seat.shape.draggable(v);
			});
			this._tables.forEach((table) => {
				table.shape.draggable(v);
			});
		});

		EngineState.selectedNodeObs.subscribe((v) => {
			[...this._seats, ...this._tables].forEach((seat) => {
				seat.setSelected(v?.internalId == seat.internalId);
			});
		});
		this._tableEventSubject.asObservable().subscribe(({ type, data: selected }: SeatedEvent<Table>) => {
			switch (type) {
				case 'click':
					this._tableClipChecking(selected);
					break;
				default:
					break;
			}
		});
		this.seatEventObservable$.subscribe(({ type, data: selected }) => {
			switch (type) {
				case 'dragmove':
					this._seatClipChecking(selected);
					break;
				case 'click':
					EngineState.setSelectedNode(selected);
					break;
				default:
					break;
			}
		});
	}

	private _tableClipChecking(selectedTable: Table): void {
		const rectangle = selectedTable.shape;
		for (const seat of this._seats) {
			const circle = seat.shape as Circle;
			// detect if seat(circle) is inside table(rectangle)
			// if it is then move it to the edge of the table
			// Calculate the distance between the center of the circle and the center of the rectangle
			const dx = circle.x() - rectangle.x() - rectangle.width() / 2;
			const dy = circle.y() - rectangle.y() - rectangle.height() / 2;
			const distance = Math.sqrt(dx * dx + dy * dy);

			// If the circle is already outside the rectangle, return it unchanged
			if (
				distance > rectangle.width() / 2 + circle.radius() ||
				distance > rectangle.height() / 2 + circle.radius()
			) {
				continue;
			}

			// Calculate the angle between the center of the circle and the center of the rectangle
			const angle = Math.atan2(dy, dx);

			// Calculate the point where the circle intersects the edge of the rectangle
			const x =
				rectangle.x() + rectangle.width() / 2 + Math.cos(angle) * (rectangle.width() / 2 + circle.radius());
			const y =
				rectangle.y() + rectangle.height() / 2 + Math.sin(angle) * (rectangle.height() / 2 + circle.radius());

			// Return a new circle with the same radius but moved to the edge of the rectangle
			circle.setPosition({ x, y });
		}
	}

	private _seatClipChecking(selectedSeat: Seat): void {
		// last position of selected seat

		// Check collision with table
		console.log(this._tables);
		for (const element of this._tables) {
			const selectedSeatX = selectedSeat.shape.x();
			const selectedSeatY = selectedSeat.shape.y();

			// Checks clipping for each axis
			const isClippingX =
				selectedSeatX >= element.shape.x() - selectedSeat.shape.width() / 2 &&
				selectedSeatX <=
					element.shape.x() + element.shape.width() * element.shape.scaleX() + selectedSeat.shape.width() / 2;
			const isClippingY =
				selectedSeatY >= element.shape.y() - selectedSeat.shape.width() / 2 &&
				selectedSeatY <=
					element.shape.y() +
						element.shape.height() * element.shape.scaleY() +
						selectedSeat.shape.width() / 2;

			if (this._lastPosition != null && isClippingX && isClippingY) {
				selectedSeat.shape.setPosition(this._lastPosition); // reverts selected seat's position
				break;
			}
		}
		console.log(this._seats);
		for (const element of this._seats) {
			// Prevent item from clipping with itself
			if (element.internalId == selectedSeat.internalId) {
				continue;
			}

			const isClippingX = Math.abs(selectedSeat.shape.x() - element.shape.x()) < SeatedConst.SEAT_CLIP_RADIUS;
			const isClippingY = Math.abs(selectedSeat.shape.y() - element.shape.y()) < SeatedConst.SEAT_CLIP_RADIUS;
			console.log(isClippingX, isClippingY);
			// finding magnitude(distance) between two points
			const vectorDistanceBetweenTwoPointsToPreventIdiotsFromBeingIdiots: Vector2d = {
				x: element.shape.x() - selectedSeat.shape.x(),
				y: element.shape.y() - selectedSeat.shape.y(),
			};
			const magnitude = Math.sqrt(
				Math.pow(vectorDistanceBetweenTwoPointsToPreventIdiotsFromBeingIdiots.x, 2) +
					Math.pow(vectorDistanceBetweenTwoPointsToPreventIdiotsFromBeingIdiots.y, 2),
			);
			console.log(this._lastPosition != null, magnitude, element.shape.width());

			// Idiot proof checkup to prevent people from stacking seats
			if (this._lastPosition != null && magnitude <= element.shape.width()) {
				selectedSeat.shape.setPosition(this._lastPosition);
				break;
			}

			// Clips dragged seat on the x axis
			if (isClippingX && !isClippingY) {
				selectedSeat.shape.setPosition({ x: element.shape.x(), y: selectedSeat.shape.y() });
				break;
			}
			// Clips dragged seat on the y axis
			if (isClippingY && !isClippingX) {
				selectedSeat.shape.setPosition({ x: selectedSeat.shape.x(), y: element.shape.y() });
				break;
			}
		}
		//registers last position of the selected seat for the idiot proof function
		this._lastPosition = selectedSeat.shape.getPosition();
	}
}
