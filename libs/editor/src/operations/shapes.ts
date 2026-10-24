import {
  canPlace,
  flipPolygon,
  polygonBoundingBox,
  polygonCentroid,
  scalePolygon,
  type Building,
  type Floorplan,
  type Row,
  type Vec2,
  type Zone,
} from '@open-seats/core';
import type { EditorContext } from './context';

/** Polygon geometry edits: flipping, scaling, resizing and vertex manipulation. */
export class ShapeOperations {
  constructor(private readonly ctx: EditorContext) {}

  public flipNode(
    nodeId: string,
    direction: 'horizontal' | 'vertical'
  ): boolean {
    const building = this.ctx.floorplan.buildings.find((b) => b.id === nodeId);
    if (building) {
      const oldPoints = building.points.map((p) => ({ ...p }));
      const oldRows = [...building.rows];
      const oldZones = [...building.zones];

      const flippedPoints = flipPolygon(building.points, direction);
      const centroid = polygonCentroid(building.points);

      const flippedRows: Row[] = building.rows.map((r) => {
        const newPos =
          direction === 'horizontal'
            ? { x: 2 * centroid.x - r.position.x, y: r.position.y }
            : { x: r.position.x, y: 2 * centroid.y - r.position.y };
        const newRot =
          direction === 'horizontal'
            ? (180 - r.rotation + 360) % 360
            : (360 - r.rotation) % 360;
        return {
          ...r,
          position: this.ctx.snap(newPos),
          rotation: newRot,
        };
      });

      const flippedZones: Zone[] = building.zones.map((z) => {
        const newPos =
          direction === 'horizontal'
            ? { x: 2 * centroid.x - z.position.x, y: z.position.y }
            : { x: z.position.x, y: 2 * centroid.y - z.position.y };
        const newRot =
          direction === 'horizontal'
            ? (180 - z.rotation + 360) % 360
            : (360 - z.rotation) % 360;
        return {
          ...z,
          position: this.ctx.snap(newPos),
          rotation: newRot,
          points: flipPolygon(z.points, direction),
        };
      });

      const proposedBuilding: Building = {
        ...building,
        points: flippedPoints,
        rows: flippedRows,
        zones: flippedZones,
      };

      if (this.ctx.rules.enforce) {
        const testPlan: Floorplan = {
          ...this.ctx.floorplan,
          buildings: this.ctx.floorplan.buildings.map((b) =>
            b.id === nodeId ? proposedBuilding : b
          ),
        };
        const violations = canPlace(
          testPlan,
          nodeId,
          {},
          { tolerance: this.ctx.rules.tolerance }
        );
        if (violations.length > 0) return false;
      }

      this.ctx.commandStack.execute({
        name: `Flip Building ${building.label} ${direction}`,
        execute: () => {
          building.points = flippedPoints;
          building.rows = flippedRows;
          building.zones = flippedZones;
        },
        undo: () => {
          building.points = oldPoints;
          building.rows = oldRows;
          building.zones = oldZones;
        },
      });
      this.ctx.emitChange();
      return true;
    }

    for (const b of this.ctx.floorplan.buildings) {
      const zone = (b.zones ?? []).find((z) => z.id === nodeId);
      if (zone) {
        const oldPoints = zone.points.map((p) => ({ ...p }));
        const flippedPoints = flipPolygon(zone.points, direction);

        if (this.ctx.rules.enforce) {
          const testPlan: Floorplan = {
            ...this.ctx.floorplan,
            buildings: this.ctx.floorplan.buildings.map((bItem) =>
              bItem.id === b.id
                ? {
                    ...bItem,
                    zones: bItem.zones.map((z) =>
                      z.id === nodeId ? { ...z, points: flippedPoints } : z
                    ),
                  }
                : bItem
            ),
          };
          const violations = canPlace(
            testPlan,
            nodeId,
            {},
            { tolerance: this.ctx.rules.tolerance }
          );
          if (violations.length > 0) return false;
        }

        this.ctx.commandStack.execute({
          name: `Flip Zone ${zone.id} ${direction}`,
          execute: () => {
            zone.points = flippedPoints;
          },
          undo: () => {
            zone.points = oldPoints;
          },
        });
        this.ctx.emitChange();
        return true;
      }

      const row = (b.rows ?? []).find((r) => r.id === nodeId);
      if (row) {
        const oldRot = row.rotation;
        const newRot =
          direction === 'horizontal'
            ? (180 - row.rotation + 360) % 360
            : (360 - row.rotation) % 360;

        if (this.ctx.rules.enforce) {
          const violations = canPlace(
            this.ctx.floorplan,
            nodeId,
            { rotation: newRot },
            { tolerance: this.ctx.rules.tolerance }
          );
          if (violations.length > 0) return false;
        }

        this.ctx.commandStack.execute({
          name: `Flip Row ${row.label} ${direction}`,
          execute: () => {
            row.rotation = newRot;
          },
          undo: () => {
            row.rotation = oldRot;
          },
        });
        this.ctx.emitChange();
        return true;
      }
    }

    return false;
  }

  public scaleShape(nodeId: string, scaleX: number, scaleY: number): boolean {
    if (scaleX <= 0 || scaleY <= 0) return false;

    const building = this.ctx.floorplan.buildings.find((b) => b.id === nodeId);
    if (building) {
      const oldPoints = building.points.map((p) => ({ ...p }));
      const scaled = scalePolygon(building.points, scaleX, scaleY);

      if (this.ctx.rules.enforce) {
        const testPlan: Floorplan = {
          ...this.ctx.floorplan,
          buildings: this.ctx.floorplan.buildings.map((b) =>
            b.id === nodeId ? { ...b, points: scaled } : b
          ),
        };
        const violations = canPlace(
          testPlan,
          nodeId,
          {},
          { tolerance: this.ctx.rules.tolerance }
        );
        if (violations.length > 0) return false;
      }

      this.ctx.commandStack.execute({
        name: `Scale Building ${building.label}`,
        execute: () => {
          building.points = scaled;
        },
        undo: () => {
          building.points = oldPoints;
        },
      });
      this.ctx.emitChange();
      return true;
    }

    for (const b of this.ctx.floorplan.buildings) {
      const zone = (b.zones ?? []).find((z) => z.id === nodeId);
      if (zone) {
        const oldPoints = zone.points.map((p) => ({ ...p }));
        const scaled = scalePolygon(zone.points, scaleX, scaleY);

        if (this.ctx.rules.enforce) {
          const testPlan: Floorplan = {
            ...this.ctx.floorplan,
            buildings: this.ctx.floorplan.buildings.map((bItem) =>
              bItem.id === b.id
                ? {
                    ...bItem,
                    zones: bItem.zones.map((z) =>
                      z.id === nodeId ? { ...z, points: scaled } : z
                    ),
                  }
                : bItem
            ),
          };
          const violations = canPlace(
            testPlan,
            nodeId,
            {},
            { tolerance: this.ctx.rules.tolerance }
          );
          if (violations.length > 0) return false;
        }

        this.ctx.commandStack.execute({
          name: `Scale Zone ${zone.id}`,
          execute: () => {
            zone.points = scaled;
          },
          undo: () => {
            zone.points = oldPoints;
          },
        });
        this.ctx.emitChange();
        return true;
      }
    }

    return false;
  }

  public setShapeDimensions(
    nodeId: string,
    width: number,
    height: number
  ): boolean {
    if (width <= 0 || height <= 0) return false;

    let points: Vec2[] | undefined;
    const b = this.ctx.floorplan.buildings.find((b) => b.id === nodeId);
    if (b) {
      points = b.points;
    } else {
      for (const building of this.ctx.floorplan.buildings) {
        const z = (building.zones ?? []).find((zone) => zone.id === nodeId);
        if (z) {
          points = z.points;
          break;
        }
      }
    }

    if (!points || points.length === 0) return false;
    const bbox = polygonBoundingBox(points);
    if (bbox.width <= 0 || bbox.height <= 0) return false;

    const scaleX = width / bbox.width;
    const scaleY = height / bbox.height;
    return this.scaleShape(nodeId, scaleX, scaleY);
  }

  // ----------------------------------------------------
  // Polygon Vertex Editing (Buildings and Zones)
  // ----------------------------------------------------

  private findPolygonNode(
    nodeId: string
  ): { points: Vec2[]; label: string } | null {
    const b = this.ctx.floorplan.buildings.find((b) => b.id === nodeId);
    if (b) return { points: b.points, label: b.label };

    for (const building of this.ctx.floorplan.buildings) {
      const z = (building.zones ?? []).find((zone) => zone.id === nodeId);
      if (z) return { points: z.points, label: z.id };
    }
    return null;
  }

  public moveVertex(
    polygonNodeId: string,
    vertexIndex: number,
    newPosition: Vec2
  ): boolean {
    const node = this.findPolygonNode(polygonNodeId);
    if (!node || vertexIndex < 0 || vertexIndex >= node.points.length) {
      return false;
    }

    const snapped = this.ctx.snap(newPosition);
    const proposed = node.points.map((pt, i) =>
      i === vertexIndex ? snapped : pt
    );

    if (this.ctx.rules.enforce) {
      const violations = canPlace(
        this.ctx.floorplan,
        polygonNodeId,
        { points: proposed },
        { tolerance: this.ctx.rules.tolerance }
      );
      if (violations.length > 0) return false;
    }

    const oldPoints = [...node.points];
    this.ctx.commandStack.execute({
      name: `Move Vertex ${vertexIndex} of ${node.label}`,
      execute: () => {
        node.points.length = 0;
        node.points.push(...proposed);
      },
      undo: () => {
        node.points.length = 0;
        node.points.push(...oldPoints);
      },
    });

    this.ctx.emitChange();
    return true;
  }

  public addVertex(
    polygonNodeId: string,
    afterIndex: number,
    newPoint: Vec2
  ): boolean {
    const node = this.findPolygonNode(polygonNodeId);
    if (!node || afterIndex < 0 || afterIndex >= node.points.length) {
      return false;
    }

    const snapped = this.ctx.snap(newPoint);
    const proposed = [...node.points];
    proposed.splice(afterIndex + 1, 0, snapped);

    if (this.ctx.rules.enforce) {
      const violations = canPlace(
        this.ctx.floorplan,
        polygonNodeId,
        { points: proposed },
        { tolerance: this.ctx.rules.tolerance }
      );
      if (violations.length > 0) return false;
    }

    const oldPoints = [...node.points];
    this.ctx.commandStack.execute({
      name: `Add Vertex to ${node.label}`,
      execute: () => {
        node.points.length = 0;
        node.points.push(...proposed);
      },
      undo: () => {
        node.points.length = 0;
        node.points.push(...oldPoints);
      },
    });

    this.ctx.emitChange();
    return true;
  }

  public deleteVertex(polygonNodeId: string, vertexIndex: number): boolean {
    const node = this.findPolygonNode(polygonNodeId);
    if (!node || vertexIndex < 0 || vertexIndex >= node.points.length) {
      return false;
    }

    // A polygon must retain at least 3 vertices
    if (node.points.length <= 3) {
      return false;
    }

    const proposed = node.points.filter((_, i) => i !== vertexIndex);

    if (this.ctx.rules.enforce) {
      const violations = canPlace(
        this.ctx.floorplan,
        polygonNodeId,
        { points: proposed },
        { tolerance: this.ctx.rules.tolerance }
      );
      if (violations.length > 0) return false;
    }

    const oldPoints = [...node.points];
    this.ctx.commandStack.execute({
      name: `Delete Vertex ${vertexIndex} from ${node.label}`,
      execute: () => {
        node.points.length = 0;
        node.points.push(...proposed);
      },
      undo: () => {
        node.points.length = 0;
        node.points.push(...oldPoints);
      },
    });

    this.ctx.emitChange();
    return true;
  }
}
