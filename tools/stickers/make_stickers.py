#!/usr/bin/env python3
"""
make_stickers.py: cuts stickers out of sticker-sheet pictures and writes them into the app.

    python tools/stickers/make_stickers.py                 # sheets in tools/sheets/
    python tools/stickers/make_stickers.py --sheets ~/Downloads/stickers

It needs: Python 3, numpy, scipy, Pillow     (pip install numpy scipy pillow)

What it does, per sheet
  1. finds the (near-)white background and every sticker on it
  2. cuts each sticker out: soft anti-aliased edge (hard edge for pixel art),
     white fringe removed, optional white "die-cut" border
  3. saves  src/assets/stickers/<category>/<name>.webp
  4. writes src/utils/stickerManifest.ts  (the list the Decoration page reads)

To ADD a sheet:  add an entry to SHEETS below (copy a similar one), put the picture in
tools/sheets/, run the script, refresh the page. The README next to this file explains
every setting.
"""
import argparse, json, pathlib, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from toolkit import (load, background, objects, group, components, cutout, refine_dark,
                     median_lum, sticker_mask, find_holes, disk)

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "assets" / "stickers"
MANIFEST = ROOT / "src" / "utils" / "stickerManifest.ts"

# category id -> label shown on the tab, and whether it is pixel art (crisp scaling)
CATEGORIES = [
    ("pixels",  "PIXELS",  True),
    ("bw",      "B&W",     False),
    ("pearl",   "PEARL",   False),
    ("keys",    "KEYS",    False),
    ("buttons", "BUTTONS", False),
    ("polka",   "POLKA",   False),
    ("tape",    "TAPE",    False),
]

def by_rows(comps, row_h):
    return sorted(comps, key=lambda c: (round(c["cy"] / row_h), c["cx"]))

# ---------------------------------------------------------------------------------
# each sheet returns a list of (category, name, RGBA array)
# ---------------------------------------------------------------------------------
def sheet_bw(rgb):
    """black / white / silver 3D objects (18)"""
    names = ["mac", "alarm-clock", "ghost", "headphones", "glass-bunny", "ring-star", "camera", "saturn", "heart-black",
             "bunny-plush-sit", "bow-black", "star-silver", "eight-ball", "star-outline", "vinyl", "cat-black",
             "lollipop", "bunny-plush"]
    bg, _ = background(rgb, 250, 1); obj = objects(bg); lab, n = group(obj, 6)
    comps = by_rows(components(lab, n), 200)
    cfg = {0: (244, 2, 0), 1: (238, 2, 0), 2: (246, 2, 0), 4: (238, 2, 0), 5: (238, 2, 0), 6: (238, 2, 0),
           9: (250, 1, 2), 11: (238, 2, 0), 13: (238, 2, 0), 17: (244, 2, 0)}   # (threshold, open radius, smoothing)
    out = []
    for k, c in enumerate(comps):
        m0 = lab == c["id"]
        if median_lum(rgb, m0) < 105:          # dark stickers: JPEG noise makes a ragged halo -> stricter mask
            m = refine_dark(rgb, m0)
        else:
            thr, orad, sm = cfg.get(k, (244, 2, 0))
            m = sticker_mask(rgb, (c["x0"], c["y0"], c["x1"], c["y1"]), thr, orad, smooth=sm, key="bw")
        out.append(("bw", names[k], cutout(rgb, m, "photo", border=3)))
    return out

def sheet_pearl(rgb):
    """pearly pink / white / silver 3D charms (24; the cropped top row of the picture is skipped)"""
    names = {4: "headband", 5: "tulip", 6: "heart-outline", 7: "moon-star", 8: "flower-pink", 9: "pearl-heart-pink",
             10: "safety-pin", 11: "heart-pink", 12: "bow-gold", 13: "butterfly", 14: "ring-planet", 15: "clover",
             16: "heart-balloon", 17: "flower-white", 18: "pearl-circle", 19: "bow-pink", 20: "bear",
             21: "butterfly-silver", 22: "pearl-heart", 23: "clover-frame", 24: "heartbeat", 25: "heart-frame",
             26: "planet", 27: "pearl-infinity"}
    bg, _ = background(rgb, 246, 1); obj = objects(bg, min_area=25); lab, n = group(obj, 14)
    comps = by_rows(components(lab, n), 165)
    cfg = {15: (248, 1, 0), 16: (244, 2, 3), 18: (244, 2, 3), 19: (244, 2, 3), 22: (246, 0, 0), 27: (246, 0, 0),
           17: (244, 2, 0)}
    frames = {6, 9, 14, 22, 25, 27}            # interior is the sheet background -> make it see-through
    out = []
    for k, c in enumerate(comps):
        if k not in names: continue            # 0-3 are cut off by the top edge of the picture
        thr, orad, sm = cfg.get(k, (240, 2, 0))
        m = sticker_mask(rgb, (c["x0"], c["y0"], c["x1"], c["y1"]), thr, orad, key="pearl", keep_frac=0.004, smooth=sm)
        h = find_holes(rgb, m) if k in frames else None
        out.append(("pearl", names[k], cutout(rgb, m, "photo", border=0, holes=h)))
    return out

def sheet_keys(rgb):
    """40 keyboard keys on a baked-in checkerboard"""
    names = list("abcdefghijklmnopqrstuvwxyz") + ["semicolon", "bracket-l", "bracket-r", "slash"] + list("0123456789")
    mn = rgb.min(axis=2)
    body = ndi.binary_opening(mn < 238, disk(2))                   # keys are darker than both checker tones
    lab, n = ndi.label(ndi.binary_dilation(body, disk(9))); lab = lab * body
    comps = sorted([c for c in components(lab, n) if c["area"] > 2000], key=lambda c: c["cy"])
    ordered = [c for r in range(5) for c in sorted(comps[r*8:(r+1)*8], key=lambda c: c["cx"])]   # 8 x 5 grid
    out = []
    for nm, c in zip(names, ordered):
        m = ndi.binary_fill_holes(lab == c["id"])
        m = ndi.gaussian_filter(m.astype(np.float32), 2.0) > 0.5
        out.append(("keys", f"key-{nm}", cutout(rgb, m, "photo", border=0)))
    return out

def _pixel_sheet(rgb, row_h, names, skip=(), split=None):
    bg, _ = background(rgb, 215, 0); obj = objects(bg, min_area=40); lab, n = group(obj, 24)
    comps = by_rows(components(lab, n), row_h)
    out = []
    for k, c in enumerate(comps):
        if k in skip: continue
        m = lab == c["id"]
        if split and k in split:               # one group that is really several stickers
            sub, sn = ndi.label(ndi.binary_dilation(m, disk(8))); sub = sub * m
            parts = sorted(components(sub, sn), key=lambda p: p["cy"])
            for nm, p in zip(split[k], parts):
                out.append(("pixels", nm, cutout(rgb, sub == p["id"], "pixel", border=6)))
            continue
        out.append(("pixels", names[k], cutout(rgb, m, "pixel", border=6)))
    return out

def sheet_pixels_a(rgb):
    names = ["film-music", "headphones", "bow", "notes", "camera", "star-outline", "video-camera", "cat-gray",
             "heart-drip", "keyboard-circle", "dino", "planet"]
    return _pixel_sheet(rgb, 260, names)

def sheet_pixels_b(rgb):
    names = {0: "hearts", 1: "cursor-trail", 2: "game-over", 3: "hourglass", 4: "cat-color", 5: "error-404",
             6: "star-gray", 7: "love-bubble", 10: "hearts-outline", 11: "cd-note"}
    # 8 notes, 9 star outline, 12 headphones, 13 camera are already in the other pixel sheet
    return _pixel_sheet(rgb, 260, names, skip={8, 9, 12, 13}, split={14: ["soot-a", "soot-b"]})

def sheet_polka(rgb):
    """polka-dot scrapbook items: bows, hearts, clips, buttons, washi tape ..."""
    cfg = {  # group index -> (name, category, die-cut border, minimum size of see-through holes or None)
     0:("bow-beige","polka",3,None),   1:("wings","polka",3,None),       2:("note-pink","polka",3,None),
     3:("heart-blue","polka",3,None),  4:("heart-clef","polka",3,5000),  5:("clip-yellow","polka",3,500),
     6:("at-sign","polka",3,1500),     7:("tape-grey","tape",0,None),    8:("tape-blue","tape",0,None),
     9:("button-pink","buttons",0,None),10:("heart-love","polka",3,None),11:("tape-black","tape",0,None),
     12:("star-polka","polka",3,None), 13:("bass-clef","polka",3,None),  14:("clip-magenta","polka",3,500),
     15:("tape-pale","tape",0,None),   16:("tape-pink","tape",0,None),   17:("button-dots","buttons",0,200),
     18:("bow-black","polka",3,None),  19:("bow-blue","polka",3,None),   20:("button-star","buttons",0,300),
     21:("button-brown","buttons",0,200),22:("glasses","polka",3,3000),  23:("letter-u","polka",3,None),
     # 24 = a coral tape that carries a social-app watermark + id text -> left out on purpose
    }
    small_holes = {5, 14, 17, 20, 21}          # small holes are shaded at the rim -> lower threshold
    bg, _ = background(rgb, 250, 1); obj = objects(bg, min_area=40); lab, n = group(obj, 6)
    comps = by_rows(components(lab, n), 200)
    out = []
    for k, (name, cat, border, hmin) in cfg.items():
        m = lab == comps[k]["id"]
        if median_lum(rgb, m) < 105: m = refine_dark(rgb, m)
        h = find_holes(rgb, m, thr=240 if k in small_holes else 250, min_area=hmin) if hmin else None
        out.append((cat, name, cutout(rgb, m, "photo", border=border, holes=h)))
    return out

# sheet picture file name -> function that cuts it
SHEETS = {
    "IMG_0621.JPG": sheet_bw,
    "IMG_0622.JPG": sheet_pearl,
    "IMG_0623.JPG": sheet_keys,
    "IMG_0624.JPG": sheet_pixels_a,
    "IMG_0625.JPG": sheet_pixels_b,
    "IMG_0626.JPG": sheet_polka,
}

def ident(s):
    return re.sub(r"[^0-9a-zA-Z]+", "_", s).strip("_")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheets", default=str(ROOT / "tools" / "sheets"))
    args = ap.parse_args()
    sheets = pathlib.Path(args.sheets)
    pixel_cats = {c for c, _, p in CATEGORIES if p}
    items = {c: [] for c, _, _ in CATEGORIES}

    for fname, fn in SHEETS.items():
        path = sheets / fname
        if not path.exists():
            print(f"  skip {fname} (not in {sheets})"); continue
        print(f"  cutting {fname} ...")
        for cat, name, rgba in fn(load(path)):
            items[cat].append((name, rgba))

    for cat in items:
        (OUT / cat).mkdir(parents=True, exist_ok=True)
        for old in (OUT / cat).glob("*.webp"): old.unlink()

    lines, entries, total = [], [], 0
    for cat, label, pix in CATEGORIES:
        for name, rgba in items[cat]:
            im = Image.fromarray(rgba, "RGBA")
            file = OUT / cat / f"{name}.webp"
            if cat in pixel_cats:
                im.save(file, "WEBP", lossless=True, method=6)
            else:
                im.save(file, "WEBP", quality=92, alpha_quality=100, method=6)
            var = f"{ident(cat)}_{ident(name)}"
            lines.append(f'import {var} from "../assets/stickers/{cat}/{name}.webp";')
            entries.append(f'  {{ id: "{cat}-{name}", category: "{cat}", label: "{name.replace("-", " ")}", '
                           f'src: {var}, w: {im.width}, h: {im.height}, pixel: {"true" if pix else "false"} }},')
            total += 1

    cats = ",\n".join(f'  {{ id: "{c}", label: "{l}" }}' for c, l, _ in CATEGORIES if items[c])
    MANIFEST.write_text(
        "// GENERATED by tools/stickers/make_stickers.py: do not edit by hand.\n"
        "// Re-run the script after adding sheets or changing settings.\n\n"
        + "\n".join(lines) + "\n\n"
        "export interface StickerFile {\n  id: string;\n  category: string;\n  label: string;\n"
        "  src: string;\n  w: number;\n  h: number;\n  pixel: boolean;\n}\n\n"
        f"export const STICKER_CATEGORIES = [\n{cats},\n];\n\n"
        "export const STICKER_FILES: StickerFile[] = [\n" + "\n".join(entries) + "\n];\n")
    size = sum(f.stat().st_size for f in OUT.rglob("*.webp")) / 1e6
    print(f"done: {total} stickers, {size:.1f} MB -> {OUT}")

if __name__ == "__main__":
    main()
