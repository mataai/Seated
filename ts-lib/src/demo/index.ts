import Seated from '../lib';
import './index.css';

var seated;

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
	seated.createSeat({
		radius: 5,
		fill: 'red',
		id: 'B-14',
		onClick: (data) => {
			console.log(data);
		},
		onMouseOver: (data) => {
			console.log(data);
			container.style.cursor = 'pointer';
		},
		onMouseOut: (data) => {
			console.log(data);
			container.style.cursor = 'default';
		},
	});
});
document.body.appendChild(fab);

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
	localStorage.setItem('data', data);
});
document.body.appendChild(fab2);

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
	seated = new Seated(container, true);
});
document.body.appendChild(fab3);

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
fab4.addEventListener('click', (click) => {
	seated = new Seated(container, true, localStorage.getItem('data')!);
});
document.body.appendChild(fab4);

let container = document.createElement('div');
container.id = 'container';
container.style.height = '100%';

document.body.appendChild(container);

if (!seated) {
	seated = new Seated(container, true);
}
seated?.createSeat({
	x: 512,
	y: 512,
	radius: 5,
	fill: 'red',
	id: 'B-14',
	onClick: (data) => {
		console.log(data);
	},
	onMouseOver: (data) => {
		console.log(data);
		container.style.cursor = 'pointer';
	},
	onMouseOut: (data) => {
		console.log(data);
		container.style.cursor = 'default';
	},
});

var save = () => {};

export default save;
