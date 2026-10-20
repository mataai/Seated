import Konva from 'konva';
import { SeatedObject } from '../seated-object';
import { KonvaMediator } from '../../mediators';

export class Table extends SeatedObject {
	private _transformer: Konva.Transformer | null = null;

	public override setSelected(selected: boolean): void {
		// this.isSelected = selected;
		// if (selected) {
		// 	const tr = new Konva.Transformer({
		// 		boundBoxFunc: function (oldBoundBox, newBoundBox) {
		// 			return newBoundBox;
		// 		},
		// 	});

		// 	tr.nodes([this.shape]);
		// 	this._transformer = tr;
		// 	KonvaMediator.instance.addToSeatLayer(tr);
		// } else {
		// 	this._transformer?.destroy();
		// 	this._transformer = null;
		// }
	}
}
