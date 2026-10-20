import Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import { Table, TableConfig } from '../objects';
import { EngineState } from '../engine/engine.state';
import { KonvaMediator } from '../mediators';

export class TableFactory {
	constructor(private _konvaMediator: KonvaMediator) {}
	public createTable(tableConfig: TableConfig): Table {
		const id = uuidv4();


		const rect = new Konva.Rect({
			x: tableConfig.x,
			y: tableConfig.y,
			rotation: tableConfig.rotation,
			width: tableConfig.width,
			height: tableConfig.height,
			fill: tableConfig.color,
			id: tableConfig.id || id,
			draggable: EngineState.editable,
		});

		const table = new Table(id, null, rect);
		this._konvaMediator.addToSeatLayer(rect);

		return table;
	}
}
