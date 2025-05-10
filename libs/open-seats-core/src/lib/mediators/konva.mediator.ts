import Konva from 'konva';
import { KonvaOutput, SeatedSaveData } from '../models';

export class KonvaMediator {
	public static instance: KonvaMediator;
	private _importedData?: SeatedSaveData;
	private _stage: Konva.Stage;
	private _seatLayer: Konva.Layer;

	constructor(private _container: HTMLDivElement) {
		KonvaMediator.instance = this;
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

	public createStage(x: number, y: number, container: HTMLDivElement): void {
		this._stage = new Konva.Stage({
			container: container, // id of container <div>
			width: x,
			height: y,
		});
		this._seatLayer = new Konva.Layer({ name: 'seatLayer' });
		this._stage.add(this._seatLayer);
		this._seatLayer.draw();
	}

	public addToSeatLayer(children: Konva.Shape | Konva.Group) {
		this._seatLayer.add(children);
	}

	public import(data: SeatedSaveData): void {
		this._importedData = data;
		this.createStage(data.dimentions.width, data.dimentions.height, this._container);
		this._seatLayer.clear();
	}

	public export(): KonvaOutput {
		return this._stage.toObject();
	}
}
