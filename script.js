let dpi = window.devicePixelRatio;

const canvas = document.getElementById("canvas");
const test = new Engine(canvas);
const ctx = canvas.getContext("2d");
const mouse = { x: 0, y: 0, clicked: false };
let square = { x: 10, y: 10, w: 250, h: 250 };

window.addEventListener("mousedown", (event) => {
  mouse.clicked = true;
  console.log("down", mouse);
});
window.addEventListener("mouseup", (event) => {
  mouse.clicked = false;
  console.log("up", mouse);
});

window.addEventListener("mousemove", (event) => {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
});
