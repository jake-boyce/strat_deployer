import cv2, numpy as np, json, os
from PIL import Image, ImageDraw

UPLOAD_DIR = "/mnt/user-data/uploads"
OUT_DIR = "scripts/output"
MANIFEST = "scripts/manifest.json"

def main():
    manifest = json.load(open(MANIFEST))
    for entry in manifest:
        map_id, filename = entry["id"], entry["filename"]
        tpath = os.path.join(OUT_DIR, f"{map_id}_terrain.json")
        if not os.path.exists(tpath):
            continue
        img = cv2.imread(os.path.join(UPLOAD_DIR, filename))
        data = json.load(open(tpath))
        ox, oy = data['px_origin']; scale = data['px_scale']; board_h = data['board_h_in']
        overlay = img.copy()
        for piece in data['terrain']:
            pts = []
            for x_in, y_in in piece['corners']:
                px = int(x_in*scale+ox); py = int(oy+(board_h-y_in)*scale)
                pts.append([px,py])
            cv2.polylines(overlay, [np.array(pts,dtype=np.int32)], True, (0,255,0), 3)
        cv2.imwrite(os.path.join(OUT_DIR, f"{map_id}_terrain_qa.png"), overlay)
    print("done")

if __name__ == "__main__":
    main()
