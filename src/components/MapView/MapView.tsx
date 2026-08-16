import { useState, useRef, useId, useEffect, type CSSProperties, type MouseEvent, type WheelEvent } from "react";
import type { MissionMap, Point } from "../../data/maps/schema";
import type { PlacedToken, MoveWaypoint } from "../../data/placement";
import { getBaseTemplateById } from "../../data/bases/baseTemplates";
import { mmToIn } from "../../data/bases/schema";
import { getUnitTemplateById, formationOffsetsIn } from "../../data/bases/unitTemplates";
import { getUnitById } from "../../data/units/units";
import {
  rotatePoint,
  isInDeploymentZone,
  cannotEndOnTerrain,
  terrainKeepOutShapes,
  doBasesOverlap,
  overlappingTerrainFootprintId,
} from "../../data/geometry";
import { Token } from "../TokenLibrary/Token";

// logical width used for internal coordinate math (viewBox units). The
// ACTUAL on-screen size is controlled separately via responsive CSS (see
// the `style` on the outer <svg> below) -- SVG scales the viewBox to fit
// whatever CSS box size it's given, and getScreenCTM()-based click handling
// automatically accounts for that scaling, so this number doesn't need to
// track the real rendered size.
const DISPLAY_WIDTH = 700;
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;

/** Total distance used across a movement path -- the sum of each leg's
 *  recorded distUsed (see MoveWaypoint), not a straight-line
 *  recomputation from positions, which would silently discard any
 *  wandering distance spent within a leg. Used by the movement arrow to
 *  show total distance used across every committed leg. */
function pathLengthIn(path: MoveWaypoint[]): number {
  return path.reduce((sum, wp) => sum + wp.distUsed, 0);
}

const zoomBtnStyle: CSSProperties = {
  width: 22,
  height: 22,
  padding: 0,
  background: "var(--bg-panel-alt)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  cursor: "pointer",
  fontSize: 13,
  lineHeight: 1,
};

const zoneColor = (owner: string) =>
  owner === "red" ? "rgba(158,7,14,0.45)" : owner === "blue" ? "rgba(41,90,123,0.45)" : "rgba(120,120,120,0.25)";

const TERRAIN_HEAVY_FILL = "rgba(140,140,140,0.55)";
const TERRAIN_HEAVY_STROKE = "#e8e6df";
const TERRAIN_LIGHT_FILL = "rgba(150,150,150,0.22)";
const TERRAIN_LIGHT_STROKE = "#9a9d9f";
// the card itself is walkable -- only the feature(s) on top of it (styled
// via terrainStyle below) actually block placement/movement. This is
// deliberately much fainter than the keep-out styling: an outline for
// reference ("a terrain piece is here"), not something that reads as
// impassable.
const TERRAIN_CARD_STROKE = "rgba(154,157,159,0.4)";

function terrainStyle(t: { terrainType?: "light" | "heavy" }) {
  return t.terrainType === "light"
    ? { fill: TERRAIN_LIGHT_FILL, stroke: TERRAIN_LIGHT_STROKE, strokeDasharray: "4 3" }
    : { fill: TERRAIN_HEAVY_FILL, stroke: TERRAIN_HEAVY_STROKE, strokeDasharray: undefined };
}

export interface GhostSpec {
  kind: "base" | "unit";
  id: string;
  owner: "red" | "blue";
  /** Accumulated rotation from mouse-wheel input, applied to the ghost
   *  (and, at placement time, stored on the resulting PlacedToken(s)) the
   *  exact same way tok.rotationDeg is applied to a real placed token --
   *  see the counterRotate comment below for why that's what makes the
   *  ghost's final on-screen angle match what actually gets placed. */
  rotationDeg: number;
  /** When false, the ghost turns a warning color over any position where
   *  the eventual placement would be rejected (see DeploymentView) --
   *  i.e. any spot outside the owner's deployment zone. */
  infiltrator: boolean;
  /** Set when a real Unit (see src/data/units/) is selected in the
   *  palette, rather than a generic base -- swaps the ghost's flat color
   *  fill for a preview of the actual unit art. */
  unitId?: string | null;
}

export interface MapViewProps {
  map: MissionMap;
  onTerrainClick?: (id: string) => void;
  thumbnail?: boolean;
  /** Tokens placed on this map. Omit for static (non-interactive) display. */
  tokens?: PlacedToken[];
  /** Fired when the user clicks empty board space while a base template is
   *  "armed" for placement (see TokenPalette). Presence of this prop is
   *  what puts MapView into interactive/placement mode. */
  onBoardClick?: (position: Point) => void;
  /** Fired with every token's new position at once during a drag -- a
   *  plain single-token drag is just an array of length 1. Batched rather
   *  than one call per token so a multi-select group-drag moves everything
   *  together in one state update instead of N sequential ones. */
  onTokensMove?: (updates: { id: string; position: Point }[]) => void;
  /** Replaces the whole selection (click-drag a marquee box over empty
   *  space, click a single token, or click empty space to clear). There's
   *  no add-to-selection modifier yet -- every selection change is a
   *  fresh replacement, which covers "select these, drag them together"
   *  without the extra complexity of shift-click semantics. */
  onSelectionChange?: (ids: Set<string>) => void;
  selectedTokenIds?: Set<string>;
  /** Render the board rotated 90deg (landscape) to make better use of a
   *  wide screen. Only meaningful for the full (non-thumbnail) view --
   *  library/picker grids stay upright. Defaults on for the full view. */
  rotated?: boolean;
  /** What's currently armed for placement (see TokenPalette), if anything.
   *  When set, a semi-transparent preview follows the mouse showing where
   *  a click would place it -- the whole formation for a unit template,
   *  not just one model. Also disables marquee-select while armed, since
   *  drag-on-empty-space means "place" in that mode, not "select." */
  ghost?: GhostSpec | null;
  /** Fired on mouse-wheel over the board while a ghost is showing, with a
   *  +/-15deg step already applied -- just add it to your rotation state. */
  onGhostRotate?: (deltaDeg: number) => void;
  /** Fired on mouse-wheel over the board when nothing's armed but there IS
   *  a token selection, same +/-15deg step. Rotating an already-placed
   *  selection this way mirrors how rotation works during placement --
   *  scroll to reorient before you're done, just after the fact instead
   *  of before. */
  onRotateSelection?: (deltaDeg: number) => void;
  /** Each token's committed movement path this turn (see DeploymentView's
   *  "Turn 1" mode), present only during the movement phase. A path is at
   *  least one point (wherever the token started the turn); it gains a
   *  waypoint each time a drag ends somewhere legal, so multi-leg
   *  movement -- "left a bit to get around the ruin, then straight down"
   *  -- is a real multi-segment path here, not just a single origin. Any
   *  token whose current position differs from its path's last committed
   *  waypoint gets a measuring arrow drawn along the whole path plus the
   *  live in-progress segment, labeled with the TOTAL distance used
   *  (every committed leg summed, plus however far the current drag has
   *  gone), not just the current leg's own length. */
  movePaths?: Map<string, MoveWaypoint[]>;
  /** Given a placed token, its movement allowance in inches -- used to
   *  color the arrow (normal vs. "at max") and label it as "6.0" / 10"
   *  rather than just the raw distance. Only meaningful alongside
   *  movePaths. */
  moveAllowanceFor?: (token: PlacedToken) => number;
  /** Fired once, at mouseup, when a genuine token drag (not just a click)
   *  just completed -- passes the id->position map of where each dragged
   *  token started (before any of this drag's movement was applied), so
   *  the caller can validate the token's now-current position and revert
   *  it if the drag ended somewhere illegal (e.g. on top of terrain) --
   *  see DeploymentView's cannotEndOnTerrain check. Distinct from
   *  onTokensMove, which fires continuously during the drag itself. */
  onDragEnd?: (startPositions: Map<string, Point>) => void;
  /** Fired when Space is pressed while a token drag is actively in
   *  progress -- lets the person intentionally mark "this is a real leg
   *  boundary" (routing around an obstacle) without releasing the mouse,
   *  rather than the app trying to infer legs from mouse wandering.
   *  Passes the ids of the tokens currently being dragged; the handler
   *  should attempt to commit their current positions as a new waypoint
   *  and return whether it actually did (it may refuse, e.g. if a token
   *  is currently sitting on terrain). Only on success does MapView reset
   *  its own drag-start reference so the continuing gesture is measured
   *  as a fresh leg from the checkpoint rather than the original grab
   *  point. */
  onCheckpoint?: (tokenIds: string[]) => boolean;
}

export function MapView({
  map,
  onTerrainClick,
  thumbnail = false,
  tokens,
  onBoardClick,
  onTokensMove,
  onSelectionChange,
  selectedTokenIds,
  rotated,
  ghost,
  onGhostRotate,
  onRotateSelection,
  movePaths,
  moveAllowanceFor,
  onDragEnd,
  onCheckpoint,
}: MapViewProps) {
  const [showOverlay, setShowOverlay] = useState(true);
  const [zoom, setZoom] = useState(1);
  const arrowMarkerId = useId();
  const [hoverPos, setHoverPos] = useState<Point | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const cal = map.imageCalibration;
  const displayWidth = thumbnail ? 220 : DISPLAY_WIDTH;
  const isRotated = !thumbnail && rotated !== false;

  // drag state lives in refs, not useState -- it's read/written every
  // mousemove and doesn't need to trigger its own re-render (onTokensMove
  // updating the parent's token list already does that)
  const dragAnchorId = useRef<string | null>(null);
  const dragStartPositions = useRef<Map<string, Point>>(new Map());
  const tokenMouseDownId = useRef<string | null>(null);
  const tokenMouseDownXY = useRef<[number, number] | null>(null);
  const tokenDidDrag = useRef(false);
  const marqueeStart = useRef<[number, number] | null>(null);
  const marqueeDidDrag = useRef(false);

  // kept current every render (plain assignment, not inside an effect) so
  // the keydown listener below -- attached once, not re-attached on every
  // token-position update during a drag -- always reads the latest tokens
  // and onCheckpoint without needing to be recreated
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const onCheckpointRef = useRef(onCheckpoint);
  onCheckpointRef.current = onCheckpoint;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !dragAnchorId.current) return;
      e.preventDefault();
      const ids = Array.from(dragStartPositions.current.keys());
      const success = onCheckpointRef.current?.(ids);
      if (!success) return;
      // the checkpoint just committed each token's CURRENT position as a
      // new waypoint -- reset the drag-start reference to those same
      // positions so the gesture continues as a fresh leg measured from
      // here, not from the original mousedown point
      const newStarts = new Map<string, Point>();
      for (const id of ids) {
        const tok = tokensRef.current?.find((t) => t.id === id);
        if (tok) newStarts.set(id, tok.position);
      }
      dragStartPositions.current = newStarts;
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!cal) {
    // fall back to abstract vector-only rendering when no source art is available
    return <AbstractMapView map={map} onTerrainClick={onTerrainClick} />;
  }

  const displayScale = displayWidth / cal.imageWidthPx;
  const displayHeight = cal.imageHeightPx * displayScale;
  const pxPerIn = cal.pxScale * displayScale; // for sizing Token components correctly

  // convert a MissionMap inch-coordinate (origin bottom-left, y-up) into the
  // source image's pixel space (origin top-left, y-down), then into display
  // px. This is ALWAYS in the unrotated (portrait) coordinate frame -- the
  // rotation, when enabled, is applied as a single SVG transform on a
  // wrapping <g>, so none of this math (or the inverse, toBoardIn) needs to
  // know or care about rotation at all.
  const toDisplayPx = ([x_in, y_in]: Point): [number, number] => {
    const px = x_in * cal.pxScale + cal.pxOrigin[0];
    const py = cal.pxOrigin[1] + (map.board.height_in - y_in) * cal.pxScale;
    return [px * displayScale, py * displayScale];
  };

  const toBoardIn = (localX: number, localY: number): Point => {
    const px = localX / displayScale;
    const py = localY / displayScale;
    const x_in = (px - cal.pxOrigin[0]) / cal.pxScale;
    const y_in = map.board.height_in - (py - cal.pxOrigin[1]) / cal.pxScale;
    return [
      Math.max(0, Math.min(map.board.width_in, x_in)),
      Math.max(0, Math.min(map.board.height_in, y_in)),
    ];
  };

  const toPointsAttr = (poly: Point[]) => poly.map((p) => toDisplayPx(p).join(",")).join(" ");

  const svgRef = useRef<SVGSVGElement | null>(null);
  const contentGroupRef = useRef<SVGGElement | null>(null);
  const zoomContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (thumbnail || !zoomContainerRef.current) return;
    const el = zoomContainerRef.current;
    const update = () => setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [thumbnail]);

  // Convert a mouse event's screen (client) coordinates into the content
  // group's LOCAL coordinate system -- i.e. the same unrotated portrait
  // pixel space toDisplayPx/toBoardIn use -- via the browser's own screen
  // CTM (current transformation matrix). This automatically accounts for
  // the rotation transform, any CSS responsive scaling, etc. without any
  // manual trigonometry.
  const eventToLocalXY = (e: { clientX: number; clientY: number }): [number, number] => {
    const svg = svgRef.current!;
    const g = contentGroupRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = g.getScreenCTM();
    if (!ctm) return [0, 0];
    const local = pt.matrixTransform(ctm.inverse());
    return [local.x, local.y];
  };

  const handleBackgroundClick = (e: MouseEvent<SVGSVGElement>) => {
    if (!onBoardClick) return;
    const [lx, ly] = eventToLocalXY(e);
    onBoardClick(toBoardIn(lx, ly));
  };

  const handleSvgMouseDown = (e: MouseEvent<SVGSVGElement>) => {
    // a mousedown that reaches here (rather than being stopped by a
    // token's own handler) means it started on empty board space.
    if (ghost) return; // armed mode: drag-on-empty-space places, doesn't select
    const [lx, ly] = eventToLocalXY(e);
    marqueeStart.current = [lx, ly];
    marqueeDidDrag.current = false;
    setMarqueeRect({ x0: lx, y0: ly, x1: lx, y1: ly });
  };

  const handleTokenMouseDown = (id: string) => (e: MouseEvent) => {
    e.stopPropagation();
    // Dragging a token that's part of the current multi-selection should
    // move the whole group -- but a plain CLICK (mousedown+mouseup with no
    // real movement) on a member of that selection should instead narrow
    // it down to just that one token, matching the usual Finder/Explorer-
    // style convention. Both behaviors start the same way (keep the group
    // armed for a possible drag); which one actually happens is decided at
    // mouseup based on whether a real drag occurred.
    const alreadyInGroup = (selectedTokenIds?.size ?? 0) > 1 && selectedTokenIds?.has(id);
    const idsToMove = alreadyInGroup ? selectedTokenIds! : new Set([id]);
    if (!alreadyInGroup) onSelectionChange?.(idsToMove);

    tokenMouseDownId.current = id;
    tokenMouseDownXY.current = eventToLocalXY(e);
    tokenDidDrag.current = false;

    if (!onTokensMove) return;
    dragAnchorId.current = id;
    const starts = new Map<string, Point>();
    tokens?.forEach((tok) => {
      if (idsToMove.has(tok.id)) starts.set(tok.id, tok.position);
    });
    dragStartPositions.current = starts;
  };

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    const [lx, ly] = eventToLocalXY(e);

    if (dragAnchorId.current && onTokensMove) {
      if (tokenMouseDownXY.current) {
        const [sx, sy] = tokenMouseDownXY.current;
        if (Math.hypot(lx - sx, ly - sy) > 4) tokenDidDrag.current = true;
      }
      const anchorStart = dragStartPositions.current.get(dragAnchorId.current);
      if (anchorStart) {
        const newAnchorPos = toBoardIn(lx, ly);
        const dx = newAnchorPos[0] - anchorStart[0];
        const dy = newAnchorPos[1] - anchorStart[1];
        const updates = Array.from(dragStartPositions.current.entries()).map(([id, start]) => ({
          id,
          position: [
            Math.max(0, Math.min(map.board.width_in, start[0] + dx)),
            Math.max(0, Math.min(map.board.height_in, start[1] + dy)),
          ] as Point,
        }));
        onTokensMove(updates);
      }
    } else if (marqueeStart.current) {
      const [sx, sy] = marqueeStart.current;
      if (Math.hypot(lx - sx, ly - sy) > 4) marqueeDidDrag.current = true;
      setMarqueeRect({ x0: sx, y0: sy, x1: lx, y1: ly });
    }

    if (ghost) {
      setHoverPos(toBoardIn(lx, ly));
    }
  };

  const handleMouseUp = () => {
    if (dragAnchorId.current && !tokenDidDrag.current && tokenMouseDownId.current) {
      // mousedown+mouseup with no real movement on a token that was part of
      // a larger selection -- narrow the selection down to just this one
      onSelectionChange?.(new Set([tokenMouseDownId.current]));
    }
    if (dragAnchorId.current && tokenDidDrag.current && onDragEnd) {
      onDragEnd(new Map(dragStartPositions.current));
    }
    dragAnchorId.current = null;
    dragStartPositions.current.clear();
    tokenMouseDownId.current = null;
    tokenMouseDownXY.current = null;

    if (marqueeStart.current) {
      if (marqueeDidDrag.current && marqueeRect && tokens) {
        const x0 = Math.min(marqueeRect.x0, marqueeRect.x1);
        const x1 = Math.max(marqueeRect.x0, marqueeRect.x1);
        const y0 = Math.min(marqueeRect.y0, marqueeRect.y1);
        const y1 = Math.max(marqueeRect.y0, marqueeRect.y1);
        const matched = new Set<string>();
        tokens.forEach((tok) => {
          const [tx, ty] = toDisplayPx(tok.position);
          if (tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1) matched.add(tok.id);
        });
        onSelectionChange?.(matched);
      } else {
        // a plain click on empty space (no meaningful drag) clears selection
        onSelectionChange?.(new Set());
      }
      marqueeStart.current = null;
      setMarqueeRect(null);
    }
  };

  const handleMouseLeave = () => {
    dragAnchorId.current = null;
    dragStartPositions.current.clear();
    tokenMouseDownId.current = null;
    tokenMouseDownXY.current = null;
    marqueeStart.current = null;
    setMarqueeRect(null);
    setHoverPos(null);
  };

  const handleWheel = (e: WheelEvent<SVGSVGElement>) => {
    if (e.altKey) {
      e.preventDefault();
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP))));
      return;
    }
    if (ghost && onGhostRotate) {
      e.preventDefault();
      onGhostRotate(e.deltaY > 0 ? 15 : -15);
      return;
    }
    if ((selectedTokenIds?.size ?? 0) > 0 && onRotateSelection) {
      e.preventDefault();
      onRotateSelection(e.deltaY > 0 ? 15 : -15);
    }
  };

  // Outer <svg> viewBox dimensions: swapped when rotated, since a WxH box
  // rotated 90deg occupies an HxW bounding box.
  //
  // The source art includes a title strip above the board ("LAYOUT A")
  // and inch-ruler margins on the sides/bottom that aren't part of the
  // actual playing surface -- cal.pxOrigin/board.width_in/height_in
  // already describe exactly where the real board sits within that
  // larger image (that's what toDisplayPx/toBoardIn use to place
  // everything correctly regardless). For the main board view, window the
  // viewBox down to just that board rectangle instead of the full image,
  // so the container's fit-to-size scaling (fitScale below) fills the
  // screen with the board itself rather than with dead margin around it.
  // Thumbnails are left uncropped: the map picker already shows map.name
  // as real text next to each thumbnail, so nothing meaningful is lost by
  // NOT cropping there, and keeping thumbnails on the original full-image
  // frame keeps their aspect ratios/widths consistent across the library
  // grid rather than varying per map's margin proportions.
  const cropX = thumbnail ? 0 : cal.pxOrigin[0] * displayScale;
  const cropY = thumbnail ? 0 : cal.pxOrigin[1] * displayScale;
  const cropW = thumbnail ? displayWidth : map.board.width_in * pxPerIn;
  const cropH = thumbnail ? displayHeight : map.board.height_in * pxPerIn;

  const outerW = isRotated ? cropH : cropW;
  const outerH = isRotated ? cropW : cropH;
  // Rotate the WxH content clockwise and reflow it to fill the new HxW
  // viewport, pivoting at top-left: translate(H,0) rotate(90). This
  // transform is always relative to the FULL (uncropped) image frame --
  // it doesn't need to know about the crop at all, since the crop is
  // applied separately below as just a change of viewBox window, not a
  // change to the content's own coordinates.
  const contentTransform = isRotated ? `translate(${displayHeight},0) rotate(90)` : undefined;
  // viewBox min-x/min-y: under rotation, a point (x,y) in the untransformed
  // frame lands at (displayHeight-y, x) after the transform above (derived
  // from translate(displayHeight,0) rotate(90)) -- so the crop rect's
  // post-rotation bounding box top-left is (displayHeight-cropY-cropH,
  // cropX), not (cropX, cropY).
  const viewBoxMinX = isRotated ? displayHeight - cropY - cropH : cropX;
  const viewBoxMinY = isRotated ? cropX : cropY;

  // Explicit rendered pixel size for the svg element: "fit the container"
  // scale times the zoom multiplier, computed directly rather than via
  // CSS object-fit -- combining object-fit's internal content-fitting
  // with a separate CSS `transform: scale()` on the same element turned
  // out not to compose the way it looks like it should: measured a
  // consistent, large, single-axis-only placement error when both were
  // active together (verified with Playwright, not just eyeballed -- see
  // the Status entry for the actual numbers). Plain explicit width/height
  // is just standard SVG viewBox-to-viewport scaling, which
  // getScreenCTM() has always handled correctly throughout this app.
  const fitScale =
    !thumbnail && containerSize && containerSize.w > 0 && containerSize.h > 0
      ? Math.min(containerSize.w / outerW, containerSize.h / outerH)
      : null;
  const renderedW = fitScale ? outerW * fitScale * zoom : undefined;
  const renderedH = fitScale ? outerH * fitScale * zoom : undefined;

  // One label per GROUP, not per model -- a tightly-packed 10-model
  // formation used to render 10 overlapping copies of the same name,
  // which was unreadable. Every token already carries a groupId (unique
  // per single-base placement too, so this generalizes without a special
  // case for "isn't actually a formation"). Positioned at the group's
  // centroid, offset down far enough to clear whichever member extends
  // furthest in that direction -- not just one member's radius -- so the
  // label sits below the whole cluster instead of overlapping part of it.
  const groupLabels: { key: string; x: number; y: number; pivotX: number; pivotY: number; text: string }[] =
    (() => {
      if (!tokens) return [];
      const groups = new Map<string, PlacedToken[]>();
      for (const tok of tokens) {
        const key = tok.groupId ?? tok.id;
        const list = groups.get(key);
        if (list) list.push(tok);
        else groups.set(key, [tok]);
      }
      const out: { key: string; x: number; y: number; pivotX: number; pivotY: number; text: string }[] = [];
      for (const [key, members] of groups) {
        const first = members[0];
        const base = getBaseTemplateById(first.baseTemplateId);
        if (!base) continue;
        const unit = first.unitId ? getUnitById(first.unitId) : undefined;
        const text = unit?.name ?? first.label;
        if (!text) continue;
        const halfHeightIn = base.shape === "circle" ? mmToIn(base.diameter_mm!) / 2 : mmToIn(base.height_mm!) / 2;
        const radiusPx = halfHeightIn * pxPerIn;
        const positions = members.map((m) => toDisplayPx(m.position));
        const centerX = positions.reduce((sum, [px]) => sum + px, 0) / positions.length;
        const centerY = positions.reduce((sum, [, py]) => sum + py, 0) / positions.length;
        // How far past the centroid does this group extend in whichever
        // direction ends up "down" on screen? The board content is
        // rendered through `translate(H,0) rotate(90)` when isRotated,
        // under which a local point (x,y) maps to screen (H-y, x) -- so
        // screen-Y equals local-X, NOT local-Y, in that case. Measuring
        // spread along the wrong axis here was the original bug: it
        // computed a real number, just not the one that corresponds to
        // "how far down on screen," so the label landed mid-formation
        // instead of below all of it.
        const maxBottomOffset = isRotated
          ? Math.max(...positions.map(([px]) => px - centerX + radiusPx))
          : Math.max(...positions.map(([, py]) => py - centerY + radiusPx));
        out.push({ key, x: centerX, y: centerY + maxBottomOffset + 12, pivotX: centerX, pivotY: centerY, text });
      }
      return out;
    })();

  // Movement arrows, grouped by unit (groupId -- every model from the
  // same placement shares one) rather than drawn one per token: once a
  // unit's been deployed and deselected, its arrow is just clutter
  // sitting on top of the board -- exactly what the shrink pass in v0.49
  // was trying to address, but shrinking still left one arrow+label per
  // MODEL, so a deselected 5-model squad still drew 5 overlapping
  // arrows. Reselecting the unit (any of its members) brings the full
  // per-model detail -- arrows and distance labels -- straight back, for
  // exactly the re-placement/fine-adjustment case that detail exists
  // for. Falls back to the token's own id as the group key on the rare
  // chance groupId isn't set, so every moved token still gets grouped
  // (as a group of one, functionally identical to today's per-token
  // rendering).
  const moveArrowGroups = (() => {
    if (!movePaths || !tokens) return [];
    const byGroup = new Map<string, PlacedToken[]>();
    for (const tok of tokens) {
      const path = movePaths.get(tok.id);
      if (!path || path.length === 0) continue;
      const lastWaypoint = path[path.length - 1];
      const liveSegDist = Math.hypot(tok.position[0] - lastWaypoint.pos[0], tok.position[1] - lastWaypoint.pos[1]);
      const totalDist = pathLengthIn(path) + liveSegDist;
      if (totalDist < 0.05) continue; // hasn't moved (yet) this turn -- nothing to draw
      const key = tok.groupId ?? tok.id;
      const arr = byGroup.get(key) ?? [];
      arr.push(tok);
      byGroup.set(key, arr);
    }
    return Array.from(byGroup.values()).map((members) => ({
      members,
      selected: members.some((m) => selectedTokenIds?.has(m.id)),
    }));
  })();

  return (
    <div
      style={
        thumbnail
          ? {}
          : { width: "100%", height: "100%", display: "flex", flexDirection: "column" }
      }
    >
      {!thumbnail && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginLeft: "auto" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--text-dim)" }}>
              <input type="checkbox" checked={showOverlay} onChange={(e) => setShowOverlay(e.target.checked)} />
              Show deployment zones / terrain overlay
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Alt+scroll to zoom</span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--text-dim)",
                  width: 40,
                  textAlign: "center",
                }}
              >
                {Math.round(zoom * 100)}%
              </span>
              {zoom !== 1 && (
                <button onClick={() => setZoom(1)} style={{ ...zoomBtnStyle, width: "auto", padding: "0 8px" }} title="Reset zoom">
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <div
        ref={zoomContainerRef}
        style={
          thumbnail
            ? undefined
            : { flex: "1 1 0%", minHeight: 0, overflow: "auto", border: "1px solid var(--border)" }
        }
      >
        <svg
          ref={svgRef}
          viewBox={`${viewBoxMinX} ${viewBoxMinY} ${outerW} ${outerH}`}
          width={thumbnail ? outerW : renderedW}
          height={thumbnail ? undefined : renderedH}
          style={{
            display: "block",
            border: thumbnail ? "1px solid var(--border)" : "none",
            borderRadius: thumbnail ? "var(--radius)" : 0,
            cursor: ghost ? "crosshair" : "default",
            background: "#0c0d0e",
          }}
          onClick={handleBackgroundClick}
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        <defs>
          <marker
            id={arrowMarkerId}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="4.5"
            markerHeight="4.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-strong)" />
          </marker>
        </defs>
        <g ref={contentGroupRef} transform={contentTransform}>
          <image href={cal.src} x={0} y={0} width={displayWidth} height={displayHeight} />

          {showOverlay &&
            map.zones.map((zone, i) => (
              <polygon
                key={`zone-${i}`}
                points={toPointsAttr(zone.polygon)}
                fill={zoneColor(zone.owner)}
                stroke="#111"
                strokeWidth={1.5}
                style={{ pointerEvents: "none" }}
              />
            ))}
          {showOverlay &&
            map.terrain.map((t) => (
              <g key={t.id}>
                {/* the card itself: walkable, shown only as a faint
                    reference outline so it's clear a terrain piece is
                    here, not styled as impassable */}
                <polygon
                  points={toPointsAttr(t.corners as unknown as Point[])}
                  fill="none"
                  stroke={TERRAIN_CARD_STROKE}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                  onClick={(e) => {
                    if (onTerrainClick) {
                      e.stopPropagation();
                      onTerrainClick(t.id);
                    }
                  }}
                  style={{
                    cursor: onTerrainClick ? "pointer" : "default",
                    pointerEvents: onTerrainClick ? "auto" : "none",
                  }}
                />
                {/* the actual keep-out geometry: the feature(s) a unit
                    genuinely can't be placed on -- see
                    terrainKeepOutShapes in geometry.ts */}
                {terrainKeepOutShapes(t).map((shape, i) => (
                  <polygon
                    key={i}
                    points={toPointsAttr(shape as unknown as Point[])}
                    {...terrainStyle(t)}
                    strokeWidth={1}
                    style={{ pointerEvents: "none" }}
                  />
                ))}
              </g>
            ))}
          {showOverlay &&
            map.objectives.map((obj) => {
              const [cx, cy] = toDisplayPx(obj.position);
              return (
                <circle
                  key={obj.id}
                  cx={cx}
                  cy={cy}
                  r={5}
                  fill="#fff"
                  stroke="#111"
                  strokeWidth={1.5}
                  style={{ pointerEvents: "none" }}
                />
              );
            })}
          {tokens?.map((tok) => {
            const base = getBaseTemplateById(tok.baseTemplateId);
            if (!base) return null;
            const [cx, cy] = toDisplayPx(tok.position);
            // counter-rotate the token's own visual so its orientation
            // reads naturally regardless of board rotation
            const counterRotate = isRotated ? -90 : 0;
            const unit = tok.unitId ? getUnitById(tok.unitId) : undefined;
            const isSelected = selectedTokenIds?.has(tok.id) ?? false;
            const ownerRingColor = tok.owner === "red" ? "#c96a5f" : "#4f83a8";
            const inTerrain = overlappingTerrainFootprintId(map, tok.position, base, tok.rotationDeg) !== null;
            return (
              <Token
                key={tok.id}
                base={base}
                pxPerIn={pxPerIn}
                x={cx}
                y={cy}
                rotationDeg={tok.rotationDeg + counterRotate}
                fill={tok.owner === "red" ? "rgba(158,7,14,0.85)" : "rgba(41,90,123,0.85)"}
                stroke={unit ? (isSelected ? "#f0c020" : ownerRingColor) : undefined}
                imageSrc={unit?.imageSrc}
                selected={isSelected}
                inTerrain={inTerrain}
              />
            );
          })}
          {tokens?.map((tok) => {
            // separate invisible larger hit-target layer on top, so small
            // tokens (25mm) are still easy to grab and drag precisely
            const base = getBaseTemplateById(tok.baseTemplateId);
            if (!base) return null;
            const [cx, cy] = toDisplayPx(tok.position);
            const r = Math.max(10, pxPerIn * 0.5);
            return (
              <circle
                key={`hit-${tok.id}`}
                cx={cx}
                cy={cy}
                r={r}
                fill="transparent"
                onMouseDown={handleTokenMouseDown(tok.id)}
                onClick={(e) => e.stopPropagation()}
                style={{ cursor: "grab" }}
              />
            );
          })}
          {moveArrowGroups.flatMap((group) => {
            // Reselecting any member of a unit brings back full per-model
            // detail (arrows + distance labels) for fine adjustment --
            // otherwise, one representative member stands in for the
            // whole unit's motion (every member moves by the same
            // delta -- see DeploymentView's atomic group-drag commit --
            // so any single member's path is a faithful stand-in) with
            // no label, since a bare arrow is enough to show "this unit
            // moved, and to roughly where" without cluttering the board.
            const toRender = group.selected ? group.members : group.members.slice(0, 1);
            return toRender.map((tok) => {
              const path = movePaths!.get(tok.id)!;
              const lastWaypoint = path[path.length - 1];
              const liveSegDist = Math.hypot(
                tok.position[0] - lastWaypoint.pos[0],
                tok.position[1] - lastWaypoint.pos[1]
              );
              const totalDist = pathLengthIn(path) + liveSegDist;
              const maxDist = moveAllowanceFor?.(tok);
              const atMax = maxDist !== undefined && totalDist >= maxDist - 0.05;
              const color = atMax ? "var(--danger-strong)" : "var(--accent-strong)";

              // the full path so far: every committed waypoint plus
              // wherever the token currently is (which is the live,
              // still-in-progress end of the last leg while a drag is
              // active)
              const committedPoints = path.map((wp) => wp.pos);
              const allPoints = liveSegDist > 0.01 ? [...committedPoints, tok.position] : committedPoints;
              const displayPoints = allPoints.map((p) => toDisplayPx(p));
              const pointsAttr = displayPoints.map(([x, y]) => `${x},${y}`).join(" ");

              const [lastX, lastY] = displayPoints[displayPoints.length - 1];
              const [prevX, prevY] = displayPoints[displayPoints.length - 2] ?? [lastX, lastY];
              const midX = (lastX + prevX) / 2;
              const midY = (lastY + prevY) / 2;
              const counterRotate = isRotated ? -90 : 0;
              const labelTransform = counterRotate ? `rotate(${counterRotate} ${midX} ${midY})` : undefined;
              const distLabel = maxDist !== undefined ? `${totalDist.toFixed(1)}" / ${maxDist}"` : `${totalDist.toFixed(1)}"`;

              return (
                <g key={`arrow-${tok.id}`} style={{ pointerEvents: "none" }}>
                  <polyline
                    points={pointsAttr}
                    fill="none"
                    stroke={color}
                    strokeWidth={1}
                    markerEnd={`url(#${arrowMarkerId})`}
                  />
                  <circle cx={displayPoints[0][0]} cy={displayPoints[0][1]} r={1.8} fill={color} />
                  {/* small dots at each committed bend point, so a multi-leg
                      move ("left a bit, then down") visibly reads as a
                      corner, not just a longer straight arrow */}
                  {displayPoints.slice(1, -1).map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r={1.4} fill={color} />
                  ))}
                  {group.selected && (
                    <text
                      x={midX}
                      y={midY}
                      transform={labelTransform}
                      textAnchor="middle"
                      dy={-6}
                      fontFamily="var(--font-mono)"
                      fontSize={9}
                      fontWeight={600}
                      fill={color}
                      stroke="#0d0e10"
                      strokeWidth={2}
                      paintOrder="stroke"
                      style={{ userSelect: "none" }}
                    >
                      {distLabel}
                    </text>
                  )}
                </g>
              );
            });
          })}
          {groupLabels.map((g) => {
            const counterRotate = isRotated ? -90 : 0;
            const labelTransform = counterRotate ? `rotate(${counterRotate} ${g.pivotX} ${g.pivotY})` : undefined;
            return (
              <text
                key={`label-${g.key}`}
                x={g.x}
                y={g.y}
                transform={labelTransform}
                textAnchor="middle"
                fontFamily="var(--font-display)"
                fontSize={12}
                fontWeight={600}
                fill="#f4f1ea"
                stroke="#0d0e10"
                strokeWidth={3}
                paintOrder="stroke"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {g.text}
              </text>
            );
          })}

          {marqueeRect && marqueeDidDrag.current && (
            <rect
              x={Math.min(marqueeRect.x0, marqueeRect.x1)}
              y={Math.min(marqueeRect.y0, marqueeRect.y1)}
              width={Math.abs(marqueeRect.x1 - marqueeRect.x0)}
              height={Math.abs(marqueeRect.y1 - marqueeRect.y0)}
              fill="var(--accent-dim)"
              stroke="var(--accent)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              style={{ pointerEvents: "none" }}
            />
          )}

          {ghost && hoverPos && (
            <g style={{ pointerEvents: "none" }}>
              {(() => {
                const counterRotate = isRotated ? -90 : 0;
                const validFill = ghost.owner === "red" ? "rgba(158,7,14,0.55)" : "rgba(41,90,123,0.55)";
                const invalidFill = "rgba(200,40,20,0.6)";
                const invalidStroke = "#ffcc00";
                const selectedUnit = ghost.unitId ? getUnitById(ghost.unitId) : undefined;

                if (ghost.kind === "base") {
                  const base = getBaseTemplateById(ghost.id);
                  if (!base) return null;
                  const onTerrain = cannotEndOnTerrain(map, hoverPos, base, ghost.rotationDeg);
                  const inZone = ghost.infiltrator || isInDeploymentZone(map, hoverPos, base, ghost.rotationDeg, ghost.owner);
                  const overlapsBase = (tokens ?? []).some((t) => {
                    const otherBase = getBaseTemplateById(t.baseTemplateId);
                    return otherBase && doBasesOverlap(hoverPos, base, ghost.rotationDeg, t.position, otherBase, t.rotationDeg);
                  });
                  const valid = inZone && !onTerrain && !overlapsBase;
                  const inTerrain = overlappingTerrainFootprintId(map, hoverPos, base, ghost.rotationDeg) !== null;
                  const [cx, cy] = toDisplayPx(hoverPos);
                  return (
                    <Token
                      base={base}
                      pxPerIn={pxPerIn}
                      x={cx}
                      y={cy}
                      rotationDeg={ghost.rotationDeg + counterRotate}
                      fill={valid ? validFill : invalidFill}
                      stroke={valid ? "#fff" : invalidStroke}
                      imageSrc={selectedUnit?.imageSrc}
                      inTerrain={inTerrain}
                    />
                  );
                }

                const unitTemplate = getUnitTemplateById(ghost.id);
                const base = unitTemplate ? getBaseTemplateById(unitTemplate.baseTemplateId) : undefined;
                if (!unitTemplate || !base) return null;
                const offsets = formationOffsetsIn(unitTemplate, base);
                const modelPositions = offsets.map(([dx, dy]): Point => {
                  const [rdx, rdy] = rotatePoint([dx, dy], ghost.rotationDeg);
                  return [hoverPos[0] + rdx, hoverPos[1] + rdy];
                });
                // all-or-nothing: if any model would fall outside the zone
                // or overlap heavy terrain or another base, the whole
                // formation shows as invalid (matches the all-or-nothing
                // placement rule in DeploymentView)
                const anyOnTerrain = modelPositions.some((p) => cannotEndOnTerrain(map, p, base, ghost.rotationDeg));
                const anyOverlapsBase = modelPositions.some((p) =>
                  (tokens ?? []).some((t) => {
                    const otherBase = getBaseTemplateById(t.baseTemplateId);
                    return otherBase && doBasesOverlap(p, base, ghost.rotationDeg, t.position, otherBase, t.rotationDeg);
                  })
                );
                const allInZone =
                  ghost.infiltrator ||
                  modelPositions.every((p) => isInDeploymentZone(map, p, base, ghost.rotationDeg, ghost.owner));
                const allValid = allInZone && !anyOnTerrain && !anyOverlapsBase;
                return (
                  <>
                    {modelPositions.map((pos, i) => {
                      const [cx, cy] = toDisplayPx(pos);
                      const modelInTerrain = overlappingTerrainFootprintId(map, pos, base, ghost.rotationDeg) !== null;
                      return (
                        <Token
                          key={i}
                          base={base}
                          pxPerIn={pxPerIn}
                          x={cx}
                          y={cy}
                          rotationDeg={ghost.rotationDeg + counterRotate}
                          fill={allValid ? validFill : invalidFill}
                          stroke={allValid ? "#fff" : invalidStroke}
                          imageSrc={selectedUnit?.imageSrc}
                          inTerrain={modelInTerrain}
                        />
                      );
                    })}
                  </>
                );
              })()}
            </g>
          )}
        </g>
      </svg>
      </div>
    </div>
  );
}

/** Fallback for maps without source art: pure vector rendering from traced data. */
function AbstractMapView({ map, onTerrainClick }: MapViewProps) {
  const PPI = 12;
  const w = map.board.width_in * PPI;
  const h = map.board.height_in * PPI;
  const toSvgPoints = (poly: Point[]) =>
    poly.map(([x, y]) => `${(x * PPI).toFixed(1)},${((map.board.height_in - y) * PPI).toFixed(1)}`).join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ background: "#e8e4da", border: "2px solid #222" }}>
      {map.zones.map((zone, i) => (
        <polygon key={`zone-${i}`} points={toSvgPoints(zone.polygon)} fill={zoneColor(zone.owner)} stroke="#111" strokeWidth={1} />
      ))}
      {map.terrain.map((t) => (
        <g key={t.id}>
          <polygon
            points={toSvgPoints(t.corners as unknown as Point[])}
            fill="none"
            stroke={TERRAIN_CARD_STROKE}
            strokeWidth={1}
            strokeDasharray="2 3"
            onClick={() => onTerrainClick?.(t.id)}
            style={{ cursor: onTerrainClick ? "pointer" : "default" }}
          />
          {terrainKeepOutShapes(t).map((shape, i) => (
            <polygon
              key={i}
              points={toSvgPoints(shape as unknown as Point[])}
              {...terrainStyle(t)}
              strokeWidth={1}
              style={{ pointerEvents: "none" }}
            />
          ))}
        </g>
      ))}
      {map.objectives.map((obj) => (
        <circle
          key={obj.id}
          cx={obj.position[0] * PPI}
          cy={(map.board.height_in - obj.position[1]) * PPI}
          r={6}
          fill="#fff"
          stroke="#111"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}
