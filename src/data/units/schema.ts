// A Unit is a real named model, as opposed to a BaseTemplate (just a
// physical base shape/size) or a UnitTemplate (a generic formation of N
// same-size bases with no identity). Deliberately minimal for this first
// demo unit -- no points cost, no faction keywords -- just enough to
// place recognizable art on the board and enforce a real movement
// distance, instead of a plain colored circle with no stats at all.

export interface Unit {
  id: string;
  name: string;
  faction?: string;
  /** This unit only comes on this base -- selecting the unit in the
   *  palette locks base-size choice to this one template rather than
   *  offering the full base library. */
  baseTemplateId: string;
  /** Path to token art (background removed), relative to /public. Optional
   *  -- a unit can be drafted with its physical base/stats confirmed
   *  before art exists for it; renders as a plain owner-colored shape
   *  (Token.tsx's normal fallback) until art is added. */
  imageSrc?: string;
  /** Movement characteristic in inches. Enforced during the movement
   *  phase (see DeploymentView / "Turn 1" mode) -- a token can't be
   *  dragged further than this from where it started the turn. Optional
   *  for the same reason as imageSrc -- falls back to DEFAULT_MOVE_IN
   *  when unset, same as a generic base placement with no Unit at all. */
  move_in?: number;
  /** Vehicles (and, presumably eventually, Monsters) can't move through
   *  heavy terrain; infantry can. Neither can END a move on top of ANY
   *  terrain, light or heavy -- that's a separate, universal rule, not
   *  this flag (see isBlockedForMovement vs cannotEndOnTerrain in
   *  geometry.ts). Defaults to false (infantry-like) for units that don't
   *  set it and for generic base placements with no Unit at all -- the
   *  more permissive default. */
  isVehicle?: boolean;
  /** Which squad sizes this unit can actually be fielded in, e.g. `[10,
   *  20]` for a unit that only comes in units of 10 or 20 -- restricts
   *  the palette's unit-template offerings to formations whose
   *  `modelCount` is in this list, instead of showing every generic
   *  formation that happens to share this unit's base size. Undefined
   *  means no restriction -- every formation for the unit's base size is
   *  offered, the same behavior as before this field existed. Doesn't
   *  affect single-base placement (a lone model, e.g. for measuring or a
   *  casualty marker, is still always available regardless of this). */
  validSquadSizes?: number[];
  /** Army selections (see units.ts's `armyFactionAccess`) that DON'T get
   *  this unit despite it otherwise being accessible to them -- e.g. a
   *  Space Wolves army gets the generic Space Marines roster (they share
   *  a codex), but not chapter-specific characters from other named
   *  chapters (Roboute Guilliman, Cato Sicarius, ...) or the generic
   *  Chaplain (Space Wolves field a Wolf Priest instead). Doesn't affect
   *  anything when the army selector is left on "Any army", or when
   *  selecting this unit's own faction directly. */
  excludedFromArmies?: string[];
}

/** Movement allowance (inches) for a placed token that has no associated
 *  Unit record (a generic base placement) -- there's no real stat to use,
 *  so this is a placeholder baseline (a common troop Move value) rather
 *  than anything balanced or authoritative. */
export const DEFAULT_MOVE_IN = 6;
