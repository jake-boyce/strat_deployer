"""
Template-based deployment zone generator. Classifies each map into one of
6 known patterns (Dawn of War, Hammer and Anvil, Crucible of Battle,
Sweeping Engagement, Tipping Point, Search and Destroy) using robust raw-
pixel bounding-box signatures, extracts the minimal parameters needed via
outlier-robust transect sampling, and generates EXACT polygon geometry --
rather than tracing (and fighting terrain-occlusion artifacts in) the
actual boundary contour.

Board is always 44in (width) x 60in (height).
"""
import cv2, numpy as np, json, sys, math

BOARD_W, BOARD_H = 44.0, 60.0
RED = (np.array([128,0,0]), np.array([185,40,45]))
BLUE = (np.array([15,65,95]), np.array([70,120,150]))

def find_board_bounds(arr):
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    black_mask = (gray < 50).astype(np.uint8)
    contours, _ = cv2.findContours(black_mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    best, best_area = None, 0
    h, w = gray.shape
    for c in contours:
        x, y, cw, ch = cv2.boundingRect(c)
        area = cw * ch
        if area > best_area and area < (w*h*0.98):
            best_area, best = area, (x, y, cw, ch)
    return best

def calibrate(arr):
    bx, by, bw, bh = find_board_bounds(arr)
    bt = 5
    ox, oy = bx+bt, by+bt
    iw, ih = bw-2*bt, bh-2*bt
    scale = ((iw/BOARD_W) + (ih/BOARD_H)) / 2
    return ox, oy, scale

def color_mask(arr, color, ox, oy, scale):
    lo, hi = color
    m = cv2.inRange(arr, lo, hi)
    board_mask = np.zeros_like(m)
    iw, ih = int(BOARD_W*scale)+10, int(BOARD_H*scale)+10
    board_mask[max(0,oy-5):oy+ih, max(0,ox-5):ox+iw] = 255
    return cv2.bitwise_and(m, board_mask)

def large_components_mask(mask, area_thresh=800):
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
    keep = [lbl for lbl in range(1, n) if stats[lbl, cv2.CC_STAT_AREA] >= area_thresh]
    if not keep:
        return np.zeros_like(mask)
    return (np.isin(labels, keep)).astype(np.uint8) * 255

def px_to_in(px, py, ox, oy, scale):
    return (px - ox) / scale, BOARD_H - (py - oy) / scale

def in_to_px(x_in, y_in, ox, oy, scale):
    return x_in * scale + ox, oy + (BOARD_H - y_in) * scale

def bbox_in(mask, ox, oy, scale):
    ys, xs = np.where(mask > 0)
    if len(xs) == 0:
        return None
    x0, y1 = px_to_in(xs.min(), ys.min(), ox, oy, scale)
    x1, y0 = px_to_in(xs.max(), ys.max(), ox, oy, scale)
    return (x0, y0, x1, y1)  # (xmin, ymin, xmax, ymax) in inches

def robust_mode(vals, lo=None, hi=None, bucket=0.15, prefer_near=None, min_cluster=5):
    """Find the true flat-boundary value even when terrain contamination
    affects a LARGE, contiguous run of samples (enough to pull a median off,
    or even to outnumber the true reading within a given sampling window).
    A genuine flat boundary produces many samples at (near) the exact same
    y/x value, since it's the same clean pixel transition repeated column
    after column; contamination tends to be more varied/trending rather than
    forming an equally tight, equally large plateau. Bucket to a fixed grid
    (not chain-linked -- a slow drift must NOT be able to merge into one
    giant bucket just because each step is small) to absorb sub-pixel float
    noise.

    If prefer_near is given, don't just take the single most populous
    bucket -- across all clusters with at least min_cluster samples, take
    whichever is closest to prefer_near. This uses cross-map consistency
    (these mission packs reuse near-identical measurements across every map
    of a given pattern) as a prior to break ties that pure local frequency
    can't: a terrain piece can easily cover more of a given sampling window
    than the true clean boundary does, so "most samples" isn't always
    "correct" on any single map, even though it usually is in aggregate."""
    vals = [v for v in vals if v is not None]
    if lo is not None: vals = [v for v in vals if v >= lo]
    if hi is not None: vals = [v for v in vals if v <= hi]
    if not vals:
        return None
    from collections import defaultdict
    grid = defaultdict(list)
    for v in vals:
        grid[round(v / bucket)].append(v)
    if prefer_near is not None:
        candidates = [c for c in grid.values() if len(c) >= min_cluster] or list(grid.values())
        best = min(candidates, key=lambda c: abs(np.mean(c) - prefer_near))
    else:
        best = max(grid.values(), key=len)
    return float(np.mean(best))

# --- transect scanners: find the true boundary x (for vertical bands) or y
# (for horizontal bands) at many sample lines, skipping terrain-contaminated
# ones, then take a robust median.

def scan_vertical_band_edge(mask, ox, oy, scale, side, y_range):
    """side='left': find rightmost extent of a left-side band, per row.
       side='right': find leftmost extent of a right-side band, per row."""
    edges = []
    y0_px, y1_px = in_to_px(0, y_range[1], ox, oy, scale)[1], in_to_px(0, y_range[0], ox, oy, scale)[1]
    for py in range(int(y0_px), int(y1_px)):
        row = mask[py] if 0 <= py < mask.shape[0] else None
        if row is None: continue
        xs = np.where(row > 0)[0]
        if len(xs) < 3: continue
        if side == 'left':
            edge_px = xs.max()
        else:
            edge_px = xs.min()
        x_in, _ = px_to_in(edge_px, py, ox, oy, scale)
        edges.append(x_in)
    return edges

def scan_horizontal_band_edge(mask, ox, oy, scale, side, x_range):
    """side='top': find bottommost extent of a top-side band, per column (in inches, y measured from bottom so 'bottom of band'=min y).
       side='bottom': find topmost extent of a bottom-side band, per column."""
    edges = []
    x0_px = in_to_px(x_range[0], 0, ox, oy, scale)[0]
    x1_px = in_to_px(x_range[1], 0, ox, oy, scale)[0]
    for px in range(int(x0_px), int(x1_px)):
        col = mask[:, px] if 0 <= px < mask.shape[1] else None
        if col is None: continue
        ys = np.where(col > 0)[0]
        if len(ys) < 3: continue
        if side == 'top':
            edge_px = ys.max()  # bottommost pixel row = smallest y_in
        else:
            edge_px = ys.min()  # topmost pixel row = largest y_in
        _, y_in = px_to_in(px, edge_px, ox, oy, scale)
        edges.append(y_in)
    return edges

def classify_and_generate(path):
    img = cv2.imread(path)
    arr = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    ox, oy, scale = calibrate(arr)

    red_raw = color_mask(arr, RED, ox, oy, scale)
    blue_raw = color_mask(arr, BLUE, ox, oy, scale)
    red = large_components_mask(red_raw)
    blue = large_components_mask(blue_raw)

    rb = bbox_in(red, ox, oy, scale)
    bb = bbox_in(blue, ox, oy, scale)
    if rb is None or bb is None:
        return {"pattern": "UNKNOWN", "error": "empty mask"}

    rw, rh = rb[2]-rb[0], rb[3]-rb[1]
    rw_frac, rh_frac = rw/BOARD_W, rh/BOARD_H

    result = {"red_bbox": rb, "blue_bbox": bb, "ox": ox, "oy": oy, "scale": scale}

    # --- classify by bbox signature ---
    if rw_frac < 0.45 and rh_frac > 0.85:
        # vertical band family: Dawn of War (straight) or Sweeping Engagement (step)
        red_on_left = rb[0] < (BOARD_W - rb[2])
        side = 'left' if red_on_left else 'right'
        lower = scan_vertical_band_edge(red, ox, oy, scale, side, (3, 18))
        upper = scan_vertical_band_edge(red, ox, oy, scale, side, (42, 57))
        d_lower = robust_mode(lower, prefer_near=7.85)
        d_upper = robust_mode(upper, prefer_near=13.86)
        if d_lower is not None and d_upper is not None and abs(d_lower - d_upper) > 1.2:
            result["pattern"] = "sweeping_engagement"
            result["red_on_left"] = red_on_left
            result["depth_lower"] = d_lower   # y in [0,30]
            result["depth_upper"] = d_upper   # y in [30,60]
        else:
            result["pattern"] = "dawn_of_war"
            result["red_on_left"] = red_on_left
            result["depth"] = robust_mode(lower + upper, prefer_near=11.9)

    elif rh_frac < 0.45 and rw_frac > 0.85:
        # horizontal band family: Hammer and Anvil (straight) or Tipping Point (step)
        red_on_top = rb[1] > (BOARD_H - rb[3])
        side = 'top' if red_on_top else 'bottom'
        left = scan_horizontal_band_edge(red, ox, oy, scale, side, (2, 12))
        right = scan_horizontal_band_edge(red, ox, oy, scale, side, (32, 42))
        d_left = robust_mode(left, prefer_near=40.2)
        d_right = robust_mode(right, prefer_near=48.2)
        if d_left is not None and d_right is not None and abs(d_left - d_right) > 1.2:
            result["pattern"] = "tipping_point"
            result["red_on_top"] = red_on_top
            result["depth_left"] = d_left    # boundary y for x in [0,22]
            result["depth_right"] = d_right  # boundary y for x in [22,44]
        else:
            result["pattern"] = "hammer_and_anvil"
            result["red_on_top"] = red_on_top
            result["depth"] = robust_mode(left + right, prefer_near=42.1)

    elif rw_frac > 0.8 and 0.35 < rh_frac < 0.65:
        result["pattern"] = "crucible_of_battle"
        result["red_on_top"] = rb[1] > (BOARD_H - rb[3])

    elif 0.35 < rw_frac < 0.65 and 0.35 < rh_frac < 0.65:
        result["pattern"] = "search_and_destroy"
        result["red_left"] = rb[0] < (BOARD_W/2 - 2)
        result["red_top"] = rb[1] > (BOARD_H/2 - 2)

    else:
        result["pattern"] = "UNKNOWN"
        result["rw_frac"] = rw_frac
        result["rh_frac"] = rh_frac

    result["_arr"] = arr
    result["_ox"], result["_oy"], result["_scale"] = ox, oy, scale
    return result


def sample_present(mask, x_in, y_in, ox, oy, scale, radius_px=6):
    px, py = in_to_px(x_in, y_in, ox, oy, scale)
    px, py = int(px), int(py)
    h, w = mask.shape
    y0, y1 = max(0,py-radius_px), min(h,py+radius_px)
    x0, x1 = max(0,px-radius_px), min(w,px+radius_px)
    patch = mask[y0:y1, x0:x1]
    return patch.size > 0 and (patch > 0).mean() > 0.3


def crucible_orientation(mask, ox, oy, scale, red_on_top):
    """Determine which long-edge midpoint the diagonal is anchored to.
    Probe deep into each candidate triangle (not near the anchor line itself,
    where a few px of measurement noise can flip which side reads as
    'present') for a robust, unambiguous left/right read."""
    y_probe = 45 if red_on_top else 15
    left_present = sample_present(mask, 5, y_probe, ox, oy, scale)
    right_present = sample_present(mask, 39, y_probe, ox, oy, scale)
    if left_present and not right_present:
        return "left"   # anchored at (0,30)
    if right_present and not left_present:
        return "right"  # anchored at (44,30)
    # still ambiguous (shouldn't normally happen) -- try a second probe pair
    # closer to the board edges before giving up
    y_probe2 = 55 if red_on_top else 5
    left2 = sample_present(mask, 2, y_probe2, ox, oy, scale)
    right2 = sample_present(mask, 42, y_probe2, ox, oy, scale)
    if left2 and not right2:
        return "left"
    if right2 and not left2:
        return "right"
    return "left" if left_present or left2 else "right"


def circle_arc_points(cx, cy, r, theta_start, theta_end, n=24):
    pts = []
    for i in range(n+1):
        t = theta_start + (theta_end - theta_start) * i / n
        pts.append([round(cx + r*math.cos(t), 2), round(cy + r*math.sin(t), 2)])
    return pts


def generate_zone_polygons(cls):
    """Given a classify_and_generate() result, produce exact red/blue polygons."""
    pattern = cls["pattern"]
    ox, oy, scale = cls["_ox"], cls["_oy"], cls["_scale"]
    arr = cls["_arr"]
    red_raw = large_components_mask(color_mask(arr, RED, ox, oy, scale))
    blue_raw = large_components_mask(color_mask(arr, BLUE, ox, oy, scale))

    W, H = BOARD_W, BOARD_H

    if pattern == "dawn_of_war":
        red_on_left = cls["red_on_left"]
        d_red = cls["depth"]
        # blue depth from its own bbox width
        bb = cls["blue_bbox"]
        d_blue = (bb[2]-bb[0])
        if red_on_left:
            red = [[0,0],[d_red,0],[d_red,H],[0,H]]
            blue = [[W-d_blue,0],[W,0],[W,H],[W-d_blue,H]]
        else:
            red = [[W-d_red,0],[W,0],[W,H],[W-d_red,H]]
            blue = [[0,0],[d_blue,0],[d_blue,H],[0,H]]
        return {"red": red, "blue": blue}

    if pattern == "hammer_and_anvil":
        red_on_top = cls["red_on_top"]
        d_red = cls["depth"]  # boundary y-coordinate for red
        bb = cls["blue_bbox"]
        if red_on_top:
            d_blue = bb[3]  # blue spans [0, d_blue]
            red = [[0,d_red],[W,d_red],[W,H],[0,H]]
            blue = [[0,0],[W,0],[W,d_blue],[0,d_blue]]
        else:
            d_blue = bb[1]
            red = [[0,0],[W,0],[W,d_red],[0,d_red]]
            blue = [[0,d_blue],[W,d_blue],[W,H],[0,H]]
        return {"red": red, "blue": blue}

    if pattern == "sweeping_engagement":
        red_on_left = cls["red_on_left"]
        dl, du = cls["depth_lower"], cls["depth_upper"]
        # scan blue side independently (mirror side)
        side_blue = 'right' if red_on_left else 'left'
        bl = robust_mode(scan_vertical_band_edge(blue_raw, ox, oy, scale, side_blue, (3,18)), prefer_near=W-13.86)
        bu = robust_mode(scan_vertical_band_edge(blue_raw, ox, oy, scale, side_blue, (42,57)), prefer_near=W-7.85)
        if red_on_left:
            red = [[0,0],[dl,0],[dl,30],[du,30],[du,H],[0,H]]
            blue = [[W,0],[bl,0],[bl,30],[bu,30],[bu,H],[W,H]]
        else:
            red = [[W,0],[W-dl,0],[W-dl,30],[W-du,30],[W-du,H],[W,H]]
            blue = [[0,0],[W-bl,0],[W-bl,30],[W-bu,30],[W-bu,H],[0,H]]
        return {"red": red, "blue": blue}

    if pattern == "tipping_point":
        red_on_top = cls["red_on_top"]
        dl, dr = cls["depth_left"], cls["depth_right"]
        side_blue = 'bottom' if red_on_top else 'top'
        bl = robust_mode(scan_horizontal_band_edge(blue_raw, ox, oy, scale, side_blue, (2,12)), prefer_near=H-48.2)
        br = robust_mode(scan_horizontal_band_edge(blue_raw, ox, oy, scale, side_blue, (32,42)), prefer_near=H-40.2)
        if red_on_top:
            red = [[0,H],[0,dl],[22,dl],[22,dr],[W,dr],[W,H]]
            blue = [[0,0],[0,bl],[22,bl],[22,br],[W,br],[W,0]]
        else:
            red = [[0,0],[0,H-dl],[22,H-dl],[22,H-dr],[W,H-dr],[W,0]]
            blue = [[0,H],[0,H-bl],[22,H-bl],[22,H-br],[W,H-br],[W,H]]
        return {"red": red, "blue": blue}

    if pattern == "crucible_of_battle":
        red_on_top = cls["red_on_top"]
        anchor = crucible_orientation(red_raw, ox, oy, scale, red_on_top)
        cy = H/2  # 30
        if red_on_top and anchor == "left":
            red = [[0,cy],[0,H],[W,H]]
            blue = [[W,H-cy],[0,0],[W,0]]  # H-cy = 30, anchored at (44,30)
        elif red_on_top and anchor == "right":
            red = [[W,cy],[W,H],[0,H]]
            blue = [[0,H-cy],[W,0],[0,0]]
        elif (not red_on_top) and anchor == "left":
            red = [[0,cy],[0,0],[W,0]]
            blue = [[W,H-cy],[0,H],[W,H]]
        else:  # not red_on_top and anchor == right
            red = [[W,cy],[W,0],[0,0]]
            blue = [[0,H-cy],[W,H],[0,H]]
        return {"red": red, "blue": blue}

    if pattern == "search_and_destroy":
        cx, cy, r = W/2, H/2, 9.0

        def quadrant_polygon(left, top):
            """Full quadrant polygon with the center-corner replaced by a 9in arc."""
            board_corner = [0 if left else W, H if top else 0]
            edge_pt_vert = [0 if left else W, cy]          # on the long edge, at center height
            edge_pt_horiz = [cx, H if top else 0]           # on the short edge, at center x
            arc_start = [cx, cy + r if top else cy - r]     # where circle meets x=cx
            arc_end = [cx - r if left else cx + r, cy]      # where circle meets y=cy
            theta_a = math.atan2(arc_start[1]-cy, arc_start[0]-cx)
            theta_b = math.atan2(arc_end[1]-cy, arc_end[0]-cx)
            lo, hi = sorted([theta_a, theta_b])
            if hi - lo > math.pi/2 + 0.01:
                lo, hi = hi - 2*math.pi, lo
            arc = circle_arc_points(cx, cy, r, lo, hi, n=16)
            if theta_a > theta_b:
                arc = arc[::-1]  # ensure arc goes start->end
            return [edge_pt_vert, board_corner, edge_pt_horiz, arc_start] + arc[1:-1] + [arc_end]

        red_left, red_top = cls["red_left"], cls["red_top"]
        red_poly = quadrant_polygon(red_left, red_top)
        blue_poly = quadrant_polygon(not red_left, not red_top)
        return {"red": red_poly, "blue": blue_poly}

    return None

def render_qa(path, out_path):
    cls = classify_and_generate(path)
    polys = generate_zone_polygons(cls)
    ox, oy, scale = cls["_ox"], cls["_oy"], cls["_scale"]
    img = cv2.imread(path)
    overlay = img.copy()
    for owner, color in [("red", (0,255,255)), ("blue", (0,255,0))]:
        pts = []
        for x_in, y_in in polys[owner]:
            px, py = in_to_px(x_in, y_in, ox, oy, scale)
            pts.append([int(px), int(py)])
        cv2.polylines(overlay, [np.array(pts, dtype=np.int32)], True, color, 4)
    cv2.imwrite(out_path, overlay)
    print(f"pattern={cls['pattern']}  wrote {out_path}")
    return cls, polys

if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[2] == "--qa":
        render_qa(sys.argv[1], sys.argv[3])
    else:
        r = classify_and_generate(sys.argv[1])
        r.pop("_arr", None)
        print(json.dumps(r, indent=2, default=str))
