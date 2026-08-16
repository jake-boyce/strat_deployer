"""
Remove a (near-)white photo background from a miniature product shot,
producing a transparent PNG for use as token art. Flood-fills from the
image border through "close to white" pixels, so only the background
region actually connected to the edges gets removed -- pale parts of the
miniature itself (which aren't touching the border) are left alone even
if their color is fairly close to white.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from collections import deque

def remove_background(in_path, out_path, white_thresh=32, feather_px=1.5):
    img = Image.open(in_path).convert("RGB")
    arr = np.array(img).astype(np.float32)
    h, w, _ = arr.shape

    # "close to white" candidate mask
    dist_from_white = np.sqrt(((arr - 255) ** 2).sum(axis=2))
    candidate = dist_from_white < white_thresh

    # flood fill from the border through the candidate mask (BFS), so we
    # only remove background actually connected to an edge
    visited = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if candidate[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if candidate[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))

    while q:
        y, x = q.popleft()
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny, nx = y+dy, x+dx
            if 0 <= ny < h and 0 <= nx < w and candidate[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    bg_mask = visited  # True = background, connected to border
    alpha = np.where(bg_mask, 0, 255).astype(np.uint8)

    rgba = np.dstack([np.array(img), alpha])
    out = Image.fromarray(rgba, mode="RGBA")

    # feather the cutout edge slightly so it doesn't look like a hard
    # cutout -- blur just the alpha channel a touch
    if feather_px > 0:
        r, g, b, a = out.split()
        a = a.filter(ImageFilter.GaussianBlur(feather_px))
        out = Image.merge("RGBA", (r, g, b, a))

    out.save(out_path)
    print(f"saved {out_path}, background pixels removed: {bg_mask.sum()} / {h*w} ({bg_mask.mean()*100:.1f}%)")

if __name__ == "__main__":
    remove_background(sys.argv[1], sys.argv[2])
