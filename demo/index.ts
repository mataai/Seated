import Seated from '../src';
import './index.css';

var seated: Seated;
var rowCreationMode = false;

const sidebar = document.createElement('div');

sidebar.style.width = '200px';
sidebar.style.height = '100%';
sidebar.style.backgroundColor = 'gray';
sidebar.style.position = 'fixed';
sidebar.style.top = '0';
sidebar.style.right = '0';
sidebar.style.zIndex = '5';
document.body.appendChild(sidebar);


// NEW SEAT
let fab = document.createElement('div');
fab.style.backgroundColor = 'cyan';
fab.style.position = 'fixed';
fab.style.bottom = '50px';
fab.style.left = '50px';
fab.style.width = '100px';
fab.style.height = '100px';
fab.style.borderRadius = '50%';
fab.style.zIndex = '5';
fab.innerHTML = '+';
fab.style.display = 'grid';
fab.style.placeContent = 'center';
fab.style.cursor = 'pointer';
fab.addEventListener('click', (click) => {
	console.log(click);
	rowCreationMode = !rowCreationMode;

	// seated.createSeat({
	// 	radius: 5,
	// 	color: 'red',
	// 	data: { row: 'B', number: 14 },
	// });
});
document.body.appendChild(fab);


// SAVE
let fab2 = document.createElement('div');
fab2.style.backgroundColor = 'cyan';
fab2.style.position = 'fixed';
fab2.style.bottom = '50px';
fab2.style.left = '150px';
fab2.style.width = '100px';
fab2.style.height = '100px';
fab2.style.borderRadius = '50%';
fab2.style.zIndex = '5';
fab2.innerHTML = 'save';
fab2.style.display = 'grid';
fab2.style.placeContent = 'center';
fab2.style.cursor = 'pointer';
fab2.addEventListener('click', (click) => {
	console.log(click);
	let data = seated.export();
	console.log(data);
	localStorage.setItem('data', JSON.stringify(data));
});
document.body.appendChild(fab2);


// CREATE NEW
let fab3 = document.createElement('div');
fab3.style.backgroundColor = 'cyan';
fab3.style.position = 'fixed';
fab3.style.bottom = '150px';
fab3.style.left = '50px';
fab3.style.width = '100px';
fab3.style.height = '100px';
fab3.style.borderRadius = '50%';
fab3.style.zIndex = '5';
fab3.innerHTML = 'create new';
fab3.style.display = 'grid';
fab3.style.placeContent = 'center';
fab3.style.cursor = 'pointer';
fab3.addEventListener('click', (click) => {
	seated.import();
});
document.body.appendChild(fab3);

// LOAD
let fab4 = document.createElement('div');
fab4.style.backgroundColor = 'cyan';
fab4.style.position = 'fixed';
fab4.style.bottom = '150px';
fab4.style.left = '150px';
fab4.style.width = '100px';
fab4.style.height = '100px';
fab4.style.borderRadius = '50%';
fab4.style.zIndex = '5';
fab4.innerHTML = 'load';
fab4.style.display = 'grid';
fab4.style.placeContent = 'center';
fab4.style.cursor = 'pointer';
fab4.addEventListener('click', () => {
	seated.import(JSON.parse(localStorage.getItem('data') || ''));
});
document.body.appendChild(fab4);

// TOGGLE EDIT
let fab5 = document.createElement('div');
fab5.style.backgroundColor = 'cyan';
fab5.style.position = 'fixed';
fab5.style.bottom = '300px';
fab5.style.left = '75px';
fab5.style.width = '100px';
fab5.style.height = '100px';
fab5.style.borderRadius = '50%';
fab5.style.zIndex = '5';
fab5.innerHTML = 'Toggle Edit';
fab5.style.display = 'grid';
fab5.style.placeContent = 'center';
fab5.style.cursor = 'pointer';
fab5.addEventListener('click', () => {
	seated.setEditionMode(!seated.editMode);
});
document.body.appendChild(fab5);

let container = document.createElement('div');
container.id = 'container';
container.style.height = '100%';

document.body.appendChild(container);

container.addEventListener('click', (click) => {
	if (rowCreationMode) {
		seated.createRow({
			x: click.offsetX,
			y: click.offsetY,
		});
		rowCreationMode = false;
	}
})

seated = new Seated(container, true);
seated?.createSeat({
	x: 512,
	y: 512,
	radius: 5,
	color: 'red',
	data: { row: 'B', number: 14 },
});

seated.seatEventObservable$.subscribe({
	next: (event) => {
		if (event.type === 'click') {
			console.log("banana", event.data)
			console.log(seated.selected)
		}
	},
});
