import cv2, numpy as np, json, os
from PIL import Image, ImageDraw

UPLOAD_DIR = "/mnt/user-data/uploads"
OUT_DIR = "scripts/output"
MANIFEST = "scripts/manifest.json"

def main():
    manifest = json.load(open(MANIFEST))
    thumbs = []
    for entry in manifest:
        map_id, filename = entry["id"], entry["filename"]
        zones_path = os.path.join(OUT_DIR, f"{map_id}_zones.json")
        if not os.path.exists(zones_path):
            continue
        img = cv2.imread(os.path.join(UPLOAD_DIR, filename))
        data = json.load(open(zones_path))
        ox, oy = data['px_origin']; scale = data['px_scale']; board_h = data['board_h_in']
        overlay = img.copy()
        for zone in data['zones']:
            color = (0,255,255) if zone['owner']=='red' else (0,255,0)
            pts=[]
            for x_in,y_in in zone['polygon_in']:
                px=int(x_in*scale+ox); py=int(oy+(board_h-y_in)*scale)
                pts.append([px,py])
            cv2.polylines(overlay,[np.array(pts,dtype=np.int32)],True,color,4)
        cv2.putText(overlay, data['pattern'], (10,30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,255), 2)
        out_path = os.path.join(OUT_DIR, f"{map_id}_template_qa.png")
        cv2.imwrite(out_path, overlay)
        thumbs.append((map_id, overlay))

    cols = 6
    cell_w, cell_h = 200, 280
    rows = (len(thumbs)+cols-1)//cols
    sheet = Image.new('RGB', (cols*cell_w, rows*cell_h), 'white')
    for i, (map_id, overlay) in enumerate(thumbs):
        im = Image.fromarray(cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB)).convert('RGB')
        im.thumbnail((cell_w-6, cell_h-22), Image.LANCZOS)
        x = (i % cols) * cell_w
        y = (i // cols) * cell_h
        sheet.paste(im, (x+3, y+18))
        d = ImageDraw.Draw(sheet)
        d.text((x+3, y+2), map_id, fill='black')
    sheet.save(os.path.join(OUT_DIR, "template_contact_sheet.png"))
    print("done,", len(thumbs), "maps")

if __name__ == "__main__":
    main()
