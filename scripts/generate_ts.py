import json, os
from PIL import Image

UPLOAD_DIR = "/mnt/user-data/uploads"
OUT_DIR = "scripts/output"
TS_DIR = "src/data/maps"
MANIFEST = "scripts/manifest.json"

PATTERN_DISPLAY = {
    "dawn_of_war": "Dawn of War",
    "hammer_and_anvil": "Hammer and Anvil",
    "crucible_of_battle": "Crucible of Battle",
    "sweeping_engagement": "Sweeping Engagement",
    "tipping_point": "Tipping Point",
    "search_and_destroy": "Search and Destroy",
}

def fmt_point(p): return f"[{p[0]}, {p[1]}]"

def fmt_zone(z):
    pts = ",\n        ".join(fmt_point(p) for p in z['polygon_in'])
    label = "Attacker" if z['owner']=='red' else "Defender"
    return f"""  {{
    owner: "{z['owner']}",
    label: "{label}",
    polygon: [
        {pts}
    ],
  }}"""

def fmt_terrain(t):
    corners = ",\n      ".join(fmt_point(c) for c in t['corners'])
    terrain_type_field = f'\n    terrainType: "{t["terrainType"]}",' if t.get("terrainType") else ""
    keepout = t.get("keepOutFootprints") or []
    if keepout:
        shapes_ts = ",\n      ".join(
            "[\n        " + ",\n        ".join(fmt_point(p) for p in shape) + "\n      ]"
            for shape in keepout
        )
        keepout_field = f"\n    keepOutFootprints: [\n      {shapes_ts}\n    ],"
    else:
        keepout_field = ""
    return f"""  {{
    id: "{t['id']}",
    corners: [
      {corners}
    ],
    center: {fmt_point(t['center'])},
    width_in: {t['width_in']},
    height_in: {t['height_in']},
    angle_deg: {t['angle_deg']},{terrain_type_field}{keepout_field}
  }}"""

def main():
    manifest = json.load(open(MANIFEST))
    index_imports = []
    index_names = []

    for entry in manifest:
        map_id, filename = entry["id"], entry["filename"]
        display_name, pack, var_name = entry["display_name"], entry["pack"], entry["var_name"]
        zones_path = os.path.join(OUT_DIR, f"{map_id}_zones.json")
        terrain_path = os.path.join(OUT_DIR, f"{map_id}_terrain.json")
        if not os.path.exists(zones_path):
            print("SKIP (no data):", map_id)
            continue
        zones = json.load(open(zones_path))
        terrain = json.load(open(terrain_path))

        zones_ts = ",\n".join(fmt_zone(z) for z in zones['zones'])
        terrain_ts = ",\n".join(fmt_terrain(t) for t in terrain['terrain']) if terrain['terrain'] else ""

        img_path = os.path.join(UPLOAD_DIR, filename)
        with Image.open(img_path) as im:
            img_w, img_h = im.size
        ox, oy = zones['px_origin']
        px_scale = zones['px_scale']
        calibration_ts = f"""{{
    src: "/map-images/{filename}",
    imageWidthPx: {img_w},
    imageHeightPx: {img_h},
    pxOrigin: [{ox}, {oy}],
    pxScale: {px_scale},
  }}"""

        ts = f"""import type {{ MissionMap, Point }} from "./schema";

// {display_name} ({pack})
// Zones: generated from an exact geometric template, not traced. Every map
//   uses one of 6 known deployment patterns (Dawn of War, Hammer and Anvil,
//   Crucible of Battle, Sweeping Engagement, Tipping Point, Search and
//   Destroy); scripts/template_zones.py classifies which pattern a map uses
//   from its zone-color pixel bounding box (robust to terrain occlusion,
//   unlike contour tracing), extracts the 0-2 free parameters each pattern
//   needs (e.g. a band depth, a step position) via outlier-robust transect
//   sampling, and outputs the exact polygon for that pattern -- so the
//   result is precise by construction rather than an approximation.
//   Pattern for this map: {zones.get('pattern','unknown')}. Spot-check against
//   scripts/output/{map_id}_template_qa.png before fully trusting.
// Terrain: DRAFT. scripts/terrain_v4.py segments footprints using a
//   color-temperature signal (the grey card is neutral/cool-toned; the
//   floor is consistently warm tan) that targets the actual gameplay
//   footprint rather than the decorative art sitting on top of it (an
//   earlier version targeted the art itself -- caught and fixed after a
//   human visual check). Category (dense/light) classification is a known
//   weak point -- correct via tools/terrain-editor.html before trusting
//   for gameplay (see README "Terrain footprints").
// imageCalibration: lets the app render the actual source art as a
//   background with this data as an aligned overlay -- see MapView.tsx.

export const {var_name}: MissionMap = {{
  id: "{map_id}",
  name: "{display_name}",
  missionPack: "{pack}",
  deploymentType: "{PATTERN_DISPLAY.get(zones.get('pattern'), 'unknown')}",
  board: {{ width_in: {zones['board_w_in']}, height_in: {zones['board_h_in']} }},
  zones: [
{zones_ts}
  ],
  terrain: [
{terrain_ts}
  ],
  objectives: [
    // TODO: objective marker positions not yet extracted -- place manually
  ],
  sourceImage: "{filename}",
  imageCalibration: {calibration_ts},
}};
"""
        with open(os.path.join(TS_DIR, f"{map_id}.ts"), "w") as f:
            f.write(ts)
        index_imports.append(f'import {{ {var_name} }} from "./{map_id}";')
        index_names.append(var_name)
        print("wrote", map_id)

    # regenerate index.ts fully from the manifest
    index_ts = "import type { MissionMap } from \"./schema\";\n\n"
    index_ts += "\n".join(index_imports) + "\n\n"
    index_ts += "export * from \"./schema\";\n\n"
    index_ts += "export const allMaps: MissionMap[] = [\n"
    index_ts += "".join(f"  {n},\n" for n in index_names)
    index_ts += "];\n\n"
    index_ts += "export const getMapById = (id: string): MissionMap | undefined =>\n"
    index_ts += "  allMaps.find((m) => m.id === id);\n\n"
    index_ts += "// Every map belonging to a given mission pack (see src/data/dispositions.ts\n"
    index_ts += "// for how a pair of player-chosen dispositions resolves to a prefix),\n"
    index_ts += "// sorted by layout letter (A/B/C) since insertion order in allMaps isn't guaranteed.\n"
    index_ts += "export const getMapsForPackPrefix = (prefix: string): MissionMap[] =>\n"
    index_ts += "  allMaps\n"
    index_ts += "    .filter((m) => m.id.startsWith(`${prefix}_`))\n"
    index_ts += "    .sort((a, b) => a.id.localeCompare(b.id));\n"
    with open(os.path.join(TS_DIR, "index.ts"), "w") as f:
        f.write(index_ts)
    print(f"wrote index.ts with {len(index_names)} maps")

if __name__ == "__main__":
    main()
