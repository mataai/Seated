class Engine {
  _canvas;
  _ctx;
  _trackMouse = false;
  _backgroundColor = "white";

  shapes = [];

  /**
   * @param {HTMLCanvasElement} _canvas
   * @param {string} _backgroundColor
   */
  constructor(_canvas, _backgroundColor) {
    this._canvas = _canvas;
    if (_backgroundColor) this._backgroundColor = _backgroundColor;
    this._ctx = _canvas.getContext("2d");
    this.fit_dpi();
    window.addEventListener("resize", this.fit_dpi);
    requestAnimationFrame(this.animate.bind(this));
  }

  fit_dpi() {
    let style_width = +getComputedStyle(canvas)
      .getPropertyValue("width")
      .slice(0, -2);
    let style_height = +getComputedStyle(canvas)
      .getPropertyValue("height")
      .slice(0, -2);
    this._canvas.setAttribute("height", style_height * window.devicePixelRatio);
    this._canvas.setAttribute("width", style_width * window.devicePixelRatio);
  }

  animate() {
    ctx.fillStyle = this._backgroundColor;
    ctx.fillRect(
      0,
      0,
      +getComputedStyle(canvas).getPropertyValue("width").slice(0, -2) *
        window.devicePixelRatio,
      +getComputedStyle(canvas).getPropertyValue("height").slice(0, -2) *
        window.devicePixelRatio
    );
    requestAnimationFrame(this.animate.bind(this));
  }

  addShape(){
      ctx.fillStyle()
  }
}
