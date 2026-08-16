import type { Point, MissionMap, TerrainPiece } from "./maps/schema";
import type { BaseTemplate } from "./bases/schema";
import { mmToIn } from "./bases/schema";

/** Rotate a point (dx, dy) by angleDeg degrees counterclockwise around the
 *  origin, in the board's inch coordinate space (x right, y up). Used both
 *  for rotating unit-formation offsets before placement and for the ghost
 *  preview while a base/unit is armed. */
export function rotatePoint([dx, dy]: Point, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [dx * cos - dy * sin, dx * sin + dy * cos];
}

/** Standard ray-casting point-in-polygon test. Works for the convex and
 *  concave (step/notch/arc-approximated) zone shapes the template
 *  generator produces -- see src/data/maps/schema.ts for why zone
 *  boundaries aren't always convex. */
export function pointInPolygon([px, py]: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distToSegment([px, py]: Point, [ax, ay]: Point, [bx, by]: Point): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1e-9;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function minDistToPolygonEdges(point: Point, polygon: Point[]): number {
  let min = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    min = Math.min(min, distToSegment(point, a, b));
  }
  return min;
}

/** Local (unrotated, centered at origin) boundary sample points for a
 *  non-circle base shape -- shared by isBaseFullyInPolygon and
 *  isBaseOverlappingPolygon so both stay consistent. Oval: points around
 *  the ellipse. Rectangle: points along all 4 edges (a rectangle's own
 *  corners are its extremal points, but sampling the whole perimeter
 *  rather than just 4 corners still matters against concave/notched
 *  polygons, same reasoning as the oval case). */
function shapeBoundarySamplesLocal(base: BaseTemplate, samples = 24): Point[] {
  const w = mmToIn(base.width_mm!) / 2;
  const h = mmToIn(base.height_mm!) / 2;
  if (base.shape === "oval") {
    const pts: Point[] = [];
    for (let i = 0; i < samples; i++) {
      const theta = (i / samples) * 2 * Math.PI;
      pts.push([w * Math.cos(theta), h * Math.sin(theta)]);
    }
    return pts;
  }
  // rectangle
  const perSide = Math.max(2, Math.floor(samples / 4));
  const pts: Point[] = [];
  for (let i = 0; i <= perSide; i++) {
    const t = i / perSide;
    pts.push([-w + 2 * w * t, -h]);
    pts.push([-w + 2 * w * t, h]);
    pts.push([-w, -h + 2 * h * t]);
    pts.push([w, -h + 2 * h * t]);
  }
  return pts;
}

/** Is a whole base (not just its center point) contained inside `polygon`?
 *  A token whose center is inside the zone but whose edge pokes past the
 *  boundary is NOT a legal deployment -- no part of the base may cross the
 *  zone edge. Circle bases get an exact test (center inside + the center
 *  is at least one radius away from every edge segment, which together
 *  guarantee the whole disk is inside even for a concave polygon). Oval
 *  and rectangle bases get a sampled-boundary approximation (24 points
 *  around the rotated shape, all must be inside) -- exact polygon
 *  containment is a lot more math for cases that are a small fraction of
 *  placements, and 24 samples is more than enough resolution at these
 *  physical scales. */
export function isBaseFullyInPolygon(
  center: Point,
  base: BaseTemplate,
  rotationDeg: number,
  polygon: Point[]
): boolean {
  if (!pointInPolygon(center, polygon)) return false;

  if (base.shape === "circle") {
    const radius = mmToIn(base.diameter_mm!) / 2;
    return minDistToPolygonEdges(center, polygon) >= radius;
  }

  for (const local of shapeBoundarySamplesLocal(base)) {
    const [dx, dy] = rotatePoint(local, rotationDeg);
    if (!pointInPolygon([center[0] + dx, center[1] + dy], polygon)) return false;
  }
  return true;
}

/** Does a whole base overlap `polygon` at all (not "is fully inside" --
 *  any overlap, even just the edge clipping a corner)? Used for terrain
 *  keep-out: a token can't be placed or moved onto heavy terrain, and
 *  "onto" means any overlap, not just being centered on top of it.
 *  Circle: exact test -- center inside the polygon, OR the center is
 *  closer to some edge than the radius (the circle's boundary crosses
 *  into the polygon even though its center is outside). Oval/rectangle:
 *  samples the boundary (any sampled point landing inside the polygon
 *  means overlap) and additionally checks whether any polygon vertex
 *  falls inside the shape, which catches the case of the base fully
 *  engulfing a terrain piece too small for its own edges to register on
 *  the boundary sample. */
export function isBaseOverlappingPolygon(
  center: Point,
  base: BaseTemplate,
  rotationDeg: number,
  polygon: Point[]
): boolean {
  if (pointInPolygon(center, polygon)) return true;

  if (base.shape === "circle") {
    const radius = mmToIn(base.diameter_mm!) / 2;
    return minDistToPolygonEdges(center, polygon) < radius;
  }

  for (const local of shapeBoundarySamplesLocal(base)) {
    const [dx, dy] = rotatePoint(local, rotationDeg);
    if (pointInPolygon([center[0] + dx, center[1] + dy], polygon)) return true;
  }
  // polygon vertex inside the (rotated) shape -- undo the shape's own
  // rotation on the vertex instead, so the membership test can stay in
  // the shape's own unrotated, axis-aligned local frame
  const w = mmToIn(base.width_mm!) / 2;
  const h = mmToIn(base.height_mm!) / 2;
  for (const v of polygon) {
    const [vx, vy] = rotatePoint([v[0] - center[0], v[1] - center[1]], -rotationDeg);
    const inside = base.shape === "oval" ? (vx * vx) / (w * w) + (vy * vy) / (h * h) <= 1 : Math.abs(vx) <= w && Math.abs(vy) <= h;
    if (inside) return true;
  }
  return false;
}

/** The actual keep-out shape(s) for a terrain piece -- the extracted
 *  feature geometry (`keepOutFootprints`) if present, since the card
 *  itself (`corners`) is walkable and only the feature on top of it
 *  isn't. Falls back to the whole card for the minority of pieces where
 *  no feature was detected (see TerrainPiece.keepOutFootprints), the
 *  same conservative default this app used before that field existed --
 *  better to over-block a few pieces the color heuristic missed than to
 *  silently have zero enforcement on what might still be solid terrain. */
export function terrainKeepOutShapes(t: TerrainPiece): Point[][] {
  if (t.keepOutFootprints && t.keepOutFootprints.length > 0) return t.keepOutFootprints;
  return [t.corners];
}

/** Can a unit currently MOVE THROUGH a spot -- i.e. does this terrain
 *  block passage at all? Only heavy terrain blocks, and only for
 *  vehicles; infantry can move through any terrain (heavy or light).
 *  This is NOT the same as "can it end its move here" -- see
 *  cannotEndOnTerrain below, which is a separate, universal rule that
 *  applies regardless of this one. Light terrain never blocks movement
 *  for anyone. */
export function isBlockedForMovement(
  map: MissionMap,
  center: Point,
  base: BaseTemplate,
  rotationDeg: number,
  isVehicle: boolean
): boolean {
  if (!isVehicle) return false;
  return map.terrain.some(
    (t) =>
      t.terrainType !== "light" &&
      terrainKeepOutShapes(t).some((shape) => isBaseOverlappingPolygon(center, base, rotationDeg, shape))
  );
}

/** Same rule as isBlockedForMovement, but checked along the whole segment
 *  from `from` to `to`, not just the destination point. A single drag
 *  frame can jump a meaningful distance (fast mouse movement, or just a
 *  low sample rate) -- checking only the final candidate position let a
 *  vehicle "tunnel" through a terrain piece if consecutive samples
 *  happened to land on either side of it without any single sample
 *  landing squarely inside. Samples the segment at a fixed spacing (a
 *  fraction of an inch) rather than a fixed sample count, so a long drag
 *  covering a lot of board distance in one frame gets proportionally more
 *  samples instead of the same fixed count stretched thin over more
 *  ground. */
export function isPathBlockedForMovement(
  map: MissionMap,
  from: Point,
  to: Point,
  base: BaseTemplate,
  rotationDeg: number,
  isVehicle: boolean
): boolean {
  if (!isVehicle) return false;
  const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const stepIn = 0.25;
  const steps = Math.max(1, Math.ceil(dist / stepIn));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p: Point = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
    if (isBlockedForMovement(map, p, base, rotationDeg, isVehicle)) return true;
  }
  return false;
}

/** Can a unit legally END its move (or be placed) at this position? No
 *  unit -- infantry or vehicle -- can finish a move on top of ANY
 *  terrain, light or heavy: the terrain physically occupies that space.
 *  Unlike isBlockedForMovement, this has no vehicle/infantry distinction
 *  and covers light terrain too. (Multi-level terrain, where a model
 *  really can be based on an upper floor, isn't modeled yet -- every
 *  terrain piece here is single-level for now.) */
export function cannotEndOnTerrain(map: MissionMap, center: Point, base: BaseTemplate, rotationDeg: number): boolean {
  return map.terrain.some((t) =>
    terrainKeepOutShapes(t).some((shape) => isBaseOverlappingPolygon(center, base, rotationDeg, shape))
  );
}

/** Is a unit's base touching a terrain piece's whole card footprint
 *  (`corners`) at all -- not just the actual blocking feature within it
 *  (see terrainKeepOutShapes/cannotEndOnTerrain above for that). This is
 *  informational, not a legality check: the card itself is walkable, so
 *  this says nothing about whether a position is allowed, only whether
 *  the unit is physically within a terrain piece's footprint at all --
 *  the thing several other rules (cover, being on/near terrain) actually
 *  care about, independent of whether the specific feature within it is
 *  blocking placement. Returns the id of the first overlapping piece
 *  (there's rarely more than one card at a single position, and the
 *  caller only needs to know "yes, and roughly where" for a visual
 *  indicator), or null if the base isn't touching any card. */
export function overlappingTerrainFootprintId(
  map: MissionMap,
  center: Point,
  base: BaseTemplate,
  rotationDeg: number
): string | null {
  const hit = map.terrain.find((t) => isBaseOverlappingPolygon(center, base, rotationDeg, t.corners));
  return hit ? hit.id : null;
}

/** Represents a base as an approximating polygon in board-inches, for
 *  comparing against OTHER bases (as opposed to terrain, which already
 *  has isBaseOverlappingPolygon taking a real polygon). Circle: a
 *  many-sided polygon (24 sides is visually and practically
 *  indistinguishable from a true circle at these physical scales).
 *  Oval/rectangle: reuses the same boundary sampling terrain checks use,
 *  so there's one shared notion of "this shape's boundary," not a
 *  separate approximation per use case. */
function baseAsPolygon(center: Point, base: BaseTemplate, rotationDeg: number): Point[] {
  if (base.shape === "circle") {
    const r = mmToIn(base.diameter_mm!) / 2;
    const samples = 24;
    const pts: Point[] = [];
    for (let i = 0; i < samples; i++) {
      const theta = (i / samples) * 2 * Math.PI;
      pts.push([center[0] + r * Math.cos(theta), center[1] + r * Math.sin(theta)]);
    }
    return pts;
  }
  return shapeBoundarySamplesLocal(base).map((local) => {
    const [dx, dy] = rotatePoint(local, rotationDeg);
    return [center[0] + dx, center[1] + dy] as Point;
  });
}

/** Do two bases overlap at all -- any part of one touching any part of
 *  the other, not just center-on-center? Builds one base as an
 *  approximating polygon and reuses isBaseOverlappingPolygon (the same
 *  overlap test terrain keep-out already uses) against it, rather than
 *  writing a separate intersection algorithm for every shape-pair
 *  combination (circle-circle, circle-oval, oval-rect, etc.) */
export function doBasesOverlap(
  centerA: Point,
  baseA: BaseTemplate,
  rotationA: number,
  centerB: Point,
  baseB: BaseTemplate,
  rotationB: number
): boolean {
  const polygonB = baseAsPolygon(centerB, baseB, rotationB);
  return isBaseOverlappingPolygon(centerA, baseA, rotationA, polygonB);
}

/** Same idea as isPathBlockedForMovement, but against other placed
 *  bases instead of terrain -- samples the whole segment from `from` to
 *  `to`, not just the destination, so a fast or low-sample-rate drag
 *  can't "tunnel" a base through another one if consecutive frames
 *  happen to land on either side of it. `others` is a plain list of
 *  center/base/rotation tuples rather than PlacedToken, so this stays a
 *  pure geometry function -- the caller (DeploymentView) is responsible
 *  for building that list from its token state and excluding whichever
 *  tokens are part of the current drag/placement action. */
export function isPathOverlappingOtherBases(
  from: Point,
  to: Point,
  base: BaseTemplate,
  rotationDeg: number,
  others: { center: Point; base: BaseTemplate; rotationDeg: number }[]
): boolean {
  if (others.length === 0) return false;
  // A base the token is ALREADY overlapping at the start of this move
  // doesn't block the move. Without this, a token that ends up
  // overlapping something -- which should no longer happen after the
  // atomic group-drag fix in DeploymentView's handleTokensMove, but is
  // exactly the state that bug used to be able to produce -- would be
  // stuck there permanently: every possible destination's path samples
  // the same already-overlapping starting point, so literally no move in
  // any direction could ever pass. Only bases the token DOESN'T already
  // overlap at the start are checked along the rest of the path -- an
  // already-overlapping pair can be freely separated, but a clean base
  // still can't be dragged into a brand new overlap with anything.
  const stillChecked = others.filter(
    (o) => !doBasesOverlap(from, base, rotationDeg, o.center, o.base, o.rotationDeg)
  );
  if (stillChecked.length === 0) return false;
  const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const stepIn = 0.25;
  const steps = Math.max(1, Math.ceil(dist / stepIn));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p: Point = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
    for (const other of stillChecked) {
      if (doBasesOverlap(p, base, rotationDeg, other.center, other.base, other.rotationDeg)) return true;
    }
  }
  return false;
}

/** Is a whole base fully inside one of `map`'s deployment zones belonging
 *  to `owner`? Used to enforce that non-infiltrator units must deploy
 *  entirely within their own zone -- see DeploymentView's placement
 *  validation. */
export function isInDeploymentZone(
  map: MissionMap,
  center: Point,
  base: BaseTemplate,
  rotationDeg: number,
  owner: "red" | "blue"
): boolean {
  return map.zones.some((z) => z.owner === owner && isBaseFullyInPolygon(center, base, rotationDeg, z.polygon));
}
