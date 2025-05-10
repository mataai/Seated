import Konva from 'konva';

export class SeatedObject<T extends Konva.Shape = Konva.Shape, D = any> {
  public isSelected = false;
  constructor(
    public readonly internalId: string,
    public shape: T,
    public data?: D
  ) {}
  public setSelected(selected: boolean): void {
    this.isSelected = selected;
  }
}
