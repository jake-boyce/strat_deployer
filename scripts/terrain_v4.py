"""
Terrain FOOTPRINT extraction v5: targets the grey footprint card itself
(what the rules care about), not the decorative art/features sitting on
top of it. Floor is warm-toned tan (R notably > B, ~9-10 consistently);
the grey card is neutral-to-cool (R-B close to zero or slightly negative).
This color-temperature signal cleanly separates card-from-floor in a way
plain texture variance couldn't (both have similar-magnitude fine texture
from grid lines vs the card's "cityscape" detail).

v5 change: `corners` now traces the mask's actual contour
(cv2.approxPolyDP), not a bounding rectangle fitted to it
(cv2.minAreaRect on the convex hull, the v4 approach). This was a real,
quantified bug, not a refinement: a card's true shape (torn/ragged edges,
sometimes concave) rarely fills its own bounding rectangle, and checked
directly across several deployment-zone-adjacent pieces, the fitted
rectangle was regularly 2-3x the card mask's real area (up to 290% on one
piece) -- the "extra" area silently extending into whatever was next to
the card, which for zone-adjacent pieces is strongly-colored deployment
zone floor. The color mask itself was already accurate; the bounding-box
simplification step was throwing that accuracy away. `width_in`,
`height_in`, and `angle_deg` are kept as before (still derived from
cv2.minAreaRect on the same contour) purely as approximate size/rotation
metadata for display and rough filtering -- they no longer describe
`corners`'s own bounding box exactly, since corners is now the traced
shape, not a rectangle.
"""
import cv2, numpy as np, json, sys

BOARD_W, BOARD_H = 44.0, 60.0
CONTOUR_SIMPLIFY_FRACTION = 0.01  # epsilon as a fraction of the contour's own perimeter -- checked directly against the mask's true area (see module docstring): ~99% of it at this value, a good balance against also not needing dozens of vertices

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

def px_to_in(x, y, ox, oy, scale):
    return (x - ox) / scale, BOARD_H - (y - oy) / scale

def extract_terrain(path):
    img = cv2.imread(path)
    arr = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(int)
    h, w, _ = arr.shape

    bx, by, bw, bh = find_board_bounds(arr.astype(np.uint8))
    bt = 5
    ox, oy = bx+bt, by+bt
    iw, ih = bw-2*bt, bh-2*bt
    scale = ((iw/BOARD_W) + (ih/BOARD_H)) / 2

    board_mask = np.zeros((h,w), np.uint8)
    board_mask[oy:oy+ih, ox:ox+iw] = 255

    r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    rb_diff = r.astype(int) - b.astype(int)
    brightness = (r.astype(int) + g.astype(int) + b.astype(int)) / 3

    # grey card: neutral-to-cool (rb_diff < 5), mid-to-high brightness
    # (excludes near-black outlines/grid and very dark decorative shadow),
    # not too bright (excludes white margin)
    card_mask = ((rb_diff < 5) & (brightness > 90) & (brightness < 240)).astype(np.uint8) * 255
    card_mask = cv2.bitwise_and(card_mask, board_mask)

    # also exclude zone colors explicitly (red has rb_diff very positive so
    # already excluded; blue has rb_diff very negative -- make sure it's not
    # accidentally included as "cool grey")
    blue_m = cv2.inRange(arr.astype(np.uint8), np.array([15,65,95]), np.array([70,120,150]))
    card_mask = cv2.bitwise_and(card_mask, cv2.bitwise_not(blue_m))

    # close small gaps where decorative green/gold art interrupts the grey
    # footprint mask locally, open lightly to drop thin dotted-line/grid
    # artifacts. Deliberately NOT OR-ing green/gold pixels directly into the
    # mask (tried that first) -- it also pulls in green/gold game elements
    # that have nothing to do with terrain (objective diamond markers,
    # faction badge circles), inflating "dense" classification everywhere.
    # Close kernel reduced from 11x11 after a manual correction pass on
    # tah_pa_a found several genuinely separate, closely-touching pieces
    # merged into one -- 5x5 recovers most of those while only adding a
    # small number of tiny (<2.5in) fragments on other maps, which are easy
    # to spot and delete in the editor if bogus.
    card_mask = cv2.morphologyEx(card_mask, cv2.MORPH_CLOSE, np.ones((5,5), np.uint8))
    card_mask = cv2.morphologyEx(card_mask, cv2.MORPH_OPEN, np.ones((5,5), np.uint8))

    n, labels, stats, centroids = cv2.connectedComponentsWithStats(card_mask)

    # Real terrain features (a yellow strut, a green pipe) interrupt the
    # grey color-temperature mask, since those pixels fail its own "grey"
    # test -- often enough to fragment one card's mask into a main body
    # plus several small disconnected pieces near it, each individually
    # too small to pass MIN_PIECE_AREA_PX below. Checked directly (see
    # v0.41 in Status) that just increasing the close kernel to bridge
    # these fixes the fragmentation but reintroduces a documented,
    # different problem instead -- a kernel wide enough to bridge a
    # feature gap is also wide enough to merge two genuinely separate,
    # closely-touching cards into one (the reason 5x5 was chosen over
    # 11x11 in the first place). This does the merge surgically instead:
    # each real piece's own mask is dilated a modest, fixed amount and
    # any OTHER, sub-threshold-sized component that falls within that
    # dilation gets absorbed into it specifically -- recovers a feature's
    # gap in its own card without room to reach all the way to a
    # different, separate card.
    MIN_PIECE_AREA_PX = 400
    FRAGMENT_ABSORB_DIST_PX = 10
    real_labels = [lbl for lbl in range(1, n) if stats[lbl, cv2.CC_STAT_AREA] >= MIN_PIECE_AREA_PX]
    fragment_labels = [lbl for lbl in range(1, n) if 15 <= stats[lbl, cv2.CC_STAT_AREA] < MIN_PIECE_AREA_PX]
    dilate_kernel = np.ones((FRAGMENT_ABSORB_DIST_PX, FRAGMENT_ABSORB_DIST_PX), np.uint8)

    pieces = []
    for lbl in real_labels:
        area = stats[lbl, cv2.CC_STAT_AREA]
        blob = (labels == lbl).astype(np.uint8) * 255
        dilated = cv2.dilate(blob, dilate_kernel)
        for frag_lbl in fragment_labels:
            fx, fy = centroids[frag_lbl]
            if dilated[int(fy), int(fx)] > 0:
                blob = cv2.bitwise_or(blob, (labels == frag_lbl).astype(np.uint8) * 255)
        contours, _ = cv2.findContours(blob, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
        c = max(contours, key=cv2.contourArea)
        # width_in/height_in/angle_deg are still derived from the fitted
        # rectangle (kept as approximate size/rotation metadata, and for
        # the size filters right below, unchanged from v4) -- but
        # `corners` now traces the mask's real shape instead of using
        # this rectangle directly, see module docstring
        rect = cv2.minAreaRect(c)
        (cx, cy), (rw, rh), angle = rect
        if rw < 6 or rh < 6:
            continue
        if max(rw, rh) / scale > 20:
            continue

        # traced from the mask's own contour (now including any absorbed
        # nearby fragments), simplified directly
        perimeter = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, CONTOUR_SIMPLIFY_FRACTION * perimeter, True)
        traced_pts = approx.reshape(-1, 2)
        if len(traced_pts) < 3:
            continue  # degenerate -- not a real polygon, skip rather than store garbage

        cx_in, cy_in = px_to_in(cx, cy, ox, oy, scale)
        corners_in = [px_to_in(float(px), float(py), ox, oy, scale) for px, py in traced_pts]
        pieces.append({
            "id": f"terrain_{len(pieces)+1}",
            "corners": [[round(float(x),2),round(float(y),2)] for x,y in corners_in],
            "center": [round(float(cx_in),2), round(float(cy_in),2)],
            "width_in": round(float(rw)/scale, 2),
            "height_in": round(float(rh)/scale, 2),
            "angle_deg": round(float(angle), 1),
        })

    pieces.sort(key=lambda p: -p["width_in"]*p["height_in"])
    return {"board_w_in": BOARD_W, "board_h_in": BOARD_H, "px_origin":[ox,oy], "px_scale":scale, "terrain": pieces}

if __name__ == "__main__":
    result = extract_terrain(sys.argv[1])
    print(f"Found {len(result['terrain'])} pieces")
    for p in result['terrain']:
        print(f"  {p['width_in']:5.1f} x {p['height_in']:5.1f} @ {p['angle_deg']:6.1f}deg")
    if len(sys.argv) > 2:
        json.dump(result, open(sys.argv[2], 'w'), indent=2)
