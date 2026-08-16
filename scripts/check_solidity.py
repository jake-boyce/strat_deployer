"""
Numeric QA check for traced deployment zones: computes solidity
(polygon_area / convex_hull_area) as a jaggedness proxy. 1.0 = fully convex.
Low solidity flags zones worth a visual glance -- though note some designs
are legitimately concave (a stepped or notched zone boundary), so a low
score isn't automatically a bug. Requires shapely (`pip install shapely`).
"""
import json
import glob
import os
from shapely.geometry import Polygon

SOLIDITY_THRESHOLD = 0.93

def main():
    results = []
    for f in sorted(glob.glob("scripts/output/*_zones.json")):
        map_id = os.path.basename(f).replace("_zones.json", "")
        data = json.load(open(f))
        for z in data["zones"]:
            pts = z["polygon_in"]
            if len(pts) < 3:
                results.append((map_id, z["owner"], 0.0, len(pts)))
                continue
            poly = Polygon(pts)
            if not poly.is_valid:
                poly = poly.buffer(0)
            hull = poly.convex_hull
            solidity = poly.area / hull.area if hull.area > 0 else 0.0
            results.append((map_id, z["owner"], round(solidity, 3), len(pts)))

    results.sort(key=lambda r: r[2])
    for map_id, owner, solidity, vcount in results:
        flag = " <<<< worth a glance" if solidity < SOLIDITY_THRESHOLD else ""
        print(f"{map_id:16s} {owner:5s} solidity={solidity:.3f} vertices={vcount:3d}{flag}")

if __name__ == "__main__":
    main()
