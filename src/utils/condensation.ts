// condensation.ts
// Draws the "fogged bathroom mirror" look. Shared by the CAM LAB engine and
// the camera page's own fog, so both fogs look identical.
//
// A fog pixel is built from three things, in this order:
//   1. a softly DIFFUSED copy of the camera image   (condensation scatters
//      light, so what's behind it looks soft, not sharp)
//   2. a matte grey-white VEIL with a procedural texture: patchy density,
//      mottling and fine grain, plus a few tiny clear pinholes
//   3. a MASK (where fog exists, and how thick), supplied by the caller
// There are no gradients or highlights, so it stays matte (never glassy), and
// the diffusion is deliberately light (a 5-6x downscale, not a heavy blur).
//
// The texture is generated once (~30 ms) at a fixed internal size, then
// scaled to whatever the camera resolution is, so the fog looks the same in
// the live preview and in saved photos.

import { clamp01, fbm, hash, valueNoise } from "./noise";

const TEX_W = 512;      // internal texture width (height follows the aspect)
const DIFFUSE_W = 112;  // width of the tiny copy used for diffusion

export class Condensation {
  private tex: HTMLCanvasElement | null = null;
  private texAspect = 0;
  private small: HTMLCanvasElement;
  private smallCtx: CanvasRenderingContext2D;

  constructor() {
    this.small = document.createElement("canvas");
    this.smallCtx = this.small.getContext("2d")!;
  }

  private ensureTexture(aspect: number) {
    if (this.tex && Math.abs(this.texAspect - aspect) < 0.001) return this.tex;

    const tw = TEX_W;
    const th = Math.max(2, Math.round(TEX_W / aspect));

    // large-scale density field at low resolution (cheap), sampled bilinearly
    const lw = 128;
    const lh = Math.max(2, Math.round(lw / aspect));
    const low = new Float32Array(lw * lh);
    for (let y = 0; y < lh; y++) {
      for (let x = 0; x < lw; x++) {
        const u = x / lw;
        const v = y / lh;
        low[y * lw + x] =
          0.6 * fbm(u * 2.2, v * 2.2, 101) + 0.4 * fbm(u * 8, v * 8, 202);
      }
    }
    const sampleLow = (u: number, v: number) => {
      const fx = u * (lw - 1);
      const fy = v * (lh - 1);
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(lw - 1, x0 + 1);
      const y1 = Math.min(lh - 1, y0 + 1);
      const tx = fx - x0;
      const ty = fy - y0;
      const a = low[y0 * lw + x0];
      const b = low[y0 * lw + x1];
      const c = low[y1 * lw + x0];
      const d = low[y1 * lw + x1];
      return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    };

    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(tw, th);
    const px = img.data;

    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const i = (y * tw + x) * 4;

        // density: big patches + wispy mottling. The medium layer is
        // domain-warped, multi-octave noise: a plain single octave shows its
        // square lattice as a visible mosaic, this one stays organic.
        const wx = (valueNoise(x / 70, y / 70, 611) - 0.5) * 38;
        const wy = (valueNoise(x / 70, y / 70, 612) - 0.5) * 38;
        const dens =
          sampleLow(x / tw, y / th) +
          (fbm((x + wx) / 34, (y + wy) / 34, 303) - 0.5) * 0.55;

        // veil strength: mostly 40-75% so you can still see yourself
        let a = clamp01(0.55 + 1.5 * (dens - 0.5));
        a = Math.min(0.9, Math.max(0.18, a));

        const g = hash(x, y, 404); // per-pixel grain
        a *= 0.92 + 0.08 * g;
        if (hash(x, y, 505) < 0.0035) a *= 0.4; // rare tiny clear pinholes

        // matte grey-white, very slightly cool, never bright or glossy
        const shade = 228 + (dens - 0.5) * 22 + (g - 0.5) * 7;
        px[i] = shade;
        px[i + 1] = shade + 2;
        px[i + 2] = shade + 4;
        px[i + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    this.tex = canvas;
    this.texAspect = aspect;
    return canvas;
  }

  /**
   * Paints the fog into `ctx` (a w x h canvas that the caller has already
   * cleared). `mask` is a small canvas whose ALPHA says where fog is and how
   * thick. `source` (usually the <video>) is what gets diffused behind it.
   */
  paint(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    mask: HTMLCanvasElement,
    source?: CanvasImageSource | null
  ) {
    const tex = this.ensureTexture(w / h);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // 1. softly diffused camera image
    if (source) {
      const sw = DIFFUSE_W;
      const sh = Math.max(1, Math.round((DIFFUSE_W * h) / w));
      if (this.small.width !== sw || this.small.height !== sh) {
        this.small.width = sw;
        this.small.height = sh;
      }
      this.smallCtx.drawImage(source, 0, 0, sw, sh);
      ctx.drawImage(this.small, 0, 0, w, h);
    } else {
      ctx.fillStyle = "rgb(224, 228, 232)";
      ctx.fillRect(0, 0, w, h);
    }

    // 2. matte textured veil
    ctx.drawImage(tex, 0, 0, w, h);

    // 3. keep it only where the fog mask says there is fog
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(mask, 0, 0, w, h);

    ctx.restore();
  }
}
