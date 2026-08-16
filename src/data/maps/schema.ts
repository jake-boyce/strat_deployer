// Core data schema for mission maps.
//
// Coordinate convention: inches, origin (0,0) at the BOTTOM-LEFT corner of the
// playing area, x increasing right, y increasing up (standard board-game / math
// convention, NOT image/pixel convention). This matches how players usually
// call out positions on a real table ("6 inches in from my left edge").

export type Point = [number, number]; // [x_in, y_in]

export type ZoneOwner = "red" | "blue" | "neutral";

export interface DeploymentZone {
  owner: ZoneOwner;
  /** Closed polygon, pixel-traced from the source map, in inches. */
  polygon: Point[];
  label?: string; // e.g. "Attacker", "Defender"
}

export interface TerrainPiece {
  id: string;
  /** Footprint polygon (usually 4 corners, but can be fewer if manually
   *  simplified in the terrain editor). Source art often has irregular
   *  "decaying foundation" sprite edges, but the underlying gameplay
   *  footprint is the roughly rectangular/triangular base card.
   *  IMPORTANT: this is the whole card, which is walkable -- it is NOT
   *  what a unit can't be placed on. See keepOutFootprints. */
  corners: Point[];
  /** Convenience center/size/angle, derivable from corners but kept for easy rendering. */
  center: Point;
  width_in: number;
  height_in: number;
  angle_deg: number;
  label?: string; // e.g. "Ruins", "Fuel Silo"
  /** The actual keep-out geometry within this piece's card -- one or more
   *  oriented rectangles bounding the decorative feature elements
   *  (rendered in yellow/gold and green tones in this art style: support
   *  struts, pipework, wreckage) that a unit genuinely can't be placed
   *  on. The card itself (`corners`) is just the walkable base/floor the
   *  feature sits on -- being on the card is fine, only overlapping one
   *  of these shapes isn't (see scripts/extract_terrain_keepout.py).
   *  Empty array or missing (a small minority of pieces where no
   *  yellow/green feature was detected -- see that script's Status entry
   *  for the real count) falls back to the whole card as a conservative
   *  default, same as before this field existed, rather than silently
   *  having no keep-out enforcement at all for what might still be a
   *  genuinely solid piece. */
  keepOutFootprints?: Point[][];
  /** "heavy" (solid ruins/walls -- blocks placement/movement entirely) or
   *  "light" (rubble, pipework, lower cover -- doesn't block). Classified
   *  by mean color saturation of the footprint in the source art (see
   *  scripts/classify_terrain.py) -- a heuristic, not a verified per-piece
   *  classification. Optional because it wasn't backfilled onto any
   *  terrain data generated before this field existed. */
  terrainType?: "light" | "heavy";
  ruleIcon?: "line-of-sight-blocking" | "no-place" | "climbable" | null;
}

export interface ObjectiveMarker {
  id: string;
  position: Point;
  label?: string; // e.g. "AB", "CD", "EF", "GH" grouping tags seen on official cards
}

export interface MeasurementAnnotation {
  /** Optional: preserves the labeled reference distances printed on official
   *  mission cards (e.g. "17"", "24.25""), useful for in-app rulers/tooltips. */
  from: Point;
  to: Point;
  distance_in: number;
  label?: string;
}

export interface ImageCalibration {
  /** Path (relative to /public) to the source map art. */
  src: string;
  /** Native pixel dimensions of the source image. */
  imageWidthPx: number;
  imageHeightPx: number;
  /** Pixel coordinates of the board's bottom-left-in-inches origin, and the
   *  px-per-inch scale -- lets us convert MissionMap's inch coordinates back
   *  to the source image's pixel space so an SVG overlay lines up exactly. */
  pxOrigin: [number, number];
  pxScale: number;
}

export interface MissionMap {
  id: string; // slug, e.g. "tah_purge_a"
  name: string; // display name, e.g. "Layout A"
  missionPack?: string; // e.g. "TAH: Priority Assets"
  deploymentType?: string; // e.g. "Hammer and Anvil", "Diagonal"
  board: {
    width_in: number;
    height_in: number;
  };
  zones: DeploymentZone[];
  terrain: TerrainPiece[];
  objectives: ObjectiveMarker[];
  measurements?: MeasurementAnnotation[];
  sourceImage?: string; // filename only, for reference/attribution
  imageCalibration?: ImageCalibration; // present when the source art can be rendered as a background
}
