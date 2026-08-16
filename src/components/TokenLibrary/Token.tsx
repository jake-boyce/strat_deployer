import { useId } from "react";
import type { BaseTemplate } from "../../data/bases/schema";
import { mmToIn } from "../../data/bases/schema";

export interface TokenProps {
  base: BaseTemplate;
  /** Rendering scale, pixels per inch. Callers control this so the same
   *  component works at library-browser scale and (later) at whatever
   *  scale a map view is rendering at. */
  pxPerIn: number;
  /** Center position in the parent SVG's pixel coordinate space. */
  x?: number;
  y?: number;
  /** Rotation in degrees, clockwise, about (x,y). Only visually meaningful
   *  for ovals and rectangles -- circles are rotationally symmetric -- but
   *  accepted for all shapes so callers don't need to special-case it. */
  rotationDeg?: number;
  fill?: string;
  stroke?: string;
  /** Real unit artwork (background removed), clipped to the base shape and
   *  covering it (cropped, not letterboxed). When set, `fill` becomes the
   *  backdrop behind any part of the base the art doesn't cover rather
   *  than a flat tint over the whole token. */
  imageSrc?: string;
  onClick?: () => void;
  selected?: boolean;
  /** True when this token's base overlaps a terrain piece's card
   *  footprint at all (not just the blocking feature within it -- see
   *  overlappingTerrainFootprintId in geometry.ts). Informational, not a
   *  legality signal: draws a visible ring around the token so a player
   *  can tell at a glance, including live while dragging, whether their
   *  unit is on a terrain piece at all -- independent of whether that
   *  position is actually blocked, since the card itself is walkable. */
  inTerrain?: boolean;
}

const DEFAULT_FILL = "#3a6ea5";
const DEFAULT_STROKE = "#1a3a5c";
const SELECTED_STROKE = "#f0c020";
const IMAGE_BACKDROP = "#1a1a1a";
// how much larger than the base diameter the art is drawn, so it visually
// fills the circle/oval edge-to-edge (cropped via preserveAspectRatio
// "slice") instead of leaving a letterboxed gap for non-square source art
const IMAGE_COVERAGE = 1.15;
// the in-terrain indicator ring: distinct from both the owner-color ring
// and the selected-yellow ring (that pair already carries identity/
// selection state; this is an independent, informational third state --
// amber, not gold, to stay visually distinct from SELECTED_STROKE) --
// drawn as a second, larger copy of the base's own shape rather than a
// generic circle, so it reads correctly for oval and rectangular bases
// too, not just round ones
const IN_TERRAIN_RING_COLOR = "#d97706";
const IN_TERRAIN_RING_SCALE = 1.35;

export function Token({
  base,
  pxPerIn,
  x = 0,
  y = 0,
  rotationDeg = 0,
  fill = DEFAULT_FILL,
  stroke,
  imageSrc,
  onClick,
  selected = false,
  inTerrain = false,
}: TokenProps) {
  const clipId = useId();
  const strokeColor = stroke ?? (selected ? SELECTED_STROKE : DEFAULT_STROKE);
  const strokeWidth = selected ? 3 : 1.5;
  const transform = rotationDeg ? `rotate(${rotationDeg} ${x} ${y})` : undefined;

  const widthIn = base.shape === "circle" ? mmToIn(base.diameter_mm!) : mmToIn(base.width_mm!);
  const heightIn = base.shape === "circle" ? mmToIn(base.diameter_mm!) : mmToIn(base.height_mm!);

  const shapeProps: Record<string, number> =
    base.shape === "circle"
      ? { cx: x, cy: y, r: (widthIn / 2) * pxPerIn }
      : base.shape === "oval"
        ? { cx: x, cy: y, rx: (widthIn / 2) * pxPerIn, ry: (heightIn / 2) * pxPerIn }
        : {
            x: x - (widthIn / 2) * pxPerIn,
            y: y - (heightIn / 2) * pxPerIn,
            width: widthIn * pxPerIn,
            height: heightIn * pxPerIn,
          };
  const ShapeTag = base.shape === "circle" ? "circle" : base.shape === "oval" ? "ellipse" : "rect";

  // in-terrain ring: same shape type as the base, scaled up around the
  // same center rather than just padding the axis-aligned bounding box,
  // so it stays visually concentric under rotation too
  const ringProps: Record<string, number> =
    base.shape === "circle"
      ? { cx: x, cy: y, r: (widthIn / 2) * pxPerIn * IN_TERRAIN_RING_SCALE }
      : base.shape === "oval"
        ? {
            cx: x,
            cy: y,
            rx: (widthIn / 2) * pxPerIn * IN_TERRAIN_RING_SCALE,
            ry: (heightIn / 2) * pxPerIn * IN_TERRAIN_RING_SCALE,
          }
        : {
            x: x - (widthIn / 2) * pxPerIn * IN_TERRAIN_RING_SCALE,
            y: y - (heightIn / 2) * pxPerIn * IN_TERRAIN_RING_SCALE,
            width: widthIn * pxPerIn * IN_TERRAIN_RING_SCALE,
            height: heightIn * pxPerIn * IN_TERRAIN_RING_SCALE,
          };

  const imgW = widthIn * pxPerIn * IMAGE_COVERAGE;
  const imgH = heightIn * pxPerIn * IMAGE_COVERAGE;

  return (
    <g transform={transform} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      {inTerrain && (
        <ShapeTag
          {...ringProps}
          fill="none"
          stroke={IN_TERRAIN_RING_COLOR}
          strokeWidth={2}
          strokeDasharray="3 2"
          style={{ pointerEvents: "none" }}
        />
      )}
      {imageSrc && (
        <clipPath id={clipId}>
          <ShapeTag {...shapeProps} />
        </clipPath>
      )}
      <ShapeTag
        {...shapeProps}
        fill={imageSrc ? IMAGE_BACKDROP : fill}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
      {imageSrc && (
        <image
          href={imageSrc}
          x={x - imgW / 2}
          y={y - imgH / 2}
          width={imgW}
          height={imgH}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
          style={{ pointerEvents: "none" }}
        />
      )}
      {imageSrc && (
        // re-stroke the outline on top of the image so the owner-colored
        // ring stays crisp and visible over busy art
        <ShapeTag {...shapeProps} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} />
      )}
    </g>
  );
}
