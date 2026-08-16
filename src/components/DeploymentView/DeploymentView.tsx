import { useState, useRef, useMemo } from "react";
import type { MissionMap, Point } from "../../data/maps/schema";
import type { PlacedToken, MoveWaypoint } from "../../data/placement";
import { getUnitTemplateById, formationOffsetsIn } from "../../data/bases/unitTemplates";
import { getUnitById, unitsForArmy } from "../../data/units/units";
import type { ParsedRosterForDeployment } from "../../data/units/parseRoster";
import { DEFAULT_MOVE_IN } from "../../data/units/schema";
import { getBaseTemplateById } from "../../data/bases/baseTemplates";
import { baseFootprintIn } from "../../data/bases/schema";
import {
  rotatePoint,
  isInDeploymentZone,
  isPathBlockedForMovement,
  cannotEndOnTerrain,
  doBasesOverlap,
  isPathOverlappingOtherBases,
} from "../../data/geometry";
import { MapView, type GhostSpec } from "../MapView/MapView";
import { TokenPalette, type Armed } from "../TokenLibrary/TokenPalette";
import { BACK_BTN_STYLE } from "../common";

export interface DeploymentViewProps {
  map: MissionMap;
  onBack: () => void;
  backLabel?: string;
  /** Which army (faction name) each owner's palette is filtered to, from
   *  the disposition picker's army selector -- null/absent means no
   *  filtering (full roster), which is also what browsing a map directly
   *  from the map library (no disposition flow) falls back to. */
  armyByOwner?: { red: string | null; blue: string | null };
  /** Each owner's parsed roster (see data/units/parseRoster.ts), if one
   *  was pasted on the disposition-picker page -- narrows that side's
   *  palette to just these units (a subset of whatever armyByOwner
   *  already allows), drives the "who's left to deploy" checklist in
   *  TokenPalette, and (via its attachments) drives placing an attached
   *  Leader/Support alongside its Bodyguard unit automatically -- see
   *  handleBoardClick. null/absent (or an empty units list) means no
   *  roster was given, so none of that applies. */
  rosterByOwner?: { red: ParsedRosterForDeployment | null; blue: ParsedRosterForDeployment | null };
}

let nextTokenNum = 1;
let nextGroupNum = 1;

/** Spreadsheet-style letters: 0->A, 1->B, ..., 25->Z, 26->AA, 27->AB, ...
 *  so labeling doesn't break down if someone places more than 26 units. */
function letterForIndex(n: number): string {
  let s = "";
  n += 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Total distance used across a movement path: the sum of each leg's
 *  ACTUAL recorded distUsed, not a straight-line recomputation from
 *  positions. That distinction matters -- a leg that involved any
 *  wandering (drag out, then partway back, within one gesture) spent
 *  more real distance than the straight line between its start and end
 *  points would suggest, and recomputing from positions after the fact
 *  would silently lose that, letting a later leg's remaining budget look
 *  bigger than it should. */
function totalDistanceUsed(path: MoveWaypoint[]): number {
  return path.reduce((sum, wp) => sum + wp.distUsed, 0);
}

export function DeploymentView({
  map,
  onBack,
  backLabel = "Back to map picker",
  armyByOwner,
  rosterByOwner,
}: DeploymentViewProps) {
  const [tokens, setTokens] = useState<PlacedToken[]>([]);
  const [mode, setMode] = useState<"deploy" | "move">("deploy");
  // Each token's movement path this turn, as committed waypoints -- starts
  // as a single point (wherever it was when Turn 1 began) and gains a new
  // point every time a drag gesture ends somewhere legal. Real vehicle
  // movement is rarely one straight line (a ruin in the way means "left a
  // bit, then straight down as far as I can") -- what has to stay under
  // the Move characteristic is the TOTAL distance across every leg, not
  // the straight-line distance from the turn's start to wherever the
  // token currently is, which would understate how far a unit that
  // jogged around an obstacle has actually traveled.
  const [movePaths, setMovePaths] = useState<Map<string, MoveWaypoint[]>>(new Map());
  const [armed, setArmed] = useState<Armed>(null);
  const [armedRotation, setArmedRotation] = useState(0);
  const [owner, setOwner] = useState<"red" | "blue">("red");
  const [infiltrator, setInfiltrator] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedTokenIds, setSelectedTokenIds] = useState<Set<string>>(new Set());
  const [placementError, setPlacementError] = useState<string | null>(null);
  const nextUnitLetter = useRef(0);
  const errorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPlacementError = (msg: string) => {
    setPlacementError(msg);
    if (errorTimeout.current) clearTimeout(errorTimeout.current);
    errorTimeout.current = setTimeout(() => setPlacementError(null), 3000);
  };

  const isVehicleFor = (token: PlacedToken): boolean => {
    const unit = token.unitId ? getUnitById(token.unitId) : undefined;
    return unit?.isVehicle ?? false;
  };

  // Builds the {center, base, rotationDeg} list overlap checks compare
  // against -- every CURRENTLY PLACED token except whichever ids are
  // excluded (the token(s) currently being placed/dragged themselves,
  // so a group drag doesn't have its own members block each other, and
  // a formation's own models don't block one another during placement).
  const otherBaseTuples = (excludeIds: Set<string>) =>
    tokens
      .filter((t) => !excludeIds.has(t.id))
      .map((t) => {
        const base = getBaseTemplateById(t.baseTemplateId);
        return base ? { center: t.position, base, rotationDeg: t.rotationDeg } : null;
      })
      .filter((x): x is { center: Point; base: NonNullable<ReturnType<typeof getBaseTemplateById>>; rotationDeg: number } => x !== null);

  // re-arming (including re-picking the same thing) resets rotation, so it
  // doesn't carry over confusingly between unrelated placements
  const handleArm = (next: Armed) => {
    if (mode === "move") return;
    setArmed(next);
    setArmedRotation(0);
  };

  const handleStartTurn1 = () => {
    setMovePaths(new Map(tokens.map((t) => [t.id, [{ pos: t.position, distUsed: 0 }]])));
    setMode("move");
    setArmed(null);
    setSelectedTokenIds(new Set());
  };

  const handleBackToDeployment = () => {
    setMode("deploy");
    setMovePaths(new Map());
  };

  const handleBoardClick = (position: Point) => {
    if (!armed || mode === "move") return;
    // unitId tag carried onto placed tokens is whatever's selected in the
    // palette's Unit dropdown right now -- null for a plain generic base
    const unitId = selectedUnitId ?? undefined;

    if (armed.type === "base") {
      const armedBase = getBaseTemplateById(armed.id);
      if (!armedBase) return;
      // placement is an instant "end position" -- no movement happens, so
      // the universal end-of-move rule applies (any terrain, any unit
      // type), not the vehicle-only movement-blocking rule
      if (cannotEndOnTerrain(map, position, armedBase, armedRotation)) {
        showPlacementError("Can't end on top of terrain.");
        return;
      }
      // non-infiltrators must deploy fully inside their own deployment
      // zone -- enforced here, at commit time, not just as a visual hint.
      // Checks the WHOLE base footprint, not just its center point -- a
      // token whose center is inside the zone but whose edge pokes past
      // the boundary is still an illegal deployment.
      if (!infiltrator && !isInDeploymentZone(map, position, armedBase, armedRotation, owner)) {
        showPlacementError("Not an infiltrator — must deploy inside your deployment zone.");
        return;
      }
      // bases can't overlap -- any other already-placed token, friend or
      // foe, physically occupies its own footprint
      if (otherBaseTuples(new Set()).some((o) => doBasesOverlap(position, armedBase, armedRotation, o.center, o.base, o.rotationDeg))) {
        showPlacementError("Can't place — overlaps another base.");
        return;
      }
      const letter = letterForIndex(nextUnitLetter.current++);
      const newToken: PlacedToken = {
        id: `token_${nextTokenNum++}`,
        baseTemplateId: armed.id,
        position,
        rotationDeg: armedRotation,
        owner,
        groupId: `group_${nextGroupNum++}`,
        label: letter,
        unitId,
      };
      // a lone-model placement is still "the unit" as far as an attached
      // Leader/Support cares -- treat it as a formation of one model at
      // local offset [0,0] so the same attachment logic applies
      const attached = unitId ? attachedLeaderToken(unitId, armedBase, [[0, 0]], position, armedRotation) : null;
      setTokens((prev) => (attached ? [...prev, newToken, attached] : [...prev, newToken]));
      // a roster line means "place this one unit," not "keep placing
      // copies of it" -- see selectAndArmUnit's fromRoster doc comment
      // for why staying armed here is the actual root cause of drags
      // that look like they've stopped working
      if (armed.fromRoster) handleArm(null);
      return;
    }

    // unit template: compute every model's final position first, so we can
    // validate the WHOLE unit before placing any of it (all-or-nothing --
    // a non-infiltrator unit can't have some models in the zone and others
    // hanging out of it)
    const unitTemplate = getUnitTemplateById(armed.id);
    const base = unitTemplate ? getBaseTemplateById(unitTemplate.baseTemplateId) : undefined;
    if (!unitTemplate || !base) return;
    const offsets = formationOffsetsIn(unitTemplate, base);
    const positions: Point[] = offsets.map(([dx, dy]) => {
      const [rdx, rdy] = rotatePoint([dx, dy], armedRotation);
      return [
        Math.max(0, Math.min(map.board.width_in, position[0] + rdx)),
        Math.max(0, Math.min(map.board.height_in, position[1] + rdy)),
      ];
    });

    if (positions.some((p) => cannotEndOnTerrain(map, p, base, armedRotation))) {
      showPlacementError("Can't end on top of terrain — some models would overlap it.");
      return;
    }

    if (!infiltrator && !positions.every((p) => isInDeploymentZone(map, p, base, armedRotation, owner))) {
      showPlacementError("Not an infiltrator — the whole unit must fit inside your deployment zone.");
      return;
    }

    // bases can't overlap -- checked against every currently placed
    // token; the formation's OWN models don't need checking against each
    // other since formationOffsetsIn already lays them out without
    // overlapping
    const others = otherBaseTuples(new Set());
    if (positions.some((p) => others.some((o) => doBasesOverlap(p, base, armedRotation, o.center, o.base, o.rotationDeg)))) {
      showPlacementError("Can't place — some models would overlap another base.");
      return;
    }

    const letter = letterForIndex(nextUnitLetter.current++);
    const groupId = `group_${nextGroupNum++}`;
    const newTokens: PlacedToken[] = positions.map((pos) => ({
      id: `token_${nextTokenNum++}`,
      baseTemplateId: unitTemplate.baseTemplateId,
      position: pos,
      rotationDeg: armedRotation,
      owner,
      groupId,
      label: letter,
      unitId,
    }));
    const attached = unitId ? attachedLeaderToken(unitId, base, offsets, position, armedRotation) : null;
    setTokens((prev) => (attached ? [...prev, ...newTokens, attached] : [...prev, ...newTokens]));
    if (armed.fromRoster) handleArm(null);
  };

  // Movement allowance in inches for a placed token -- its real Unit's
  // move_in stat if it has one, otherwise a placeholder default (see
  // DEFAULT_MOVE_IN) so the movement phase still works for generic base
  // placements that have no unit data backing them.
  const moveAllowanceFor = (token: PlacedToken): number => {
    const unit = token.unitId ? getUnitById(token.unitId) : undefined;
    return unit?.move_in ?? DEFAULT_MOVE_IN;
  };

  // Continuous drag updates (fired on every mousemove while dragging): only
  // the vehicle-vs-heavy-terrain movement-blocking rule applies here, so a
  // vehicle can't be dragged THROUGH heavy terrain, but infantry can move
  // freely over any terrain mid-drag -- the "can't end there" rule is
  // enforced separately, once, at drag release (see handleDragEnd), not on
  // every intermediate step. That split is deliberate: rejecting every
  // intermediate step against the universal rule would stop infantry from
  // ever crossing terrain at all, not just ending on it.
  const handleTokensMove = (updates: { id: string; position: Point }[]) => {
    if (mode !== "move") {
      const draggedIds = new Set(updates.map((u) => u.id));
      const others = otherBaseTuples(draggedIds);
      setTokens((prev) => {
        const byId = new Map(prev.map((t) => [t.id, t]));
        // Validate the WHOLE dragged batch atomically -- either every
        // token's move this frame is legal, or NONE of them move. A
        // multi-select drag moves every member with the exact same
        // delta, so a rigid group (a squad's own models, or a squad
        // dragged together with its auto-attached Leader/Support, which
        // sits right at the formation's edge with only a small gap --
        // see attachedLeaderToken) should never be able to drift out of
        // its original relative alignment mid-drag. The previous
        // per-token independent accept/reject could let ONE member's
        // path get rejected for a single frame (grazing terrain, an
        // edge-clamp, anything transient) while the rest of the group
        // kept moving with the mouse -- breaking that rigid alignment,
        // and since dragged tokens are deliberately excluded from each
        // OTHER's overlap check (`others` excludes every id in this same
        // batch, on the assumption a rigid translation can't introduce
        // new overlap within the group), nothing caught it if that
        // desync happened to push two group members into actually
        // overlapping. All-or-nothing per frame closes that gap: the
        // group's relative positions can only ever change by the same
        // uniform delta, which by construction can't turn a legal
        // starting formation into an overlapping one.
        for (const u of updates) {
          const tok = byId.get(u.id);
          if (!tok) return prev;
          const base = getBaseTemplateById(tok.baseTemplateId);
          if (!base) return prev;
          if (isPathBlockedForMovement(map, tok.position, u.position, base, tok.rotationDeg, isVehicleFor(tok))) return prev;
          // bases can't overlap -- checked as a path (not just the
          // destination) for the same tunneling reason terrain is: a
          // fast drag frame could otherwise jump clean over another
          // token without any sampled point landing squarely on it
          if (isPathOverlappingOtherBases(tok.position, u.position, base, tok.rotationDeg, others)) return prev;
        }
        const finalById = new Map(updates.map((u) => [u.id, u.position]));
        return prev.map((t) => (finalById.has(t.id) ? { ...t, position: finalById.get(t.id)! } : t));
      });
      return;
    }
    // Movement phase: each leg's distance is the straight line from the
    // last COMMITTED waypoint to wherever the token currently is,
    // recomputed live every frame -- not accumulated. This is
    // deliberate: an earlier version tracked true incremental distance
    // (penalizing any wandering within a drag), which correctly matched
    // the letter of "measure the actual distance moved," but made normal
    // placement adjustment unusable -- nudging a token back and forth
    // while lining it up exactly ate into its Move budget the same as a
    // real repositioning would. Real tabletop measurement doesn't work
    // that way either: what matters is where the model finally comes to
    // rest, not the wobble of the hand carrying it there. A genuine
    // multi-leg move (routing around an obstacle) is now something the
    // person does on purpose -- hold Space mid-drag to drop a checkpoint
    // (see MapView's onCheckpoint) -- rather than something the app tries
    // to infer from how the mouse happened to move.
    setTokens((prev) => {
      const byId = new Map(prev.map((t) => [t.id, t]));
      const finalById = new Map<string, Point>();
      const others = otherBaseTuples(new Set(updates.map((u) => u.id)));
      for (const u of updates) {
        const tok = byId.get(u.id);
        const path = movePaths.get(u.id);
        if (!tok || !path || path.length === 0) {
          finalById.set(u.id, u.position);
          continue;
        }
        const lastWaypoint = path[path.length - 1].pos;
        const usedSoFar = totalDistanceUsed(path);
        const maxDist = moveAllowanceFor(tok);
        const remainingBudget = Math.max(0, maxDist - usedSoFar);
        const dx = u.position[0] - lastWaypoint[0];
        const dy = u.position[1] - lastWaypoint[1];
        const dist = Math.hypot(dx, dy);
        const candidate: Point =
          dist <= remainingBudget
            ? u.position
            : dist > 0
              ? [lastWaypoint[0] + (dx / dist) * remainingBudget, lastWaypoint[1] + (dy / dist) * remainingBudget]
              : lastWaypoint;
        const base = getBaseTemplateById(tok.baseTemplateId);
        if (!base) continue;
        if (isPathBlockedForMovement(map, tok.position, candidate, base, tok.rotationDeg, isVehicleFor(tok))) continue;
        if (isPathOverlappingOtherBases(tok.position, candidate, base, tok.rotationDeg, others)) continue;
        finalById.set(u.id, candidate);
      }
      return prev.map((t) => (finalById.has(t.id) ? { ...t, position: finalById.get(t.id)! } : t));
    });
  };

  // Fired once at the end of a genuine drag (see MapView's onDragEnd).
  // Does two things, both only resolvable once the drag is actually over:
  // 1. The universal "can't end a move on top of ANY terrain" rule --
  //    checked once against each dragged token's final position rather
  //    than on every intermediate step. Anything that ended up somewhere
  //    illegal reverts to wherever it was before this particular drag
  //    gesture started.
  //    In "deploy" mode specifically (not "move"/Turn 1, where units are
  //    expected to leave their deployment zone), a non-infiltrator token
  //    dragged to reposition it also has to stay within its owner's zone
  //    -- this was previously only enforced at the moment of initial
  //    placement (handleBoardClick), not on a later drag repositioning an
  //    already-placed token, letting a normal unit be freely dragged
  //    anywhere on the board regardless of the infiltrators toggle.
  //    Checked directly: confirmed a token could be placed validly inside
  //    the zone with infiltrators off, then dragged straight past the
  //    zone boundary with nothing stopping it.
  // 2. During Turn 1, commits the token's final position as a new
  //    waypoint on its movement path (skipped for anything that got
  //    reverted in step 1, and for a drag that didn't actually move the
  //    token) -- this is what makes multi-leg movement work: "left a bit,
  //    then straight down as far as I can" is two separate drags, and the
  //    second one's remaining budget depends on this leg having been
  //    recorded, not just the very first origin point.
  const handleDragEnd = (startPositions: Map<string, Point>) => {
    const reverts = new Map<string, Point>();
    const committed = new Map<string, { pos: Point; distUsed: number }>();
    let leftZone = false;
    for (const [id, startPos] of startPositions) {
      const tok = tokens.find((t) => t.id === id);
      if (!tok) continue;
      const base = getBaseTemplateById(tok.baseTemplateId);
      const onTerrain = base && cannotEndOnTerrain(map, tok.position, base, tok.rotationDeg);
      const outsideZone =
        mode !== "move" &&
        base &&
        !infiltrator &&
        !isInDeploymentZone(map, tok.position, base, tok.rotationDeg, tok.owner);
      if (onTerrain || outsideZone) {
        reverts.set(id, startPos);
        if (outsideZone && !onTerrain) leftZone = true;
      } else {
        const distUsed = Math.hypot(tok.position[0] - startPos[0], tok.position[1] - startPos[1]);
        committed.set(id, { pos: tok.position, distUsed });
      }
    }

    if (mode === "move" && committed.size > 0) {
      setMovePaths((prev) => {
        const next = new Map(prev);
        for (const [id, { pos, distUsed }] of committed) {
          const path = next.get(id) ?? [{ pos, distUsed: 0 }];
          const last = path[path.length - 1];
          if (Math.hypot(pos[0] - last.pos[0], pos[1] - last.pos[1]) > 0.01 || distUsed > 0.01) {
            next.set(id, [...path, { pos, distUsed }]);
          }
        }
        return next;
      });
    }

    if (reverts.size === 0) return;
    showPlacementError(
      leftZone ? "Not an infiltrator — must stay inside your deployment zone." : "Can't end a move on top of terrain."
    );
    setTokens((prev) => prev.map((t) => (reverts.has(t.id) ? { ...t, position: reverts.get(t.id)! } : t)));
  };

  // Fired when Space is pressed while actively dragging a token during
  // Turn 1 (see MapView's onCheckpoint) -- commits the current position
  // as a new waypoint WITHOUT ending the drag, so the person can
  // intentionally mark "this is a real bend" (routing around a ruin) and
  // keep going, rather than the app trying to infer legs from how the
  // mouse happens to wander. Returns whether the checkpoint was actually
  // placed -- MapView needs this to decide whether to reset its own
  // drag-start reference for the continuing gesture, and doesn't commit
  // anything at all if any dragged token is currently sitting on terrain
  // (same "can't end a move on top of terrain" rule as a real release,
  // since a checkpoint IS a real, permanent leg boundary once placed).
  const handleCheckpoint = (tokenIds: string[]): boolean => {
    if (mode !== "move" || tokenIds.length === 0) return false;
    const committed = new Map<string, { pos: Point; distUsed: number }>();
    for (const id of tokenIds) {
      const tok = tokens.find((t) => t.id === id);
      const path = movePaths.get(id);
      if (!tok || !path || path.length === 0) return false;
      const base = getBaseTemplateById(tok.baseTemplateId);
      if (base && cannotEndOnTerrain(map, tok.position, base, tok.rotationDeg)) {
        showPlacementError("Can't checkpoint on top of terrain.");
        return false;
      }
      const last = path[path.length - 1];
      const distUsed = Math.hypot(tok.position[0] - last.pos[0], tok.position[1] - last.pos[1]);
      committed.set(id, { pos: tok.position, distUsed });
    }
    if (committed.size === 0) return false;
    setMovePaths((prev) => {
      const next = new Map(prev);
      for (const [id, wp] of committed) {
        const path = next.get(id) ?? [wp];
        next.set(id, [...path, wp]);
      }
      return next;
    });
    return true;
  };

  // Pops the last committed waypoint off each SELECTED token's movement
  // path (does nothing to a token with only its turn-start point left --
  // there's no leg to undo) and reverts that token's displayed position
  // to whatever the new last waypoint is. The correction mechanism for
  // "that leg went the wrong way around the ruin" -- retry with a fresh
  // drag from the reverted point instead.
  const handleUndoLastLeg = () => {
    if (mode !== "move" || selectedTokenIds.size === 0) return;
    // computed plainly, from the current movePaths closure, BEFORE calling
    // any setState -- same reasoning as handleTokensMove above: mutating
    // a side-effect map inside a setState updater and reading it right
    // after isn't safe to assume runs synchronously
    const newPaths = new Map(movePaths);
    const reverted = new Map<string, Point>();
    for (const id of selectedTokenIds) {
      const path = movePaths.get(id);
      if (!path || path.length <= 1) continue;
      const shorter = path.slice(0, -1);
      newPaths.set(id, shorter);
      reverted.set(id, shorter[shorter.length - 1].pos);
    }
    if (reverted.size === 0) return;
    setMovePaths(newPaths);
    setTokens((prev) => prev.map((t) => (reverted.has(t.id) ? { ...t, position: reverted.get(t.id)! } : t)));
  };

  const canUndoLastLeg =
    mode === "move" && Array.from(selectedTokenIds).some((id) => (movePaths.get(id)?.length ?? 0) > 1);

  const handleDeleteSelected = () => {
    if (selectedTokenIds.size === 0) return;
    setTokens((prev) => prev.filter((t) => !selectedTokenIds.has(t.id)));
    setSelectedTokenIds(new Set());
  };

  // Rotates the whole selection as a rigid body around its own centroid --
  // matching how a unit template's formation rotates together before
  // placement (see armedRotation/ghost above), rather than each token just
  // spinning in place independently. For a single-token selection this
  // naturally degenerates to "rotate in place": the centroid of one point
  // is that point itself, so its own position offset from centroid is
  // (0,0), which rotates to (0,0) regardless of angle -- only its own
  // rotationDeg changes. One function correctly covers both cases.
  const handleRotateSelected = (deltaDeg: number) => {
    if (selectedTokenIds.size === 0) return;
    const selected = tokens.filter((t) => selectedTokenIds.has(t.id));
    if (selected.length === 0) return;
    const cx = selected.reduce((sum, t) => sum + t.position[0], 0) / selected.length;
    const cy = selected.reduce((sum, t) => sum + t.position[1], 0) / selected.length;
    const rotated = selected.map((t) => {
      const [dx, dy] = rotatePoint([t.position[0] - cx, t.position[1] - cy], deltaDeg);
      const position: Point = [
        Math.max(0, Math.min(map.board.width_in, cx + dx)),
        Math.max(0, Math.min(map.board.height_in, cy + dy)),
      ];
      return { ...t, position, rotationDeg: t.rotationDeg + deltaDeg };
    });

    // bases can't overlap -- check the rotated selection against every
    // non-selected token before applying anything, so a rotation that
    // would swing a member into another base is rejected as a whole
    // rather than partially applied
    const others = otherBaseTuples(selectedTokenIds);
    for (const t of rotated) {
      const base = getBaseTemplateById(t.baseTemplateId);
      if (base && others.some((o) => doBasesOverlap(t.position, base, t.rotationDeg, o.center, o.base, o.rotationDeg))) {
        showPlacementError("Can't rotate — would overlap another base.");
        return;
      }
    }

    const byId = new Map(rotated.map((t) => [t.id, t]));
    setTokens((prev) => prev.map((t) => byId.get(t.id) ?? t));
  };

  const ghost: GhostSpec | null = armed
    ? { kind: armed.type, id: armed.id, owner, rotationDeg: armedRotation, infiltrator, unitId: selectedUnitId }
    : null;

  // How many separate INSTANCES of each unit the current owner has
  // actually placed on the board -- "instance" meaning a distinct
  // placement action (one groupId), not a raw token count, so a 5-model
  // Scout Squad placed in one go counts as 1 instance, matching 1 roster
  // line, not 5. This is what lets the roster checklist correctly tell
  // apart "placed" from "not yet" even when the roster lists the same
  // unit more than once (e.g. two Iron Priests at different point
  // costs) -- TokenPalette pairs this count against roster entries in
  // order, so the Nth placed instance of a unit checks off the Nth
  // roster line for it, not just "any placed = every line checked."
  // Every placed token carries a groupId (even a lone single-base
  // placement gets its own unique one -- see PlacedToken's comment), but
  // falling back to the token's own id keeps this correct even if that
  // ever weren't true for some future placement path.
  const placedGroupCountByUnitId: Record<string, number> = useMemo(() => {
    const groupsByUnitId = new Map<string, Set<string>>();
    for (const tok of tokens) {
      if (tok.owner !== owner || !tok.unitId) continue;
      const set = groupsByUnitId.get(tok.unitId) ?? new Set<string>();
      set.add(tok.groupId ?? tok.id);
      groupsByUnitId.set(tok.unitId, set);
    }
    const result: Record<string, number> = {};
    for (const [unitId, groupIds] of groupsByUnitId) {
      result[unitId] = groupIds.size;
    }
    return result;
  }, [tokens, owner]);

  // Bodyguard unit id -> its attached Leader/Support's unit id, for the
  // current owner's roster. First pairing wins if a unit id somehow shows
  // up as a bodyguard more than once (shouldn't happen with a real
  // roster, but a duplicate-name edge case shouldn't crash anything
  // either).
  const attachedLeaderByBodyguardUnitId = useMemo(() => {
    const map = new Map<string, string>();
    const attachments = rosterByOwner?.[owner]?.attachments ?? [];
    for (const a of attachments) {
      if (!map.has(a.bodyguardUnitId)) map.set(a.bodyguardUnitId, a.leaderUnitId);
    }
    return map;
  }, [rosterByOwner, owner]);

  // How many roster lines exist for each unit id (with duplicates, same
  // as roster itself) -- compared against placedGroupCountByUnitId to
  // decide whether there's still an unplaced instance of a given
  // attached Leader/Support left to auto-place. Without this, placing a
  // Bodyguard unit a SECOND time (a roster can have two of the same
  // squad) would try to attach a leader that was already placed
  // alongside the first one.
  const rosterCountByUnitId = useMemo(() => {
    const counts: Record<string, number> = {};
    const rosterUnits = rosterByOwner?.[owner]?.units ?? [];
    for (const u of rosterUnits) counts[u.unitId] = (counts[u.unitId] ?? 0) + 1;
    return counts;
  }, [rosterByOwner, owner]);

  /** After a Bodyguard unit's own models are placed, checks whether it
   *  has an attached Leader/Support (per the roster's own "Attached as:
   *  Leader/Support" + "Attached as: Bodyguard" pairing -- see
   *  parseRoster.ts) that still has an unplaced instance, and if so,
   *  returns a token for it positioned immediately off the right edge of
   *  the formation that was just placed -- literally placed WITH the
   *  unit, not just queued for a separate click. `localOffsets` are the
   *  bodyguard's own models' positions in the same local (pre-rotation,
   *  click-point-relative) space `positions` below is built from, used
   *  to find that edge; `bodyguardBase` is their base template. Returns
   *  null (placing nothing extra) when there's no attachment, every
   *  instance of it is already placed, or the computed spot turns out to
   *  be illegal -- an illegal spot is never forced through just to keep
   *  the two together; the Leader/Support just stays available to place
   *  manually from the roster checklist instead, same as if this feature
   *  didn't exist. */
  const attachedLeaderToken = (
    bodyguardUnitId: string,
    bodyguardBase: { id: string },
    localOffsets: Point[],
    clickPosition: Point,
    rotationDeg: number
  ): PlacedToken | null => {
    const leaderUnitId = attachedLeaderByBodyguardUnitId.get(bodyguardUnitId);
    if (!leaderUnitId) return null;
    const alreadyPlaced = placedGroupCountByUnitId[leaderUnitId] ?? 0;
    const rosterCount = rosterCountByUnitId[leaderUnitId] ?? 0;
    if (alreadyPlaced >= rosterCount) return null; // every instance already on the board

    const leaderUnit = getUnitById(leaderUnitId);
    const leaderBase = leaderUnit ? getBaseTemplateById(leaderUnit.baseTemplateId) : undefined;
    const bodyguardBaseFull = getBaseTemplateById(bodyguardBase.id);
    if (!leaderUnit || !leaderBase || !bodyguardBaseFull) return null;

    // stand the leader just past the formation's right edge (widest row),
    // in the same row as the front rank -- a small, deterministic, and
    // legible spot rather than trying to guess a "best" one
    const [bodyguardWidthIn] = baseFootprintIn(bodyguardBaseFull);
    const [leaderWidthIn] = baseFootprintIn(leaderBase);
    const maxLocalX = Math.max(...localOffsets.map(([dx]) => dx));
    const gapIn = 0.25;
    const localX = maxLocalX + bodyguardWidthIn / 2 + gapIn + leaderWidthIn / 2;
    const localY = 0;
    const [rdx, rdy] = rotatePoint([localX, localY], rotationDeg);
    const leaderPos: Point = [
      Math.max(0, Math.min(map.board.width_in, clickPosition[0] + rdx)),
      Math.max(0, Math.min(map.board.height_in, clickPosition[1] + rdy)),
    ];

    if (cannotEndOnTerrain(map, leaderPos, leaderBase, rotationDeg)) return null;
    if (!infiltrator && !isInDeploymentZone(map, leaderPos, leaderBase, rotationDeg, owner)) return null;
    if (otherBaseTuples(new Set()).some((o) => doBasesOverlap(leaderPos, leaderBase, rotationDeg, o.center, o.base, o.rotationDeg))) {
      return null;
    }

    const letter = letterForIndex(nextUnitLetter.current++);
    return {
      id: `token_${nextTokenNum++}`,
      baseTemplateId: leaderUnit.baseTemplateId,
      position: leaderPos,
      rotationDeg,
      owner,
      groupId: `group_${nextGroupNum++}`,
      label: letter,
      unitId: leaderUnitId,
    };
  };

  return (
    <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onBack} style={BACK_BTN_STYLE}>
            &larr; {backLabel}
          </button>
          <div>
            <h2 style={{ fontSize: 17 }}>{map.name}</h2>
            {map.missionPack && (
              <div className="eyebrow" style={{ marginTop: 1 }}>
                {map.missionPack}
                {map.deploymentType ? ` · ${map.deploymentType}` : ""}
              </div>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11.5, maxWidth: 280 }}>
          {placementError ? (
            <span style={{ color: "var(--danger-strong)", fontWeight: 600 }}>{placementError}</span>
          ) : (
            <span style={{ color: "var(--text-faint)" }}>
              Session-only — refreshing clears tokens.
              <br />
              {mode === "move" &&
                "Movement phase — drag a token up to its Move distance. Hold Space mid-drag to drop a checkpoint and route around an obstacle."}
              {mode === "deploy" && armed && "Scroll the wheel over the map to rotate before placing."}
              {mode === "deploy" &&
                !armed &&
                selectedTokenIds.size === 0 &&
                "Click-drag empty space to select multiple tokens and move them together."}
              {mode === "deploy" &&
                !armed &&
                selectedTokenIds.size > 0 &&
                "Scroll the wheel over the map to rotate the selection."}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flex: 1, minHeight: 0 }}>
        {/* TODO: import mission cards (the actual mission-pack rules text --
            primary/secondary objectives, deployment special rules, etc.,
            not the board art) to be presented in the blank space that
            opens up here next to the map. Portrait boards in a wide
            viewport already leave real unused width in this flex:1
            container between the board and the TokenPalette sidebar
            (more so since v0.50's board crop tightened the board's own
            footprint) -- that's real estate a mission-reference panel
            could use without shrinking the board or the palette. Needs:
            sourcing the actual card text/images per mission (not yet in
            any map's data -- MissionMap has no field for it), and a
            component to render it that only shows when there's
            genuinely blank space to fill (a landscape board on a narrow
            viewport may not have any). */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start", height: "100%" }}>
          <MapView
            map={map}
            tokens={tokens}
            onBoardClick={handleBoardClick}
            onTokensMove={handleTokensMove}
            onDragEnd={handleDragEnd}
            onCheckpoint={handleCheckpoint}
            onSelectionChange={setSelectedTokenIds}
            selectedTokenIds={selectedTokenIds}
            ghost={ghost}
            onGhostRotate={(delta) => setArmedRotation((r) => r + delta)}
            onRotateSelection={handleRotateSelected}
            movePaths={mode === "move" ? movePaths : undefined}
            moveAllowanceFor={mode === "move" ? moveAllowanceFor : undefined}
          />
        </div>
        <TokenPalette
          mode={mode}
          onStartTurn1={handleStartTurn1}
          onBackToDeployment={handleBackToDeployment}
          armed={armed}
          onArm={handleArm}
          owner={owner}
          onOwnerChange={(nextOwner) => {
            setOwner(nextOwner);
            // the newly active side may have its own army/roster filter
            // that excludes whatever was armed/selected under the
            // previous owner -- clear rather than leave a selection the
            // palette no longer offers (and that a placement would
            // silently still use)
            const nextFilter = armyByOwner?.[nextOwner] ?? null;
            const nextRoster = rosterByOwner?.[nextOwner] ?? null;
            const currentUnit = selectedUnitId ? getUnitById(selectedUnitId) : null;
            if (currentUnit) {
              const stillInArmy = !nextFilter || unitsForArmy(nextFilter).some((u) => u.id === currentUnit.id);
              const stillInRoster =
                !nextRoster || nextRoster.units.length === 0 || nextRoster.units.some((e) => e.unitId === currentUnit.id);
              if (!stillInArmy || !stillInRoster) {
                setSelectedUnitId(null);
                setArmed(null);
              }
            }
          }}
          infiltrator={infiltrator}
          onInfiltratorChange={setInfiltrator}
          selectedUnitId={selectedUnitId}
          onSelectedUnitChange={setSelectedUnitId}
          armyFilter={armyByOwner ? armyByOwner[owner] : null}
          roster={rosterByOwner ? (rosterByOwner[owner]?.units ?? null) : null}
          placedCountByUnitId={placedGroupCountByUnitId}
          attachments={rosterByOwner ? rosterByOwner[owner]?.attachments : undefined}
          selectedCount={selectedTokenIds.size}
          onDeleteSelected={handleDeleteSelected}
          onRotateSelected={handleRotateSelected}
          canUndoLastLeg={canUndoLastLeg}
          onUndoLastLeg={handleUndoLastLeg}
        />
      </div>
    </div>
  );
}
