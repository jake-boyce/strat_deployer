import json, os, sys
sys.path.insert(0, 'scripts')
from terrain_v4 import extract_terrain

UPLOAD_DIR = "/mnt/user-data/uploads"
OUT_DIR = "scripts/output"
MANIFEST = "scripts/manifest.json"

def main():
    manifest = json.load(open(MANIFEST))
    total = 0
    for entry in manifest:
        map_id, filename = entry["id"], entry["filename"]
        if map_id == "tah_pa_a":
            print(f"{map_id:18s} SKIPPED (manually corrected, preserving ground truth)")
            continue
        path = os.path.join(UPLOAD_DIR, filename)
        try:
            result = extract_terrain(path)
            with open(os.path.join(OUT_DIR, f"{map_id}_terrain.json"), "w") as f:
                json.dump(result, f, indent=2)
            n = len(result["terrain"])
            total += n
            print(f"{map_id:18s} {n} pieces")
        except Exception as e:
            print(f"{map_id:18s} ERROR: {e}")
    print(f"\ntotal pieces (excluding tah_pa_a): {total}")

if __name__ == "__main__":
    main()
