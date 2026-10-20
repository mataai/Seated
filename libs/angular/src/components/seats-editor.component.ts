import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import type {
  Building,
  Floorplan,
  FloorplanBackground,
  Row,
  Seat,
  Vec2,
  Violation,
  Zone,
} from '@open-seats/core';
import {
  createEditor,
  type EditorInstance,
  type EditorOptions,
  type ToolType,
} from '@open-seats/editor';

@Component({
  selector: 'seats-editor',
  standalone: true,
  template: `
    <div
      #container
      class="seats-editor-container"
      style="width: 100%; height: 100%; position: relative; overflow: hidden;"
    ></div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class SeatsEditorComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @ViewChild('container', { static: true })
  containerRef!: ElementRef<HTMLDivElement>;

  @Input() floorplan?: Floorplan;
  @Input() tool: ToolType = 'select';
  @Input() options?: Partial<EditorOptions>;

  @Output() change = new EventEmitter<Floorplan>();
  @Output() toolChange = new EventEmitter<ToolType>();
  @Output() selectionChange = new EventEmitter<string[]>();
  @Output() previewToggle = new EventEmitter<boolean>();
  @Output() violationsUpdated = new EventEmitter<Violation[]>();

  private editor?: EditorInstance;
  private lastEmittedPlan?: Floorplan;

  constructor(private ngZone: NgZone) {}

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.editor = createEditor(this.containerRef.nativeElement, {
        ...this.options,
        floorplan: this.floorplan,
      });

      this.editor.setTool(this.tool);

      this.editor.on('change', (plan) => {
        this.lastEmittedPlan = plan;
        this.ngZone.run(() => this.change.emit(plan));
      });

      this.editor.on('toolChange', (t) => {
        this.ngZone.run(() => this.toolChange.emit(t));
      });

      this.editor.on('selectionChange', (ids) => {
        this.ngZone.run(() => this.selectionChange.emit(ids));
      });

      this.editor.on('previewToggle', (isPreview) => {
        this.ngZone.run(() => this.previewToggle.emit(isPreview));
      });

      this.editor.on('violationsUpdated', (violations) => {
        this.ngZone.run(() => this.violationsUpdated.emit(violations));
      });
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.editor) return;

    this.ngZone.runOutsideAngular(() => {
      if (changes['floorplan'] && this.floorplan) {
        // Only load if the floorplan did NOT originate from the editor's own change event
        if (this.floorplan !== this.lastEmittedPlan) {
          const current = this.editor!.getFloorplan();
          if (JSON.stringify(current) !== JSON.stringify(this.floorplan)) {
            this.editor!.loadFloorplan(this.floorplan);
          }
        }
      }

      if (changes['tool'] && this.tool) {
        this.editor!.setTool(this.tool);
      }
    });
  }

  public getFloorplan(): Floorplan | undefined {
    return this.editor?.getFloorplan();
  }

  public loadFloorplan(plan: Floorplan): void {
    this.editor?.loadFloorplan(plan);
  }

  public setTool(tool: ToolType): void {
    this.editor?.setTool(tool);
  }

  public undo(): boolean {
    return this.editor?.undo() ?? false;
  }

  public redo(): boolean {
    return this.editor?.redo() ?? false;
  }

  public canUndo(): boolean {
    return this.editor?.canUndo() ?? false;
  }

  public canRedo(): boolean {
    return this.editor?.canRedo() ?? false;
  }

  public togglePreview(enabled?: boolean): boolean {
    return this.editor?.togglePreview(enabled) ?? false;
  }

  public isPreview(): boolean {
    return this.editor?.isPreview() ?? false;
  }

  public setBackground(bg: FloorplanBackground | undefined): void {
    this.editor?.setBackground(bg);
  }

  public createBuilding(
    points: Vec2[],
    label?: string,
    position?: Vec2
  ): Building | null {
    return this.editor?.createBuilding(points, label, position) ?? null;
  }

  public createZone(
    buildingId: string,
    points: Vec2[],
    fill?: string,
    position?: Vec2
  ): Zone | null {
    return (
      this.editor?.createZone(buildingId, points, fill ?? '#555555', position) ??
      null
    );
  }

  public createRow(
    buildingId: string,
    position: Vec2,
    seatCount: number,
    opts?: {
      side?: 'one' | 'both';
      seatSpacing?: number;
      seatRadius?: number;
      tableWidth?: number;
      rotation?: number;
    }
  ): Row | null {
    return (
      this.editor?.createRow(buildingId, position, seatCount, opts) ?? null
    );
  }

  public addSeatToRow(
    buildingId: string,
    rowId: string,
    side?: 'a' | 'b'
  ): Seat | null {
    return this.editor?.addSeatToRow(buildingId, rowId, side) ?? null;
  }

  public moveNode(nodeId: string, newPosition: Vec2): boolean {
    return this.editor?.moveNode(nodeId, newPosition) ?? false;
  }

  public rotateNode(nodeId: string, newRotation: number): boolean {
    return this.editor?.rotateNode(nodeId, newRotation) ?? false;
  }

  public reparentRow(
    rowId: string,
    targetBuildingId: string,
    dropWorldPosition?: Vec2
  ): boolean {
    return (
      this.editor?.reparentRow(rowId, targetBuildingId, dropWorldPosition) ??
      false
    );
  }

  public deleteNode(nodeId: string): boolean {
    return this.editor?.deleteNode(nodeId) ?? false;
  }

  public addSeatOnCanvas(buildingId: string, position: Vec2): Row | null {
    return this.editor?.addSeatOnCanvas(buildingId, position) ?? null;
  }

  public moveSeatToRow(
    sourceRowId: string,
    seatId: string,
    targetRowId: string,
    targetSide?: 'a' | 'b'
  ): boolean {
    return (
      this.editor?.moveSeatToRow(sourceRowId, seatId, targetRowId, targetSide) ??
      false
    );
  }

  public setRowSide(rowId: string, side: 'one' | 'both'): boolean {
    return this.editor?.setRowSide(rowId, side) ?? false;
  }

  public setRowTableWidth(rowId: string, tableWidth: number): boolean {
    return this.editor?.setRowTableWidth(rowId, tableWidth) ?? false;
  }

  public setRowSeatSpacing(rowId: string, seatSpacing: number): boolean {
    return this.editor?.setRowSeatSpacing(rowId, seatSpacing) ?? false;
  }

  public moveVertex(
    polygonNodeId: string,
    vertexIndex: number,
    newPosition: Vec2
  ): boolean {
    return (
      this.editor?.moveVertex(polygonNodeId, vertexIndex, newPosition) ?? false
    );
  }

  public addVertex(
    polygonNodeId: string,
    afterIndex: number,
    newPoint: Vec2
  ): boolean {
    return this.editor?.addVertex(polygonNodeId, afterIndex, newPoint) ?? false;
  }

  public deleteVertex(polygonNodeId: string, vertexIndex: number): boolean {
    return this.editor?.deleteVertex(polygonNodeId, vertexIndex) ?? false;
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }
}
