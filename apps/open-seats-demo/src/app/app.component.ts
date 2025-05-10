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

  public addBackground(): void {
    this.chart.setBackground(
      'https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwzNjUyOXwwfDF8c2VhcmNofDJ8fGJhY2tncm91bmR8ZW58MHx8fHwxNjg5NTQ1NzA3&ixlib=rb-4.0.3&q=80&w=1080'
    );
  }

  public onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    console.log('file', file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        this.chart.setBackground(imageUrl);
      };
      reader.readAsDataURL(file);
    }

  }

	public save(): void {
		localStorage.setItem('seated', JSON.stringify(this.chart.export()));
	}
	public load(): void {
		this.chart.import(JSON.parse(localStorage.getItem('seated') || ''));
	}
}
