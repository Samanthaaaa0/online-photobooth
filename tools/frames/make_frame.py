#!/usr/bin/env python3
"""
make_frame.py: makes photo-strip frames (and designer templates) with the photo windows in
exactly the right place.

    # a pink frame with white hearts for the 4-photo strip
    python tools/frames/make_frame.py --layout 4 --name pink-hearts --pattern hearts --bg "#ffc9e3" --fg "#ffffff"

    # the same look for the 6-photo strip
    python tools/frames/make_frame.py --layout 6 --name pink-hearts --pattern hearts --bg "#ffc9e3" --fg "#ffffff"

    # blank templates to design on top of in Figma / Canva / Photoshop / Procreate
    python tools/frames/make_frame.py --template

The PNG lands in src/assets/4cuts/ or src/assets/6cuts/ and shows up in the Editor by itself
(the file name becomes the frame's name).   Needs: Python 3, numpy, Pillow

patterns: solid dots stripes checker grid gingham hearts stars
"""
import argparse, math, pathlib
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]

# --------------------------------------------------------------------------------------
# THE GEOMETRY (CSS pixels, 1x). Must match .print-four / .print-six + the grids in Editor.css
# --------------------------------------------------------------------------------------
LAYOUTS = {
    "4": dict(folder="4cuts", w=280, h=650,
              windows=[(14, 32 + i * 140.25, 252, 135.25) for i in range(4)]),
    "6": dict(folder="6cuts", w=420, h=598,
              windows=[(x, y, 193, 164) for y in (32, 202, 372) for x in (14, 213)]),
}

def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

# --------------------------------------------------------------------------------------
# patterns: each returns an RGB uint8 array (H, W, 3); `size` is the pattern cell in output px
# --------------------------------------------------------------------------------------
def _grid(h, w):
    return np.mgrid[0:h, 0:w]

def p_solid(h, w, bg, fg, size):
    return np.full((h, w, 3), bg, np.uint8)

def p_stripes(h, w, bg, fg, size):
    y, x = _grid(h, w); on = ((x + y) // max(1, int(size))) % 2 == 0
    return np.where(on[..., None], fg, bg).astype(np.uint8)

def p_checker(h, w, bg, fg, size):
    y, x = _grid(h, w); on = ((x // int(size)) + (y // int(size))) % 2 == 0
    return np.where(on[..., None], fg, bg).astype(np.uint8)

def p_grid(h, w, bg, fg, size):
    y, x = _grid(h, w); s = int(size); t = max(1, int(s * 0.07))
    on = (x % s < t) | (y % s < t)
    return np.where(on[..., None], fg, bg).astype(np.uint8)

def p_gingham(h, w, bg, fg, size):
    y, x = _grid(h, w); s = int(size)
    v = ((x // s) % 2 == 0).astype(float); hh = ((y // s) % 2 == 0).astype(float)
    a = 1 - (1 - 0.5 * v) * (1 - 0.5 * hh)
    out = np.array(bg, float)[None, None] * (1 - a[..., None]) + np.array(fg, float)[None, None] * a[..., None]
    return out.astype(np.uint8)

def _stamp(h, w, bg, fg, size, shape):
    """staggered lattice of small shapes drawn with Pillow (supersampled for smooth edges)"""
    ss = 3
    img = Image.new("RGB", (w * ss, h * ss), tuple(bg)); d = ImageDraw.Draw(img)
    step = size * ss; row = 0; y = step / 2
    while y < h * ss + step:
        x = step / 2 + (step / 2 if row % 2 else 0) - step
        while x < w * ss + step:
            shape(d, x, y, step * 0.30, tuple(fg)); x += step
        y += step * 0.62; row += 1
    return np.array(img.resize((w, h), Image.LANCZOS))

def _heart(d, cx, cy, r, fill):
    pts = []
    for t in np.linspace(0, 2 * math.pi, 60):
        x = 16 * math.sin(t) ** 3
        y = -(13 * math.cos(t) - 5 * math.cos(2*t) - 2 * math.cos(3*t) - math.cos(4*t))
        pts.append((cx + x * r / 16, cy + y * r / 16))
    d.polygon(pts, fill=fill)

def _star(d, cx, cy, r, fill):
    pts = []
    for i in range(10):
        rad = r if i % 2 == 0 else r * 0.42; a = math.pi / 5 * i - math.pi / 2
        pts.append((cx + math.cos(a) * rad, cy + math.sin(a) * rad))
    d.polygon(pts, fill=fill)

def _dot(d, cx, cy, r, fill):
    d.ellipse([cx - r * .75, cy - r * .75, cx + r * .75, cy + r * .75], fill=fill)

def p_hearts(h, w, bg, fg, size): return _stamp(h, w, bg, fg, size, _heart)
def p_stars(h, w, bg, fg, size):  return _stamp(h, w, bg, fg, size, _star)
def p_dots(h, w, bg, fg, size):   return _stamp(h, w, bg, fg, size, _dot)

PATTERNS = dict(solid=p_solid, dots=p_dots, stripes=p_stripes, checker=p_checker, grid=p_grid,
                gingham=p_gingham, hearts=p_hearts, stars=p_stars)

# --------------------------------------------------------------------------------------
def windows_px(layout, scale):
    return [(round(x * scale), round(y * scale), round(w * scale), round(h * scale))
            for x, y, w, h in LAYOUTS[layout]["windows"]]

def make_frame(layout, pattern, bg, fg, size, scale, border=0, border_color="#ffffff"):
    L = LAYOUTS[layout]; W, H = L["w"] * scale, L["h"] * scale
    rgb = PATTERNS[pattern](H, W, hex_rgb(bg), hex_rgb(fg), size * scale)
    img = Image.fromarray(rgb, "RGB").convert("RGBA")
    wins = windows_px(layout, scale)
    if border > 0:                                   # a coloured rim around every photo
        d = ImageDraw.Draw(img); b = round(border * scale)
        for x, y, w, h in wins:
            d.rectangle([x - b, y - b, x + w + b - 1, y + h + b - 1], fill=hex_rgb(border_color) + (255,))
    a = np.array(img)
    for x, y, w, h in wins:
        a[y:y + h, x:x + w, 3] = 0                   # the photo windows are TRANSPARENT
    return Image.fromarray(a, "RGBA")

def make_template(layout, scale=3):
    """guide picture for designers: windows in magenta with their pixel coordinates"""
    L = LAYOUTS[layout]; W, H = L["w"] * scale, L["h"] * scale
    img = Image.new("RGB", (W, H), (236, 238, 242)); d = ImageDraw.Draw(img)
    try: font = ImageFont.truetype("DejaVuSans-Bold.ttf", 22 * scale // 2)
    except Exception: font = ImageFont.load_default()
    for i, (x, y, w, h) in enumerate(windows_px(layout, scale)):
        d.rectangle([x, y, x + w - 1, y + h - 1], fill=(255, 0, 170), outline=(120, 0, 80), width=3)
        d.text((x + 12, y + 10), f"PHOTO {i+1}\n{w} x {h}\nx={x}  y={y}", fill=(255, 255, 255), font=font)
    d.text((12, H - 40 * scale // 2), f"{L['folder']}  |  {W} x {H} px  (3x of {L['w']} x {L['h']})", fill=(60, 60, 70), font=font)
    return img

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--layout", choices=["4", "6"], help="4 = 4-photo strip, 6 = 6-photo (2x3) strip")
    ap.add_argument("--name", help="file name = frame name in the Editor, e.g. pink-hearts")
    ap.add_argument("--pattern", default="dots", choices=sorted(PATTERNS))
    ap.add_argument("--bg", default="#ffc9e3", help="background colour")
    ap.add_argument("--fg", default="#ffffff", help="pattern colour")
    ap.add_argument("--size", type=float, default=30, help="pattern cell size in CSS px (default 30)")
    ap.add_argument("--scale", type=int, default=3, help="output resolution: 3 = 3x (sharpest, default)")
    ap.add_argument("--border", type=float, default=0, help="rim around each photo in CSS px (e.g. 3)")
    ap.add_argument("--border-color", default="#ffffff")
    ap.add_argument("--template", action="store_true", help="write designer templates instead of a frame")
    ap.add_argument("--out", help="output folder (default: src/assets/<layout>cuts)")
    a = ap.parse_args()

    if a.template:
        out = pathlib.Path(a.out) if a.out else ROOT / "tools" / "frames" / "templates"
        out.mkdir(parents=True, exist_ok=True)
        for lay in ("4", "6"):
            f = out / f"template-{LAYOUTS[lay]['folder']}.png"; make_template(lay).save(f); print("wrote", f)
        return
    if not a.layout or not a.name:
        ap.error("--layout and --name are required (or use --template)")
    out = pathlib.Path(a.out) if a.out else ROOT / "src" / "assets" / LAYOUTS[a.layout]["folder"]
    out.mkdir(parents=True, exist_ok=True)
    img = make_frame(a.layout, a.pattern, a.bg, a.fg, a.size, a.scale, a.border, a.border_color)
    f = out / f"{a.name}.png"; img.save(f, optimize=True)
    print(f"wrote {f}  ({img.width} x {img.height}, {f.stat().st_size // 1024} KB)")

if __name__ == "__main__":
    main()
