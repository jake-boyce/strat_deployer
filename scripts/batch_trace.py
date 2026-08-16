"""
Batch-run terrain footprint extraction across all source maps in
manifest.json, using terrain_v4.py (color-temperature + color based -- see
README "Terrain footprints").

NOTE: this used to also run the old pixel-contour zone tracer (trace_map.py)
and write scripts/output/<id>_zones.json from it. That zone-tracing approach
is superseded by scripts/batch_template.py (exact geometric templates -- see
README "How the map data was produced"). Do NOT reintroduce a call to
trace_map.py here: it would silently overwrite the correct template-
generated <id>_zones.json with the old, less-accurate traced data on any
future re-run of this script. Kept as a thin wrapper around
scripts/batch_terrain_v4.py for backwards-compatible naming; prefer calling
that directly.
"""
import subprocess, json, os

UPLOAD_DIR = "/mnt/user-data/uploads"
OUT_DIR = "scripts/output"
MANIFEST = "scripts/manifest.json"

def main():
    subprocess.run(["python3", "scripts/batch_terrain_v4.py"])

if __name__ == "__main__":
    main()
