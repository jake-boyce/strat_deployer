"""
Extracts the actual keep-out geometry WITHIN each already-known terrain
footprint (card). Correction from the original terrain_v4.py design
intent: that script explicitly targets "the grey footprint card itself
... not the decorative art/features sitting on top of it," on the
assumption the card was what mattered for gameplay. That assumption was
wrong -- the card itself is walkable; only the decorative feature
elements actually sitting on top of it (support struts, pipework,
wreckage) are what a unit can't be placed on. This script runs AFTER
terrain_v4.py has already established each card's footprint and finds
the tighter shape(s) within it.

The keep-out shape for each feature cluster is its actual traced contour
(cv2.findContours + cv2.approxPolyDP to simplify the raw pixel-level
boundary down to a reasonable polygon), NOT a bounding rectangle. A
terrain feature has no real "footprint" or bounding box in the rules --
the coloring in the art IS the feature's literal physical position, and a
rectangle around an irregular pipe run or an L-shaped strut claims space
the feature doesn't actually occupy. An earlier version of this script
used cv2.minAreaRect (matching how terrain_v4.py extracts the outer
card), which was a reasonable first guess but wrong for this specific
case: the outer card really is close to rectangular, but individual
feature clusters usually aren't.

Checked before writing the first version of this: sampled per-pixel color
within a real terrain footprint and ran connected-components on a
yellow/green hue mask rather than assuming a threshold -- found the
feature-colored area is genuinely a small fraction of the card (5.8% in
the sampled case) split across multiple distinct clusters (37 components,
most of them tiny noise specks, a handful of substantial ones -- 808px,
598px, 574px, 241px, 230px, 163px), not one blob. A single bounding shape
per card would either miss real feature clusters or swallow a lot of
legitimately walkable card between them, so this extracts ONE traced
polygon PER significant connected component instead.

**Distinguishing genuine terrain feature coloring from objective-marker
icon coloring has been wrong twice, in opposite directions, and both
times only corrected after actually sampling pixels instead of assuming.**
Worth recording both mistakes plainly since a plausible-sounding "fix"
based on a small sample was the root cause each time:

1. First version covered "yellow/gold and green" as feature colors, with
   no exclusion for objective-marker icons at all. A direct report caught
   markers (white skull/eye icon, white ring border) getting swept into
   nearby terrain pieces' keep-out shapes, since some sit physically on
   top of or right next to a terrain card and this script's own per-card
   hue sampling picked them up as if they belonged to that card.
2. "Fixed" by excluding a green hue band and the marker's specific
   measured RGB (~(17,103,87)) -- based on sampling only 3-4 maps, where
   real terrain features happened to be yellow/gold-dominant, and wrongly
   concluding from that small sample that ALL green was marker
   contamination. Directly reported as wrong with a specific
   counter-example map (purge_mirror_c): several real terrain pieces
   there have large, genuinely green/teal pipe-and-strut art (up to 6+
   inches long) using close to the exact same hue as that map's
   objective-marker icons. Pure hue/color-based exclusion can't tell them
   apart there, because on that map they really aren't different colors.

What DOES reliably distinguish them, checked directly rather than
assumed: shape and size, not color. Objective-marker icons are
consistently near-square (a circle or diamond's bounding box is roughly
1:1) and a consistent size within a given map (~2.0in on one map, ~3.1-
3.4in on another -- different maps evidently render the icon at a
different scale, but each map's own instances are internally consistent).
Genuine terrain feature clusters, even ones that happen to be teal-green
colored, are usually elongated (pipes, struts -- aspect ratios of 1.5-3.5
were common on the counter-example map) precisely because they aren't
circular/diamond icons. So: the hue range covers both yellow/gold AND
green/teal again (the original, correct scope), and instead of excluding
by color, a connected component gets excluded specifically when it's BOTH
close to square (aspect ratio under `MARKER_MAX_ASPECT`) AND within a
plausible marker size range (`MARKER_SIZE_MIN_IN`-`MARKER_SIZE_MAX_IN`
inches in both dimensions) -- regardless of its exact color. A large
elongated teal pipe stays in; a small square teal (or yellow, or
anything else) blob doesn't.
"""

import cv2
import numpy as np
import json
import os
import sys

BOARD_H = 60.0
MIN_COMPONENT_AREA_PX = 80  # filters out small color-noise specks / anti-aliasing
CONTOUR_SIMPLIFY_FRACTION = 0.005  # epsilon as a fraction of the contour's own perimeter
# objective-marker icons are near-square and a consistent size within a
# given map -- ~2.0in on one map, ~3.1-3.4in on another, both sampled
# directly. Range covers both with margin. Aspect ratio close to 1.0 is
# checked separately (MARKER_MAX_ASPECT below) since a marker's bounding
# box being roughly square is a property of the icon itself, independent
# of its physical size.
MARKER_SIZE_MIN_IN = 1.5
MARKER_SIZE_MAX_IN = 4.0
MARKER_MAX_ASPECT = 1.15


def px_to_in(x, y, ox, oy, scale):
    return round(float(x - ox) / scale, 2), round(BOARD_H - float(y - oy) / scale, 2)


def extract_keepout_for_piece(img, corners_px, ox, oy, scale):
    xs = [c[0] for c in corners_px]
    ys = [c[1] for c in corners_px]
    x0, x1 = int(max(0, min(xs))), int(min(img.shape[1], max(xs)))
    y0, y1 = int(max(0, min(ys))), int(min(img.shape[0], max(ys)))
    if x1 <= x0 or y1 <= y0:
        return []

    region = img[y0:y1, x0:x1]
    hsv = cv2.cvtColor(region.astype(np.uint8), cv2.COLOR_RGB2HSV)
    h, s = hsv[:, :, 0].astype(int), hsv[:, :, 1].astype(int)
    # OpenCV hue is 0-179 (half of the usual 0-360 scale). Covers both
    # yellow/gold (~30-50deg) and green/teal (~150-190deg) genuine terrain
    # feature coloring -- see the module docstring for why color alone
    # can't be used to exclude objective-marker icons, and what's used
    # instead (shape + size, applied per-component below).
    feature_mask = ((s > 38) & (h >= 15) & (h <= 95)).astype(np.uint8) * 255

    poly_local = np.array([[c[0] - x0, c[1] - y0] for c in corners_px], dtype=np.int32)
    poly_mask = np.zeros(region.shape[:2], np.uint8)
    cv2.fillPoly(poly_mask, [poly_local], 255)
    feature_mask = cv2.bitwise_and(feature_mask, poly_mask)
    feature_mask = cv2.morphologyEx(feature_mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))

    n, labels, stats, _ = cv2.connectedComponentsWithStats(feature_mask)
    shapes = []
    for lbl in range(1, n):
        area = stats[lbl, cv2.CC_STAT_AREA]
        if area < MIN_COMPONENT_AREA_PX:
            continue
        component_mask = (labels == lbl).astype(np.uint8) * 255
        contours, _ = cv2.findContours(component_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
        c = max(contours, key=cv2.contourArea)

        # marker check uses the ORIENTED bounding box (cv2.minAreaRect),
        # not axis-aligned stats -- terrain cards are frequently rotated
        # on the board (checked: -54.6deg on one flagged piece), and an
        # axis-aligned box around a genuinely elongated feature drawn at
        # roughly 45deg can look falsely close to square, which would
        # wrongly trigger the marker exclusion below on real terrain
        (_, (rect_w, rect_h), _) = cv2.minAreaRect(c)
        aspect = max(rect_w, rect_h) / max(1.0, min(rect_w, rect_h))
        w_in, h_in = rect_w / scale, rect_h / scale
        if (
            aspect < MARKER_MAX_ASPECT
            and MARKER_SIZE_MIN_IN <= w_in <= MARKER_SIZE_MAX_IN
            and MARKER_SIZE_MIN_IN <= h_in <= MARKER_SIZE_MAX_IN
        ):
            continue  # near-square and marker-sized -- an objective-marker icon, not terrain
        # simplify the raw pixel-level contour (can be dozens to hundreds
        # of points even after CHAIN_APPROX_SIMPLE's own redundant-point
        # removal) down to a real polygon -- epsilon scaled to the
        # contour's own perimeter so a small feature and a large one both
        # get proportionally reasonable simplification rather than one
        # fixed pixel tolerance being too loose for small shapes or too
        # tight (and therefore pointlessly detailed) for big ones
        perimeter = cv2.arcLength(c, True)
        epsilon = max(1.0, CONTOUR_SIMPLIFY_FRACTION * perimeter)
        approx = cv2.approxPolyDP(c, epsilon, True)
        pts_local = approx.reshape(-1, 2)
        if len(pts_local) < 3:
            continue  # degenerate -- not a real polygon, skip rather than store garbage
        pts_in = [px_to_in(lx + x0, ly + y0, ox, oy, scale) for (lx, ly) in pts_local]
        shapes.append(pts_in)
    return shapes


def process_map(map_id, manifest_by_id, dry_run=False):
    terrain_path = f"scripts/output/{map_id}_terrain.json"
    if not os.path.exists(terrain_path):
        return None
    data = json.load(open(terrain_path))
    entry = manifest_by_id.get(map_id)
    if not entry:
        return None
    img = cv2.imread(f"public/map-images/{entry['filename']}")
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    ox, oy = data["px_origin"]
    scale = data["px_scale"]

    total_shapes = 0
    for t in data["terrain"]:
        # terrain corners are stored in board-inches (y-up); convert back
        # to pixel space for sampling, inverse of terrain_v4.py's px_to_in
        corners_px = []
        for cx_in, cy_in in t["corners"]:
            px = cx_in * scale + ox
            py = (BOARD_H - cy_in) * scale + oy
            corners_px.append((px, py))
        shapes = extract_keepout_for_piece(img, corners_px, ox, oy, scale)
        t["keepOutFootprints"] = shapes
        total_shapes += len(shapes)

    if not dry_run:
        json.dump(data, open(terrain_path, "w"), indent=2)
    return {"map_id": map_id, "pieces": len(data["terrain"]), "keepout_shapes": total_shapes}


if __name__ == "__main__":
    manifest = json.load(open("scripts/manifest.json"))
    manifest_by_id = {m["id"]: m for m in manifest}
    dry_run = "--dry-run" in sys.argv
    only = [a for a in sys.argv[1:] if not a.startswith("--")]

    targets = only if only else [m["id"] for m in manifest]
    total_pieces = 0
    total_shapes = 0
    for map_id in targets:
        result = process_map(map_id, manifest_by_id, dry_run=dry_run)
        if result is None:
            continue
        total_pieces += result["pieces"]
        total_shapes += result["keepout_shapes"]
        print(f"{result['map_id']}: {result['pieces']} pieces -> {result['keepout_shapes']} keep-out shapes")

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Processed {len(targets)} maps, "
          f"{total_pieces} terrain pieces, {total_shapes} total keep-out shapes extracted")
