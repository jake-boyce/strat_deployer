"""
Classifies each already-extracted terrain footprint (from terrain_v4.py's
output) as "heavy" or "light" terrain, and drops pieces that turn out to
be false positives from the extraction rather than real terrain.

Approach: sample the actual source-image pixels inside each footprint
polygon and look at two things.

1. FALSE POSITIVE FILTER: a handful of small, highly-saturated red/blue
   blobs turned out to be the deployment-zone "no-go" marker icons near
   the zone boundary lines, not terrain -- their mean color sits within a
   few RGB units of the app's own red (158,7,14) / blue (41,90,123) zone
   colors, and they're small (checked: <8 sq in in every real instance
   found). Confirmed empirically across the first 15 maps: 10 pieces
   matched this pattern before being dropped. These are removed from the
   terrain list entirely, not classified.

2. LIGHT/HEAVY CLASSIFICATION: mean saturation of the sampled pixels.
   Checked the saturation distribution across all ~630 real terrain
   pieces in the existing dataset -- it isn't cleanly bimodal (no sharp
   gap to split on), but there's a distinct tight cluster of near-zero
   saturation (grey/stone-colored, ~26% of pieces sit under S=0.05) before
   a long, gradually-increasing tail of more colored pieces. Used S=0.12
   as the cutoff (roughly the point where that initial cluster's tail
   tapers off): grey/low-saturation reads as solid stone/concrete
   structure (heavy -- walls, ruins), more saturated colors read as
   everything else (light -- rubble, pipework, other terrain features).

This is a heuristic, not a verified per-piece classification -- same
caveat as the rest of this terrain pipeline (see terrain_v4.py and the
terrain-editor.html correction tool). Treat it as a reasonable starting
point, not authoritative.
"""
import json
import sys
import colorsys
from pathlib import Path as FilePath

import numpy as np
from PIL import Image
from matplotlib.path import Path

SATURATION_THRESHOLD = 0.12
MARKER_COLORS = [np.array([158, 7, 14]), np.array([41, 90, 123])]
MARKER_DIST_THRESHOLD = 20
MARKER_MAX_AREA = 8.0


def sample_polygon_colors(img_arr, corners_px, stride=3):
    xs = [c[0] for c in corners_px]
    ys = [c[1] for c in corners_px]
    x0, x1 = int(max(0, min(xs))), int(min(img_arr.shape[1], max(xs)))
    y0, y1 = int(max(0, min(ys))), int(min(img_arr.shape[0], max(ys)))
    path = Path(corners_px)
    pts = []
    for y in range(y0, y1, stride):
        for x in range(x0, x1, stride):
            if path.contains_point((x, y)):
                pts.append(img_arr[y, x])
    return np.array(pts) if pts else np.zeros((0, 3))


def classify_map(map_id, manifest_by_id, dry_run=False):
    terrain_path = FilePath(f"scripts/output/{map_id}_terrain.json")
    if not terrain_path.exists():
        return None
    data = json.loads(terrain_path.read_text())
    entry = manifest_by_id.get(map_id)
    if not entry:
        return None
    img = np.array(Image.open(f"public/map-images/{entry['filename']}").convert("RGB"))

    kept = []
    dropped = []
    for t in data["terrain"]:
        corners_px = [
            (c[0] * data["px_scale"] + data["px_origin"][0], c[1] * data["px_scale"] + data["px_origin"][1])
            for c in t["corners"]
        ]
        colors = sample_polygon_colors(img, corners_px)
        area = t["width_in"] * t["height_in"]
        if len(colors) == 0:
            t["terrainType"] = "heavy"  # no samples -- keep, default conservative
            kept.append(t)
            continue
        mean_rgb = colors.mean(axis=0)

        is_marker = area < MARKER_MAX_AREA and any(
            np.linalg.norm(mean_rgb - m) < MARKER_DIST_THRESHOLD for m in MARKER_COLORS
        )
        if is_marker:
            dropped.append(t["id"])
            continue

        r, g, b = mean_rgb / 255
        _, s, _ = colorsys.rgb_to_hsv(r, g, b)
        t["terrainType"] = "heavy" if s < SATURATION_THRESHOLD else "light"
        kept.append(t)

    data["terrain"] = kept
    if not dry_run:
        terrain_path.write_text(json.dumps(data, indent=2))
    return {"map_id": map_id, "kept": len(kept), "dropped": dropped}


if __name__ == "__main__":
    manifest = json.loads(FilePath("scripts/manifest.json").read_text())
    manifest_by_id = {m["id"]: m for m in manifest}
    dry_run = "--dry-run" in sys.argv

    total_kept = 0
    total_dropped = 0
    heavy_count = 0
    light_count = 0
    for entry in manifest:
        result = classify_map(entry["id"], manifest_by_id, dry_run=dry_run)
        if result is None:
            continue
        total_kept += result["kept"]
        total_dropped += len(result["dropped"])
        if result["dropped"]:
            print(f"{entry['id']}: dropped {result['dropped']} as marker-icon false positives")

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Processed {len(manifest)} maps, "
          f"{total_kept} terrain pieces kept, {total_dropped} dropped as false positives")
