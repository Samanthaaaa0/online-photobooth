import { filters } from "../filters/presets";
import type { FilterName, FilterSettings } from "../filters/presets";

// =====================================================================
// FILTER PIPELINE
//
// gradeImageData() is a PURE function over raw RGBA pixels (no canvas, no
// DOM), so the whole look can be tested anywhere. The stages, in order:
//
//   1 colour grade   exposure, tone, contrast, colour, mono, split-toning, fade
//   2 bloom          soft glow from bright areas (dreamy old-lens softness)
//   3 lens           colour fringing toward the edges
//   4 vignette       darker corners
//   5 light leak     warm glow bleeding in from one side
//   6 grain          film grain, strongest in the mid-tones
//
// applyFilter() runs that on a canvas and then draws the date stamp.
// =====================================================================

type Rng = () => number;

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** screen blend of one channel (add light without clipping harshly) */
const screen = (base: number, add: number) => 255 - ((255 - base) * (255 - add)) / 255;

// ---------------------------------------------------------------------
// 1. COLOUR GRADE (per pixel)
// ---------------------------------------------------------------------
function colourGrade(px: Uint8ClampedArray, s: FilterSettings) {
  const expMul = Math.pow(2, s.exposure / 100);
  const contrast = 1 + s.contrast / 100;
  const satMul = 1 + s.saturation / 100;
  const vib = s.vibrance / 100;
  const fadeRange = 255 - s.fadeBlack - s.fadeWhite;
  const doFade = s.fadeBlack !== 0 || s.fadeWhite !== 0;

  const sT = s.shadowTint;
  const hT = s.highlightTint;
  const mT = s.monoTint;

  for (let i = 0; i < px.length; i += 4) {
    let r = px[i] * expMul + s.brightness;
    let g = px[i + 1] * expMul + s.brightness;
    let b = px[i + 2] * expMul + s.brightness;

    // highlights / shadows
    let lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum > 128) {
      const adj = s.highlights * ((lum - 128) / 127);
      r += adj; g += adj; b += adj;
    } else {
      const adj = s.shadows * ((128 - lum) / 128);
      r += adj; g += adj; b += adj;
    }

    // contrast around mid grey
    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;

    // vibrance (boosts weak colours more) then saturation
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const vAmount = (1 - (maxC - minC) / 255) * vib;
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r += (r - gray) * vAmount;
    g += (g - gray) * vAmount;
    b += (b - gray) * vAmount;

    gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * satMul;
    g = gray + (g - gray) * satMul;
    b = gray + (b - gray) * satMul;

    // monochrome (with a tint colour: neutral, warm silver, sepia ...)
    if (s.mono > 0) {
      const tr = (gray * mT[0]) / 255;
      const tg = (gray * mT[1]) / 255;
      const tb = (gray * mT[2]) / 255;
      r += (tr - r) * s.mono;
      g += (tg - g) * s.mono;
      b += (tb - b) * s.mono;
    }

    // temperature + tint
    r += s.temperature + s.tint;
    b += -s.temperature + s.tint;
    g -= s.tint;

    // split toning: colour the shadows and the highlights separately
    if (s.shadowAmount > 0 || s.highlightAmount > 0) {
      const l = clamp01((0.299 * r + 0.587 * g + 0.114 * b) / 255);
      const ws = (1 - l) * (1 - l) * s.shadowAmount;
      const wh = l * l * s.highlightAmount;
      r += (sT[0] - 128) * ws * 0.55 + (hT[0] - 128) * wh * 0.4;
      g += (sT[1] - 128) * ws * 0.55 + (hT[1] - 128) * wh * 0.4;
      b += (sT[2] - 128) * ws * 0.55 + (hT[2] - 128) * wh * 0.4;
    }

    // fade: lift the blacks, lower the whites (matte, faded print)
    if (doFade) {
      r = s.fadeBlack + (r / 255) * fadeRange;
      g = s.fadeBlack + (g / 255) * fadeRange;
      b = s.fadeBlack + (b / 255) * fadeRange;
    }

    px[i] = clamp(r);
    px[i + 1] = clamp(g);
    px[i + 2] = clamp(b);
  }
}

// ---------------------------------------------------------------------
// 2. BLOOM: blur a copy of the bright areas and screen it back on top
// ---------------------------------------------------------------------
function boxBlur(src: Float32Array, w: number, h: number, radius: number) {
  // separable moving average over a 3-channel float image
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const win = radius * 2 + 1;

  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        acc += src[(y * w + Math.min(w - 1, Math.max(0, k))) * 3 + c];
      }
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 3 + c] = acc / win;
        const add = Math.min(w - 1, x + radius + 1);
        const sub = Math.max(0, x - radius);
        acc += src[(y * w + add) * 3 + c] - src[(y * w + sub) * 3 + c];
      }
    }
  }
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        acc += tmp[(Math.min(h - 1, Math.max(0, k)) * w + x) * 3 + c];
      }
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * 3 + c] = acc / win;
        const add = Math.min(h - 1, y + radius + 1);
        const sub = Math.max(0, y - radius);
        acc += tmp[(add * w + x) * 3 + c] - tmp[(sub * w + x) * 3 + c];
      }
    }
  }
  return out;
}

function bloom(px: Uint8ClampedArray, w: number, h: number, amount: number, color: number[]) {
  // work on a small copy: cheap, and the blur is wide anyway
  const f = Math.max(2, Math.round(w / 150));
  const sw = Math.max(2, Math.floor(w / f));
  const sh = Math.max(2, Math.floor(h / f));
  let small: Float32Array = new Float32Array(sw * sh * 3);

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = 0; dy < f; dy++) {
        for (let dx = 0; dx < f; dx++) {
          const i = (((y * f + dy) * w) + (x * f + dx)) * 4;
          r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
        }
      }
      r /= n; g /= n; b /= n;
      // only the bright parts glow
      const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const m = clamp01((l - 0.35) / 0.65);
      const wgt = m * m;
      const o = (y * sw + x) * 3;
      small[o] = r * wgt; small[o + 1] = g * wgt; small[o + 2] = b * wgt;
    }
  }

  small = boxBlur(small, sw, sh, 3);
  small = boxBlur(small, sw, sh, 3);

  for (let y = 0; y < h; y++) {
    const fy = Math.min(sh - 1.001, (y + 0.5) / f - 0.5 < 0 ? 0 : (y + 0.5) / f - 0.5);
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(sw - 1.001, (x + 0.5) / f - 0.5 < 0 ? 0 : (x + 0.5) / f - 0.5);
      const x0 = Math.floor(fx);
      const tx = fx - x0;
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const a = small[(y0 * sw + x0) * 3 + c];
        const b = small[(y0 * sw + x0 + 1) * 3 + c];
        const cc = small[((y0 + 1) * sw + x0) * 3 + c];
        const d = small[((y0 + 1) * sw + x0 + 1) * 3 + c];
        const glow = (a + (b - a) * tx) * (1 - ty) + (cc + (d - cc) * tx) * ty;
        px[i + c] = clamp(screen(px[i + c], glow * amount * 1.6 * (color[c] / 255)));
      }
    }
  }
}

// ---------------------------------------------------------------------
// 3. LENS FRINGING: red and blue drift apart toward the edges
// ---------------------------------------------------------------------
function aberration(px: Uint8ClampedArray, w: number, h: number, amount: number) {
  const src = new Uint8ClampedArray(px);
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.hypot(cx, cy);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy) / maxR; // 0 centre .. 1 corner
      if (d < 0.05) continue;
      const shift = amount * d * d * 2;
      const ux = dx / (d * maxR);
      const uy = dy / (d * maxR);

      const rx = Math.min(w - 1, Math.max(0, Math.round(x + ux * shift)));
      const ry = Math.min(h - 1, Math.max(0, Math.round(y + uy * shift)));
      const bx = Math.min(w - 1, Math.max(0, Math.round(x - ux * shift)));
      const by = Math.min(h - 1, Math.max(0, Math.round(y - uy * shift)));

      const i = (y * w + x) * 4;
      px[i] = src[(ry * w + rx) * 4];
      px[i + 2] = src[(by * w + bx) * 4 + 2];
    }
  }
}

// ---------------------------------------------------------------------
// 4. VIGNETTE
// ---------------------------------------------------------------------
function vignette(px: Uint8ClampedArray, w: number, h: number, amount: number) {
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.hypot(cx, cy);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, y - cy) / maxR;
      const t = clamp01((d - 0.35) / 0.65);
      const k = 1 - amount * t * t * (3 - 2 * t);
      const i = (y * w + x) * 4;
      px[i] *= k; px[i + 1] *= k; px[i + 2] *= k;
    }
  }
}

// ---------------------------------------------------------------------
// 5. LIGHT LEAK: warm glow bleeding in from one side
// ---------------------------------------------------------------------
function lightLeak(
  px: Uint8ClampedArray,
  w: number,
  h: number,
  amount: number,
  color: number[],
  side: FilterSettings["leakSide"]
) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // t: 0 at the leaking edge -> 1 far away. along: position along the edge
      let t: number, along: number;
      if (side === "right") { t = (w - 1 - x) / w; along = y / h; }
      else if (side === "left") { t = x / w; along = y / h; }
      else if (side === "top") { t = y / h; along = x / w; }
      else { t = (h - 1 - y) / h; along = x / w; }

      // the leak is strongest in one stretch of the edge, never uniform
      const patch = 0.55 + 0.45 * Math.sin(along * 5.2 + 1.1) * Math.sin(along * 2.3 + 0.4);
      const k = Math.pow(clamp01(1 - t / 0.6), 1.9) * amount * clamp01(patch);
      if (k <= 0.001) continue;

      const i = (y * w + x) * 4;
      // hot yellow core inside the colour
      const core = Math.pow(clamp01(1 - t / 0.18), 2) * 0.55;
      px[i] = clamp(screen(px[i], 255 * k * (color[0] / 255) + 255 * core * k));
      px[i + 1] = clamp(screen(px[i + 1], 255 * k * (color[1] / 255) + 200 * core * k));
      px[i + 2] = clamp(screen(px[i + 2], 255 * k * (color[2] / 255)));
    }
  }
}

// ---------------------------------------------------------------------
// 6. GRAIN: monochrome, strongest in the mid-tones, like real film
// ---------------------------------------------------------------------
function grain(px: Uint8ClampedArray, amount: number, rng: Rng) {
  for (let i = 0; i < px.length; i += 4) {
    const l = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
    const midtone = 1 - Math.abs(l - 0.5) * 1.3;
    const n = (rng() + rng() + rng() - 1.5) * amount * (0.45 + midtone * 0.8);
    px[i] = clamp(px[i] + n);
    px[i + 1] = clamp(px[i + 1] + n);
    px[i + 2] = clamp(px[i + 2] + n);
  }
}

// =====================================================================
// THE WHOLE LOOK (pure: raw RGBA in, raw RGBA out)
// =====================================================================
export function gradeImageData(
  px: Uint8ClampedArray,
  w: number,
  h: number,
  s: FilterSettings,
  rng: Rng = Math.random
) {
  colourGrade(px, s);
  if (s.bloom > 0) bloom(px, w, h, s.bloom, s.bloomColor);
  if (s.aberration > 0) aberration(px, w, h, s.aberration);
  if (s.vignette > 0) vignette(px, w, h, s.vignette);
  if (s.leak > 0) lightLeak(px, w, h, s.leak, s.leakColor, s.leakSide);
  if (s.grain > 0) grain(px, s.grain, rng);
}

// =====================================================================
// DATE STAMP: the orange digicam date in the corner
// =====================================================================
function drawDateStamp(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const text = `'${yy} ${mm} ${dd}`;

  const size = Math.round(h * 0.055);
  ctx.save();
  ctx.font = `bold ${size}px "Courier New", Courier, monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  const x = w - size * 0.8;
  const y = h - size * 0.7;

  ctx.shadowColor = "rgba(255, 90, 0, 0.9)"; // glow
  ctx.shadowBlur = size * 0.35;
  ctx.fillStyle = "#ff9a2a";
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffb347";
  ctx.fillText(text, x, y);
  ctx.restore();
}

// =====================================================================
// APPLY FILTER TO A CANVAS
// =====================================================================
export function applyFilter(canvas: HTMLCanvasElement, filterName: FilterName) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const settings = filters[filterName];
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  gradeImageData(imageData.data, canvas.width, canvas.height, settings);
  ctx.putImageData(imageData, 0, 0);

  if (settings.dateStamp) drawDateStamp(ctx, canvas.width, canvas.height);
}

// =====================================================================
// FILTER AN IMAGE (data URL in -> data URL out)
// `maxWidth` makes small, fast previews for the filter tiles.
// =====================================================================
export function filterImage(
  imageUrl: string,
  filterName: FilterName,
  maxWidth?: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      // NORMAL = don't touch the original (unless a small preview was asked for)
      if (filterName === "normal" && !maxWidth) {
        resolve(imageUrl);
        return;
      }

      const scale =
        maxWidth && image.naturalWidth > maxWidth ? maxWidth / image.naturalWidth : 1;

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      if (filterName !== "normal") applyFilter(canvas, filterName);

      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };

    image.onerror = () => reject(new Error("Could not load image"));
    image.src = imageUrl;
  });
}
