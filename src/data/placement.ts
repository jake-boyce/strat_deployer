import type { Point } from "./maps/schema";

/** One committed point on a token's Turn 1 movement path. `distUsed` is
 *  the ACTUAL distance spent traveling from the previous waypoint to this
 *  one -- not the straight-line distance between the two positions,
 *  which would silently discard however far a wandering or curved drag
 *  detoured to get there (0 for the first waypoint, wherever the token
 *  started the turn). Storing this explicitly, rather than recomputing
 *  `pathLength()` from positions alone after the fact, is what makes
 *  later legs' remaining-budget math stay honest once an earlier leg
 *  involved any wandering. */
export interface MoveWaypoint {
  pos: Point;
  distUsed: number;
}

export interface PlacedToken {
  id: string;
  baseTemplateId: string;
  /** Board coordinates in inches, origin bottom-left (same convention as
   *  everything else in MissionMap -- see schema.ts). */
  position: Point;
  rotationDeg: number;
  owner: "red" | "blue";
  label?: string;
  /** Set when this token was placed as part of a unit-template formation
   *  (all models from the same placement share a groupId). Individual
   *  models remain independently draggable/rotatable/deletable after
   *  placement -- there's no group-move/group-select yet, this is just
   *  here so a future feature could add one without a data migration. */
  groupId?: string;
  /** Set when this token represents a real named Unit (see
   *  src/data/units/) rather than a generic base placeholder -- drives
   *  which art MapView renders instead of a flat colored circle. */
  unitId?: string;
}
