"""Sticker cut-out toolkit.  Pure numpy / scipy / Pillow.

Pipeline for a white-background sheet:
  1. background  = near-white pixels connected to the sheet border
                   (opened by reconstruction, so a thin gap in a white object's
                   rim can't let the background leak inside it)
  2. objects     = everything else; nearby pieces are grouped into one sticker
  3. per sticker = crop, soft edge, colour de-fringe, optional white die-cut border
"""
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

def disk(r):
    y, x = np.ogrid[-r:r+1, -r:r+1]
    return (x*x + y*y) <= r*r

def load(path):
    return np.array(Image.open(path).convert("RGB"))

def background(rgb, thr=250, open_r=1):
    """near-white AND connected to the border; returns boolean bg mask"""
    cand = rgb.min(axis=2) >= thr
    core = ndi.binary_erosion(cand, disk(open_r), border_value=1) if open_r else cand
    lab, n = ndi.label(core)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    border = border[border > 0]
    bg = np.isin(lab, border)
    if open_r:
        bg = ndi.binary_dilation(bg, disk(open_r)) & cand
    return bg, cand

def objects(bg, min_area=40):
    obj = ~bg
    lab, n = ndi.label(obj)
    if n:
        sizes = ndi.sum(obj, lab, range(1, n+1))
        small = [i+1 for i, s in enumerate(sizes) if s < min_area]
        obj[np.isin(lab, small)] = False
    return obj

def group(obj, dilate_r):
    """connected groups of objects after dilation; returns label image (0 = none)"""
    grown = ndi.binary_dilation(obj, disk(dilate_r)) if dilate_r else obj
    lab, n = ndi.label(grown)
    lab = lab * obj            # keep only real object pixels
    return lab, n

def components(lab, n):
    out = []
    for i in range(1, n+1):
        ys, xs = np.where(lab == i)
        if len(ys) == 0: continue
        out.append(dict(id=i, x0=int(xs.min()), y0=int(ys.min()), x1=int(xs.max()), y1=int(ys.max()),
                        cx=float(xs.mean()), cy=float(ys.mean()), area=int(len(ys))))
    return out

def overview(rgb, comps, path, scale=1.0):
    im = Image.fromarray(rgb).convert("RGB"); d = ImageDraw.Draw(im)
    for k, c in enumerate(comps):
        d.rectangle([c["x0"], c["y0"], c["x1"], c["y1"]], outline=(255, 0, 90), width=2)
        d.rectangle([c["x0"], c["y0"], c["x0"]+34, c["y0"]+16], fill=(255, 0, 90))
        d.text((c["x0"]+3, c["y0"]+2), str(k), fill=(255, 255, 255))
    if scale != 1.0: im = im.resize((int(im.width*scale), int(im.height*scale)), Image.LANCZOS)
    im.save(path)


# ---------------------------------------------------------------- finishing
def cutout(rgb, mask, kind="photo", border=0, holes=None, halo=5):
    """rgb: full sheet, mask: boolean object mask of ONE sticker (full-sheet size).
    kind  'photo'  -> edges are UN-MIXED from white (alpha from how far a pixel is
                      from white, relative to the nearest solid object colour), which
                      removes JPEG speckle and white fringes and anti-aliases cleanly
          'pixel'  -> hard edge, no smoothing (keeps pixel art crisp)
    border: width in px of a white die-cut outline (0 = none)
    holes : optional boolean mask (full-sheet) of enclosed areas to make transparent
    halo  : how many px around the solid core are treated as edge band (photo)
    returns an RGBA uint8 array, trimmed to the sticker (+ padding)"""
    H, W, _ = rgb.shape
    m = mask.copy()
    if holes is not None:
        m &= ~holes
    ys, xs = np.where(m)
    pad = border + halo + 3
    y0, y1 = max(0, ys.min()-pad), min(H, ys.max()+pad+1)
    x0, x1 = max(0, xs.min()-pad), min(W, xs.max()+pad+1)
    m = m[y0:y1, x0:x1]
    col = rgb[y0:y1, x0:x1].astype(np.float32)
    lum = col.mean(axis=2)

    if kind == "photo":
        core = ndi.binary_erosion(m, disk(2))
        if not core.any():
            core = m
        dist, idx = ndi.distance_transform_edt(~core, return_indices=True)
        # median colour (ignores 1-3px specular glints near the rim, keeps big white areas)
        colm = np.stack([ndi.median_filter(col[..., c], size=7) for c in range(3)], -1)
        near_col = colm[idx[0], idx[1]]
        near_lum = near_col.mean(axis=2)
        # alpha by un-mixing against white (only meaningful when the edge colour is not near-white)
        unmix = np.clip((255.0 - lum) / np.maximum(255.0 - near_lum, 1.0), 0, 1)
        dark_edge = near_lum < 195
        band = (dist > 0) & (dist <= halo)
        alpha = np.where(core, 1.0, 0.0)
        # dark / mid-tone edges: soft alpha from the un-mix; light edges: keep the binary mask edge
        alpha = np.where(band & dark_edge & (m | (dist <= 2)), unmix, alpha)
        light = band & ~dark_edge & m
        alpha = np.where(light, 1.0, alpha)
        alpha = np.where(alpha < 0.10, 0.0, alpha)
        # de-fringe: everything outside the solid core takes the colour of the nearest core pixel
        col = np.where(core[..., None], col, near_col)
        # light edges lose their outermost pixel + get a touch of softness so they are not jagged
        if light.any():
            soft = ndi.gaussian_filter((m & ~light | core).astype(np.float32), 0.0)
            edge_soft = ndi.gaussian_filter(ndi.binary_erosion(m, disk(1)).astype(np.float32), 0.7)
            alpha = np.where(light, edge_soft, alpha)
    else:
        mm = ndi.binary_erosion(m, disk(1))
        inner = mm
        if inner.any():
            idx = ndi.distance_transform_edt(~inner, return_distances=False, return_indices=True)
            col = col[idx[0], idx[1]]
        alpha = mm.astype(np.float32)

    if border > 0:
        solid = alpha > 0.5
        if kind == "pixel":
            grown = ndi.binary_dilation(solid, np.ones((2*border+1, 2*border+1), bool))
            ring = (grown & ~solid).astype(np.float32)
            col = np.where(ring[..., None] > 0, 255.0, col)
            alpha = np.maximum(alpha, ring)
        else:
            # smooth the outline the border follows (a ragged JPEG edge would look wobbly)
            solid_s = ndi.gaussian_filter(solid.astype(np.float32), 1.8) > 0.5
            grown = ndi.binary_dilation(solid_s | solid, disk(border))
            # round, anti-aliased outline: smooth the grown shape, then re-sharpen it
            g = ndi.gaussian_filter(grown.astype(np.float32), 2.0)
            ring = np.maximum(np.clip((g - 0.5) * 3.0 + 0.5, 0, 1), alpha)
            a = alpha[..., None]
            col = col * a + 255.0 * (1 - a)      # white wherever it is not the sticker itself
            alpha = ring

    return np.dstack([np.clip(col, 0, 255), np.clip(alpha, 0, 1) * 255]).astype(np.uint8)

def contact_sheet(stickers, path, cols=6, cell=170, bgcolor=(48, 50, 58), checker=False):
    rows = (len(stickers) + cols - 1) // cols
    sheet = Image.new("RGB", (cols*cell, rows*cell), bgcolor)
    d = ImageDraw.Draw(sheet)
    for k, s in enumerate(stickers):
        im = Image.fromarray(s, "RGBA"); r = min((cell-16)/im.width, (cell-16)/im.height, 3.0)
        im = im.resize((max(1, int(im.width*r)), max(1, int(im.height*r))), Image.LANCZOS if r < 1 else Image.NEAREST if False else Image.LANCZOS)
        x, y = (k % cols)*cell + (cell-im.width)//2, (k//cols)*cell + (cell-im.height)//2
        sheet.paste(im, (x, y), im)
        d.text(((k % cols)*cell+3, (k//cols)*cell+2), str(k), fill=(255, 220, 80))
    sheet.save(path)


def refine_dark(rgb, mask, thr=222, open_r=1, min_frac=0.02):
    """For mostly-dark stickers: JPEG block noise leaves a ragged near-white halo that
    passes the strict 'pure white' test. Re-derive the mask with a much lower threshold,
    then fill enclosed light areas back in (vinyl label, 8-ball circle, clock face)."""
    ys, xs = np.where(mask)
    y0, y1, x0, x1 = ys.min(), ys.max()+1, xs.min(), xs.max()+1
    sub = rgb[y0:y1, x0:x1]
    m = mask[y0:y1, x0:x1] & (sub.min(axis=2) < thr)
    if open_r:
        m = ndi.binary_opening(m, disk(open_r))
    lab, n = ndi.label(m)
    if n > 1:                                   # drop crumbs, keep real pieces
        sizes = ndi.sum(m, lab, range(1, n+1))
        keep = [i+1 for i, s in enumerate(sizes) if s >= max(30, sizes.max()*min_frac)]
        m = np.isin(lab, keep)
    m = ndi.binary_fill_holes(m)
    out = np.zeros_like(mask)
    out[y0:y1, x0:x1] = m
    return out

def median_lum(rgb, mask):
    return float(np.median(rgb[mask].mean(axis=1)))


_bgcache = {}
def sticker_mask(rgb, bbox, thr=244, open_r=2, pad=5, smooth=0, key=None, keep_frac=0.03):
    """Mask of ONE sticker: object pixels (not background at this threshold) inside bbox."""
    k = (key, thr, open_r)
    if k not in _bgcache:
        bg, _ = background(rgb, thr, open_r)
        _bgcache[k] = objects(bg, min_area=60)
    obj = _bgcache[k]
    x0, y0, x1, y1 = bbox
    H, W = obj.shape
    X0, Y0, X1, Y1 = max(0, x0-pad), max(0, y0-pad), min(W, x1+pad+1), min(H, y1+pad+1)
    m = np.zeros_like(obj); m[Y0:Y1, X0:X1] = obj[Y0:Y1, X0:X1]
    lab, n = ndi.label(ndi.binary_dilation(m, disk(6)))
    lab = lab * m
    if n > 1:                                   # keep the pieces that make up the sticker
        sizes = ndi.sum(m, lab, range(1, n+1))
        keep = [i+1 for i, s in enumerate(sizes) if s >= sizes.max()*keep_frac]
        m = np.isin(lab, keep)
    if smooth:
        m = ndi.binary_closing(m, disk(smooth)); m = ndi.binary_opening(m, disk(smooth))
        m = ndi.binary_fill_holes(m) if smooth >= 2 else m
    return m


def find_holes(rgb, mask, thr=250, min_area=350, shrink=2):
    """Large flat pure-white areas ENCLOSED inside a sticker = the sheet background
    showing through a frame / ring / outline (not painted pearl, which is always shaded)."""
    inner = ndi.binary_erosion(mask, disk(shrink)) if shrink else mask
    cand = inner & (rgb.min(axis=2) >= thr)
    lab, n = ndi.label(cand)
    holes = np.zeros_like(mask)
    for i in range(1, n+1):
        reg = lab == i
        if reg.sum() >= min_area:
            holes |= reg
    return ndi.binary_dilation(holes, disk(shrink)) & mask if holes.any() else holes
