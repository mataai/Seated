import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { Engine } from './CanvasEngine';
import { Seat } from './CanvasEngine/items';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements AfterViewInit {
  @ViewChild('canvas') public canvas?: ElementRef;

  public engine?: Engine;

  public data: string = '';

  constructor() {}

  ngAfterViewInit() {
    this.engine = new Engine(
      this.canvas?.nativeElement as HTMLCanvasElement,
      'white'
    );
    const seat = new Seat(50, 50, 15, 'blue', true);
    const seat1 = new Seat(50, 150, 25, 'blue', true);
    this.engine.addShape(seat);
    this.engine.addShape(seat1);
  }

  public load() {
    this.engine?.loadData(this.data);
  }
  public export() {
    console.log(this.engine?.saveData());
  }
}
