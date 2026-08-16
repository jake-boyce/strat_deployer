import json, os, sys
sys.path.insert(0, 'scripts')
from template_zones import classify_and_generate, generate_zone_polygons

UPLOAD_DIR = "/mnt/user-data/uploads"
MANIFEST = "scripts/manifest.json"
OUT_DIR = "scripts/output"

def main():
    manifest = json.load(open(MANIFEST))
    results = []
    for entry in manifest:
        map_id, filename = entry["id"], entry["filename"]
        path = os.path.join(UPLOAD_DIR, filename)
        try:
            cls = classify_and_generate(path)
            pattern = cls["pattern"]
            if pattern == "UNKNOWN":
                results.append((map_id, "UNKNOWN", cls.get("rw_frac"), cls.get("rh_frac")))
                continue
            polys = generate_zone_polygons(cls)
            out = {
                "board_w_in": 44.0, "board_h_in": 60.0,
                "px_origin": [cls["_ox"], cls["_oy"]], "px_scale": cls["_scale"],
                "pattern": pattern,
                "zones": [
                    {"owner": "red", "polygon_in": [[round(x,2),round(y,2)] for x,y in polys["red"]],
                     "vertex_count": len(polys["red"])},
                    {"owner": "blue", "polygon_in": [[round(x,2),round(y,2)] for x,y in polys["blue"]],
                     "vertex_count": len(polys["blue"])},
                ],
            }
            with open(os.path.join(OUT_DIR, f"{map_id}_zones.json"), "w") as f:
                json.dump(out, f, indent=2)
            results.append((map_id, pattern, None, None))
        except Exception as e:
            results.append((map_id, f"ERROR: {e}", None, None))

    ok = sum(1 for r in results if not r[1].startswith(("UNKNOWN","ERROR")))
    print(f"{ok}/{len(results)} classified successfully\n")
    for map_id, pattern, a, b in results:
        extra = f"  rw={a} rh={b}" if a is not None else ""
        print(f"{map_id:20s} {pattern}{extra}")

if __name__ == "__main__":
    main()
