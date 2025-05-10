import { BehaviorSubject, Observable } from 'rxjs';
import { SeatedObject } from '../objects';

export class EngineState {
	private static _editable: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true);
	public static get editable(): boolean {
		return this._editable.getValue();
	}
	public static get editableObs(): Observable<boolean> {
		return this._editable.asObservable();
	}
	public static setEditable(v: boolean) {
		this._editable.next(v);
	}

	private static _selectedNode: BehaviorSubject<SeatedObject | null> = new BehaviorSubject<SeatedObject | null>(null);
	public static get selectedNode(): SeatedObject | null {
		return this._selectedNode.getValue();
	}
	public static get selectedNodeObs(): Observable<SeatedObject | null> {
		return this._selectedNode.asObservable();
	}
	public static setSelectedNode(v: SeatedObject) {
		this._selectedNode.next(v);
	}
}
