export class Mouse {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public clicked: boolean = false,
    public trackLocation: boolean = false
  ) {
    window.addEventListener('mousedown', (event) => {
      this.clicked = true;
    });

    window.addEventListener('mouseup', (event) => {
      this.clicked = false;
    });
  }
}
