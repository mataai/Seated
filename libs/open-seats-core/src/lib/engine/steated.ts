import { SeatConfig, TableConfig } from '../objects';
import {
  KonvaOutput,
  SeatedSaveData,
  SeatedSeatSaveData,
  SeatedTableSaveData,
} from '../models';
import { SeatFactory, TableFactory } from '../factory';
import { SeatMediator, KonvaMediator } from '../mediators';
import { container } from 'tsyringe';
import Konva from 'konva';

export class Seated {
  private _konvaMediator: KonvaMediator;
  private _tableFactory: TableFactory;
  private _seatFactory: SeatFactory = new SeatFactory();
  private _seatMediator: SeatMediator = new SeatMediator();

  public get editMode() {
    return this._editionMode;
  }

  constructor(
    private _container: HTMLDivElement,
    private _editionMode: boolean
  ) {
    this._konvaMediator = new KonvaMediator(_container);
    container.registerInstance(KonvaMediator, this._konvaMediator);
    this._tableFactory = new TableFactory(this._konvaMediator);
  }

  public setEditionMode(editionMode: boolean): void {
    this._editionMode = editionMode;
  }

  public createSeat(seatConfig: SeatConfig): void {
    const createdSeat = this._seatFactory.createSeat({
      ...seatConfig,
      x: seatConfig.x ?? this._container.getBoundingClientRect().width / 2,
      y: seatConfig.y ?? this._container.getBoundingClientRect().height / 2,
    });
    this._konvaMediator.addToSeatLayer(createdSeat.shape);
    this._seatMediator.registerSeat(createdSeat);
  }

  public createTable(tableConfig: TableConfig): void {
    const createdTable = this._tableFactory.createTable({
      ...tableConfig,
      x: tableConfig.x ?? this._container.getBoundingClientRect().width / 2,
      y: tableConfig.y ?? this._container.getBoundingClientRect().height / 2,
    });
    this._seatMediator.registerTable(createdTable);
  }

  public import(data?: SeatedSaveData): void {
    this._seatMediator.clear();
    console.log(data);
    if (!data) {
      this._konvaMediator.createStage(
        this._container.getBoundingClientRect().width,
        this._container.getBoundingClientRect().height,
        this._container
      );
    } else {
      this._konvaMediator.import(data);
      data.seats.forEach((seat) => {
        this.createSeat({
          x: seat.shape.x,
          y: seat.shape.y,
          radius: seat.shape.radius,
          color: seat.shape.fill,
          id: seat.internalId,
          data: seat.data,
        });
      });
      data.tables.forEach((table) => {
        this.createTable({
          x: table.shape.x,
          y: table.shape.y,
          width: table.shape.width,
          height: table.shape.height,
          rotation: table.shape.rotation,
          color: table.shape.fill,
          id: table.internalId,
          data: table.data,
        });
      });
    }
  }

  public export(): SeatedSaveData {
    const { konva, background }: { konva: KonvaOutput; background: string } =
      this._konvaMediator.export();
    const exports: {
      seats: SeatedSeatSaveData[];
      tables: SeatedTableSaveData[];
    } = this._seatMediator.export();
    return {
      ...exports,
      dimentions: { width: konva.attrs.width!, height: konva.attrs.height! },
      background,
    };
  }

  public setBackground(image: string): void {
    this._konvaMediator.setBackground(image);
  }
}
