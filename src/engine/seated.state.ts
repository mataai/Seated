import { BehaviorSubject } from 'rxjs';

export class SeatedState {
	private _seats: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([]);
	public get seats(): string[] {
		return this._seats.getValue();
	}
	public set seats(v: string[]) {
		this._seats.next(v);
	}
}
