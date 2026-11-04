import {
  canPlace,
  cloneFloorplan,
  computeBoundingBox,
  GridSpatialIndex,
  parseFloorplan,
  pointInPolygon,
  polygonArea,
  rowFootprint,
  SAMPLE_FLOORPLAN,
  seatWorldPosition,
  StatusRegistry,
  transformPoint,
  validateLayout,
} from '@open-seats/core';

declare const untrustedJson: unknown;

// #region parse
// Throws a ZodError with the exact path of the first problem.
const plan = parseFloorplan(untrustedJson);

// Deep copy before mutating, e.g. to build an edited version.
const draft = cloneFloorplan(plan);
draft.buildings[0].label = 'Renamed';
// #endregion parse

// #region validate
const violations = validateLayout(SAMPLE_FLOORPLAN, { tolerance: 0.01 });
for (const v of violations) {
  // rule: 'building-overlap' | 'zone-overlap' | 'row-overlap' | 'zone-row-overlap'
  //     | 'seat-overlap' | 'out-of-bounds' | 'invalid-polygon'
  console.warn(v.rule, v.ids);
}
// #endregion validate

// #region can-place
// Would moving row A here break a rule? (Nothing is modified.)
const problems = canPlace(SAMPLE_FLOORPLAN, 'row-a', {
  position: { x: 0, y: 0 },
});
if (problems.length > 0) console.log('Not allowed:', problems);
// #endregion can-place

// #region geometry
const building = SAMPLE_FLOORPLAN.buildings[0];
const row = building.rows[0];

// Seat centre in world coordinates (row + building transforms applied).
const center = seatWorldPosition(row, row.seats[0], building);

// Row outline (table + seats) in world space.
const outline = rowFootprint(row, building);
const box = computeBoundingBox(outline);

// Is a world point inside the building?
const inside = pointInPolygon(
  center,
  building.points.map((p) =>
    transformPoint(p, building.position, building.rotation)
  )
);
console.log(center, box, inside, polygonArea(building.points));
// #endregion geometry

// #region spatial
// Fast "what is near here" lookups for large plans.
const index = new GridSpatialIndex(100);
for (const b of SAMPLE_FLOORPLAN.buildings) {
  for (const r of b.rows) {
    index.insert(r.id, computeBoundingBox(rowFootprint(r, b)));
  }
}
const nearby = index.query({ minX: 0, minY: 0, maxX: 300, maxY: 300 });
// #endregion spatial

// #region statuses
const registry = new StatusRegistry(undefined, 'available');
registry.register({ key: 'vip', style: { fill: '#eab308' }, selectable: true });
const legend = registry.getAll().map((def) => ({
  label: def.label ?? def.key,
  color: def.style.fill,
  bookable: def.selectable,
}));
const fallback = registry.get('unknown'); // grey, not selectable + console warning
// #endregion statuses

export { nearby, legend, fallback };
