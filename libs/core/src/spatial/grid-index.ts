import type { BoundingBox } from '../geometry/overlap';

export class GridSpatialIndex {
  private cellSize: number;
  private cells = new Map<string, Set<string>>();
  private itemBoxes = new Map<string, BoundingBox>();

  constructor(cellSize = 100) {
    this.cellSize = cellSize > 0 ? cellSize : 100;
  }

  private cellKey(gx: number, gy: number): string {
    return `${gx}:${gy}`;
  }

  private getGridRange(box: BoundingBox): {
    minGx: number;
    maxGx: number;
    minGy: number;
    maxGy: number;
  } {
    return {
      minGx: Math.floor(box.minX / this.cellSize),
      maxGx: Math.floor(box.maxX / this.cellSize),
      minGy: Math.floor(box.minY / this.cellSize),
      maxGy: Math.floor(box.maxY / this.cellSize),
    };
  }

  public insert(id: string, box: BoundingBox): void {
    if (this.itemBoxes.has(id)) {
      this.remove(id);
    }
    this.itemBoxes.set(id, box);

    const { minGx, maxGx, minGy, maxGy } = this.getGridRange(box);
    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gy = minGy; gy <= maxGy; gy++) {
        const key = this.cellKey(gx, gy);
        let cell = this.cells.get(key);
        if (!cell) {
          cell = new Set<string>();
          this.cells.set(key, cell);
        }
        cell.add(id);
      }
    }
  }

  public remove(id: string): void {
    const box = this.itemBoxes.get(id);
    if (!box) return;

    const { minGx, maxGx, minGy, maxGy } = this.getGridRange(box);
    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gy = minGy; gy <= maxGy; gy++) {
        const key = this.cellKey(gx, gy);
        const cell = this.cells.get(key);
        if (cell) {
          cell.delete(id);
          if (cell.size === 0) {
            this.cells.delete(key);
          }
        }
      }
    }
    this.itemBoxes.delete(id);
  }

  public query(box: BoundingBox): string[] {
    const { minGx, maxGx, minGy, maxGy } = this.getGridRange(box);
    const candidates = new Set<string>();

    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gy = minGy; gy <= maxGy; gy++) {
        const key = this.cellKey(gx, gy);
        const cell = this.cells.get(key);
        if (cell) {
          for (const id of cell) {
            candidates.add(id);
          }
        }
      }
    }

    return Array.from(candidates);
  }

  public clear(): void {
    this.cells.clear();
    this.itemBoxes.clear();
  }
}
