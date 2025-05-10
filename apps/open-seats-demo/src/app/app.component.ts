import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { Seated } from '@open-seats/core';

@Component({
  standalone: true,
	selector: 'open-seats-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss'],
})
export class AppComponent implements AfterViewInit {
	@ViewChild('chartContainer') chartContainer!: ElementRef;

	title = 'angular';
	chart!: Seated;

	ngAfterViewInit() {
		console.log('this.chartContainer', this.chartContainer);
		this.chart = new Seated(this.chartContainer.nativeElement, true);
	}

	public addChair(): void {
		this.chart.createSeat({
			x: 100,
			y: 100,
			radius: 20,
			color: '#000000',
			id: 'chair',
			data: {},
		});
	}

	public addTable(): void {
		this.chart.createTable({
			x: 100,
			y: 100,
			width: 100,
			height: 100,
			rotation: 0,
			color: '#000000',
			id: 'table',
			data: {},
		});
	}

	public save(): void {
		localStorage.setItem('seated', JSON.stringify(this.chart.export()));
	}
	public load(): void {
		this.chart.import(JSON.parse(localStorage.getItem('seated') || ''));
	}
}
