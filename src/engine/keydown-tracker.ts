export class KeydownTracker {
	private static instance: KeydownTracker;
	private keydownMap: Map<string, boolean> = new Map();

	private constructor() {
		window.addEventListener('keydown', (e) => {
			this.keydownMap.set(e.key, true);
		});
		window.addEventListener('keyup', (e) => {
			this.keydownMap.set(e.key, false);
		});

		KeydownTracker.instance = this;
	}

	public static getInstance(): KeydownTracker {
		if (!KeydownTracker.instance) {
			KeydownTracker.instance = new KeydownTracker();
		}
		return KeydownTracker.instance;
	}

	public isKeyDown(key: string): boolean {
		return this.keydownMap.get(key) || false;
	}
}
