// fogEngine.ts
// Framework-free logic for CAM LAB: the fog, the fog-clearing strokes, the
// neon strokes, undo and compositing. No React in here, so the same engine
// draws the live overlay, the camera page preview AND the saved photos.
//
// TWO INDEPENDENT LAYERS
//   fog layer  : matte condensation (FOG ART or FOG REVEAL). Finger strokes
//                ERASE fog from it.
//   neon layer : glowing strokes drawn ON TOP of the fog.
// Which one your finger edits is the active `tool`. Each layer keeps its own
// strokes and undo history, so editing one never touches the other.
//
// THE PEN: the fingertip goes through a One Euro filter (steady when you hold still, no lag
// when you move), is stored as a sparse path, smoothed and drawn as a spline. Shape brushes
// (hearts / stars / sparkles) drop a stamp every few px instead, which looks cute even when
// the hand shakes. See utils/stabilizer.ts.
//
// All coordinates are in "video pixels" (the webcam's native size, NOT
// mirrored). Mirroring / cropping is the caller's job (CSS object-fit: cover
// + scaleX(-1) on screen, coverCrop() + a flipped canvas for photos).

import { Condensation } from "../utils/condensation";
import { clamp01, fbm, smoothstep } from "../utils/noise";
import { OneEuro2D, STABILIZER_UNIT, smoothPath, splineSegments } from "../utils/stabilizer";

export type FogMode = "art" | "reveal";
export type Tool = "fog" | "neon";
export type NeonStyle = "neon" | "pink" | "soft";

export interface Pt {
  x: number;
  y: number;
}

export type BrushShape = "line" | "heart" | "star" | "sparkle";

export interface Stamp {
  x: number;
  y: number;
  rot: number;   // radians
  s: number;     // size variation (about 0.9 .. 1.1)
  born: number;  // ms timestamp, used for the gradual fog clear-in
}

export interface Stroke {
  size: number;        // brush width in video px
  shape: BrushShape;
  points: Pt[];        // filtered pen path, one point about every 5 px (line brush)
  tip: Pt;             // the live pen position (newest filtered point)
  born: number;        // ms timestamp, used for the gradual fog clear-in
  stamps: Stamp[];     // shape brushes: the hearts / stars / sparkles along the path
  lastStamp: Pt;
  smoothed?: Pt[];     // cached smoothed path once the stroke is finished
  style?: NeonStyle;   // neon strokes remember the style + glow they were drawn with
  glow?: number;
}

interface Layer {
  strokes: Stroke[];
  coverage: number; // FOG REVEAL: how far the fog has crept in (0..1)
}

export const NEON_PRESETS: Record<
  NeonStyle,
  {
    label: string;
    swatch: string;     // UI colour
    glow: [number, number, number];
    core: string;
    centre: string;
    widthScale: number; // SOFT LIGHT is thinner / more delicate
    glowScale: number;  // ...and has a subtler glow
  }
> = {
  neon: {
    label: "NEON",
    swatch: "#40E0D0",
    glow: [64, 224, 208],
    core: "rgb(140, 250, 240)",
    centre: "rgb(232, 255, 253)",
    widthScale: 1,
    glowScale: 1,
  },
  pink: {
    label: "PINK GLOW",
    swatch: "#ff4fa3",
    glow: [255, 79, 163],
    core: "rgb(255, 130, 195)",
    centre: "rgb(255, 224, 240)",
    widthScale: 1,
    glowScale: 1,
  },
  soft: {
    label: "SOFT LIGHT",
    swatch: "#f4f4f4",
    glow: [255, 255, 255],
    core: "rgb(255, 255, 255)",
    centre: "rgb(255, 255, 255)",
    widthScale: 0.6,
    glowScale: 0.5,
  },
};

// ---- tuning ----------------------------------------------------------
const GRID_W = 240;            // fog mask resolution
const REVEAL_SECONDS = 4;      // how long FOG REVEAL takes to fog the camera
const FADE_IN_MS = 350;        // each wiped line clears the fog gradually
const CLEAR_STRENGTH: Record<FogMode, number> = {
  art: 0.8,    // ART leaves a faint trace, like a finger on a mirror
  reveal: 1,   // REVEAL wipes fully clear and stays clear
};

function newLayer(): Layer {
  return { strokes: [], coverage: 0 };
}

/** the path a LINE stroke is drawn along: smoothed + the live tip */
function linePoints(st: Stroke): Pt[] {
  if (st.smoothed) return st.smoothed;
  const last = st.points[st.points.length - 1];
  const all = last === st.tip ? st.points : [...st.points, st.tip];
  return smoothPath(all, 2);
}

/** a smooth Catmull-Rom curve through the points */
function traceSmooth(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length < 3) {
    const e = pts[pts.length - 1];
    ctx.lineTo(pts.length === 1 ? e.x + 0.01 : e.x, e.y);
    return;
  }
  for (const seg of splineSegments(pts)) {
    ctx.bezierCurveTo(seg.c1.x, seg.c1.y, seg.c2.x, seg.c2.y, seg.end.x, seg.end.y);
  }
}

// unit-size shapes (about 1 px radius), scaled per stamp
const shapeCache: Partial<Record<BrushShape, Path2D>> = {};
function shapePath(shape: BrushShape): Path2D {
  let p = shapeCache[shape];
  if (p) return p;
  p = new Path2D();
  if (shape === "heart") {
    for (let i = 0; i <= 96; i++) {
      const t = (i / 96) * Math.PI * 2;
      const x = (16 * Math.sin(t) ** 3) / 17;
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 + 0.12;
      if (i === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    }
    p.closePath();
  } else if (shape === "star") {
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? 1 : 0.46;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      if (i === 0) p.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else p.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    p.closePath();
  } else {
    p.moveTo(0, -1);
    p.bezierCurveTo(0.07, -0.33, 0.33, -0.07, 1, 0);
    p.bezierCurveTo(0.33, 0.07, 0.07, 0.33, 0, 1);
    p.bezierCurveTo(-0.07, 0.33, -0.33, 0.07, -1, 0);
    p.bezierCurveTo(-0.33, -0.07, -0.07, -0.33, 0, -1);
    p.closePath();
  }
  shapeCache[shape] = p;
  return p;
}

function fillShape(ctx: CanvasRenderingContext2D, path: Path2D, m: Stamp, r: number) {
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(m.rot);
  ctx.scale(r, r);
  ctx.fill(path);
  ctx.restore();
}

function strokeShape(ctx: CanvasRenderingContext2D, path: Path2D, m: Stamp, r: number, lineWidth: number) {
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(m.rot);
  ctx.scale(r, r);
  ctx.lineWidth = lineWidth / r;
  ctx.stroke(path);
  ctx.restore();
}

/** radius of a shape stamp for a given brush width */
const stampRadius = (size: number) => size * 1.8;

export class FogEngine {
  fogMode: FogMode = "art";
  // The lab opens on NEON DRAW with NO fog: the camera stays perfectly clear until the user
  // deliberately picks FOG ART or FOG REVEAL.
  tool: Tool = "neon";
  private fogOn = false;
  neonStyle: NeonStyle = "neon";
  onChange: (() => void) | null = null; // fired when undo availability changes

  private fogIntensity: Record<FogMode, number> = { art: 0.45, reveal: 0.8 };
  private glow = 0.6;
  private brushes = { fog: 2, neon: 3 }; // 1..10, thin by default
  private fogLayers: Record<FogMode, Layer> = {
    art: newLayer(),
    reveal: newLayer(),
  };
  private neonLayer: Layer = newLayer();

  private w = 0;
  private h = 0;
  private gw = GRID_W;
  private gh = 0;
  private activated = false;
  private dirty = true;

  private artMap = new Float32Array(0);    // ART: fog shape (0 centre .. 1 edges)
  private revealThr = new Float32Array(0); // REVEAL: when each cell gets fogged
  private revealTex = new Float32Array(0); // REVEAL: gentle density variation

  private maskCanvas: HTMLCanvasElement;
  private maskImage: ImageData | null = null;
  private fxCanvas: HTMLCanvasElement;
  private fxCtx: CanvasRenderingContext2D;
  private condensation = new Condensation();

  // pen state
  shape: BrushShape = "line";                       // brush shape (both tools)
  private current: Stroke | null = null;
  private filter = new OneEuro2D(1.2, 0.05, 1.0);   // tuned by simulation, see utils/stabilizer.ts

  constructor() {
    this.maskCanvas = document.createElement("canvas");
    this.fxCanvas = document.createElement("canvas");
    this.fxCtx = this.fxCanvas.getContext("2d")!;
  }

  // ---------------------------------------------------------------- setup

  /** Call with the webcam's native size. Cheap when nothing changed. */
  setSize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.gh = Math.max(1, Math.round((GRID_W * h) / w));
    this.fxCanvas.width = w;
    this.fxCanvas.height = h;
    this.maskCanvas.width = this.gw;
    this.maskCanvas.height = this.gh;

    const n = this.gw * this.gh;
    this.maskImage = this.maskCanvas.getContext("2d")!.createImageData(this.gw, this.gh);
    for (let i = 0; i < n; i++) {
      // colour is irrelevant: only the mask's alpha is used
      this.maskImage.data[i * 4] = 255;
      this.maskImage.data[i * 4 + 1] = 255;
      this.maskImage.data[i * 4 + 2] = 255;
    }

    this.artMap = new Float32Array(n);
    this.revealThr = new Float32Array(n);
    this.revealTex = new Float32Array(n);

    for (let y = 0; y < this.gh; y++) {
      for (let x = 0; x < this.gw; x++) {
        const i = y * this.gw + x;
        const u = x / this.gw;
        const v = y / this.gh;
        const nx = (x / (this.gw - 1)) * 2 - 1;
        const ny = (y / (this.gh - 1)) * 2 - 1;

        // rounded-rectangle distance from the centre: 0 centre, 1 edge midpoints
        const r = Math.pow(Math.abs(nx) ** 3 + Math.abs(ny) ** 3, 1 / 3);

        // ART: irregular fog hugging the edges, ragged boundary, clear centre
        const warp = fbm(u * 3.2, v * 3.2, 11) - 0.5;
        const ragged = fbm(u * 16, v * 16, 77) - 0.5;
        const shape = smoothstep(0.42, 0.98, r + warp * 0.45 + ragged * 0.2);
        const tex = 0.75 + 0.5 * fbm(u * 7, v * 7, 23);
        this.artMap[i] = Math.min(1, shape * tex);

        // REVEAL: fog creeps in from the edges with a ragged front
        const edge = Math.min(1, r);
        this.revealThr[i] = Math.min(
          1,
          0.58 * (1 - edge) + 0.32 * fbm(u * 5, v * 5, 37) + 0.1 * fbm(u * 18, v * 18, 91)
        );
        this.revealTex[i] = 0.88 + 0.24 * fbm(u * 8, v * 8, 51);
      }
    }
    this.dirty = true;
  }

  /** Marks the engine as in use (so photos / preview can include it). */
  activate() {
    this.activated = true;
    this.dirty = true;
  }

  // ----------------------------------------------------- tools / settings

  private get layer(): Layer {
    return this.tool === "neon" ? this.neonLayer : this.fogLayers[this.fogMode];
  }

  /** FOG ART / FOG REVEAL: picks the fog style AND switches to the fog tool. */
  setFogMode(m: FogMode) {
    // fog that was off and is switched on in REVEAL breathes in from nothing
    if (!this.fogOn && m === "reveal") this.fogLayers.reveal.coverage = 0;
    this.fogOn = true;
    this.fogMode = m;
    this.tool = "fog";
    this.liftPen();
    this.dirty = true;
    this.onChange?.();
  }

  /** NO FOG: takes the fog away completely (drawn lines and neon stay) and goes back to NEON DRAW. */
  setFogOff() {
    this.fogOn = false;
    this.tool = "neon";
    this.liftPen();
    this.dirty = true;
    this.onChange?.();
  }

  isFogOn() {
    return this.fogOn;
  }

  /** NEON DRAW keeps whatever fog is showing and draws glowing lines over it. */
  setTool(t: Tool) {
    this.tool = t;
    this.liftPen();
    this.onChange?.();
  }

  setNeonStyle(s: NeonStyle) {
    this.neonStyle = s;
  }

  setShape(s: BrushShape) {
    this.shape = s;
    this.liftPen();
  }

  /** The slider value (0..1) of the active tool: fog intensity or glow. */
  getLevel() {
    return this.tool === "neon" ? this.glow : this.fogIntensity[this.fogMode];
  }

  setLevel(v: number) {
    if (this.tool === "neon") {
      this.glow = clamp01(v);
    } else {
      this.fogIntensity[this.fogMode] = clamp01(v);
      this.dirty = true;
    }
  }

  getBrush() {
    return this.brushes[this.tool];
  }

  setBrush(v: number) {
    this.brushes[this.tool] = v;
  }

  brushWidth() {
    const b = this.brushes[this.tool];
    return this.tool === "neon"
      ? this.w * (0.0025 + b * 0.0035)
      : this.w * (0.003 + b * 0.005);
  }

  /** radius (video px) of the brush cursor: half the line width, or the stamp radius for shapes */
  markerRadius() {
    return this.shape === "line" ? this.brushWidth() / 2 + 2 : stampRadius(this.brushWidth());
  }

  // ---------------------------------------------------------------- state

  /** Fog opacity 0..1 for the current fog style (0 = no fog at all). */
  private fogOpacity() {
    if (!this.fogOn) return 0;
    const i = this.fogIntensity[this.fogMode];
    return this.fogMode === "art" ? 0.85 * i : Math.min(0.95, 1.05 * i);
  }

  hasContent() {
    if (!this.activated || this.w === 0) return false;
    return this.fogOpacity() > 0 || this.neonLayer.strokes.length > 0;
  }

  canUndo() {
    return this.layer.strokes.length > 0;
  }

  /** UNDO: removes the last stroke of the active tool. */
  undo() {
    this.layer.strokes.pop();
    this.current = null;
    this.filter.reset();
    this.onChange?.();
  }

  /** CLEAR: removes every stroke of the active tool (fog returns / glow goes).
   *  In FOG REVEAL the fog also breathes in again from scratch. */
  clear() {
    this.layer.strokes = [];
    this.current = null;
    this.filter.reset();
    if (this.tool === "fog" && this.fogMode === "reveal") {
      this.fogLayers.reveal.coverage = 0;
      this.dirty = true;
    }
    this.onChange?.();
  }

  // -------------------------------------------------------------- drawing

  private addStamp(st: Stroke, p: Pt, now: number) {
    st.stamps.push({
      x: p.x,
      y: p.y,
      rot: st.shape === "sparkle" ? Math.random() * 0.8 : (Math.random() - 0.5) * 0.7,
      s: 0.9 + Math.random() * 0.2,
      born: now,
    });
  }

  /** drop stamps along the path from the last stamp to `sp`, one every `spacing` px */
  private advanceStamps(st: Stroke, sp: Pt, now: number) {
    const spacing = stampRadius(st.size) * 2.0;
    let p = st.lastStamp;
    let d = Math.hypot(sp.x - p.x, sp.y - p.y);
    for (let guard = 0; d >= spacing && guard < 60; guard++) {
      const t = spacing / d;
      p = { x: p.x + (sp.x - p.x) * t, y: p.y + (sp.y - p.y) * t };
      this.addStamp(st, p, now);
      d = Math.hypot(sp.x - p.x, sp.y - p.y);
    }
    st.lastStamp = p;
  }

  /**
   * Pen down / moving. `raw` is the fingertip in video px, `now` a timestamp in ms.
   * Returns the stabilised pen position (draw the brush marker there).
   */
  drawAt(raw: Pt, now: number): Pt {
    // filter in a resolution-independent space so tuning holds for any camera size
    const k = STABILIZER_UNIT / (this.w || STABILIZER_UNIT);
    const f = this.filter.filter({ x: raw.x * k, y: raw.y * k }, now);
    const sp = { x: f.x / k, y: f.y / k };

    const L = this.layer;
    let st = this.current;

    if (!st) {
      st = {
        size: this.brushWidth(),
        shape: this.shape,
        points: [sp],
        tip: sp,
        born: now,
        stamps: [],
        lastStamp: sp,
      };
      if (this.tool === "neon") {
        st.style = this.neonStyle;
        st.glow = this.glow;
      }
      if (st.shape !== "line") this.addStamp(st, sp, now);
      L.strokes.push(st);
      this.current = st;
      this.onChange?.();
    } else {
      // keep one point every ~5px: holding still adds nothing, so jitter cannot pile up
      const last = st.points[st.points.length - 1];
      if (Math.hypot(sp.x - last.x, sp.y - last.y) >= 5 / k) st.points.push(sp);
      st.tip = sp;
      if (st.shape !== "line") this.advanceStamps(st, sp, now);
    }
    return sp;
  }

  /** Pen up: finishes the stroke (its smoothed path is cached from now on). */
  liftPen() {
    const st = this.current;
    if (st && st.shape === "line") st.smoothed = linePoints(st);
    this.current = null;
    this.filter.reset();
  }

  // ------------------------------------------------------------ per frame

  update(dt: number) {
    const L = this.fogLayers.reveal;
    if (this.fogOn && this.fogMode === "reveal" && L.coverage < 1) {
      L.coverage = Math.min(1, L.coverage + dt / REVEAL_SECONDS);
      this.dirty = true;
    }
  }

  private refreshMask() {
    const img = this.maskImage;
    if (!img) return;
    const px = img.data;
    const n = this.gw * this.gh;
    const op = this.fogOpacity();

    if (this.fogMode === "art") {
      for (let i = 0; i < n; i++) px[i * 4 + 3] = Math.min(1, op * this.artMap[i]) * 255;
    } else {
      const cov = this.fogLayers.reveal.coverage * 1.25;
      for (let i = 0; i < n; i++) {
        const local = clamp01((cov - this.revealThr[i]) / 0.25);
        px[i * 4 + 3] = Math.min(1, op * local * this.revealTex[i]) * 255;
      }
    }
    this.maskCanvas.getContext("2d")!.putImageData(img, 0, 0);
    this.dirty = false;
  }

  /** wiped lines and shapes erase the fog (destination-out) */
  private eraseStrokes(ctx: CanvasRenderingContext2D, now: number) {
    const L = this.fogLayers[this.fogMode];
    if (L.strokes.length === 0) return;

    const strength = CLEAR_STRENGTH[this.fogMode];
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const st of L.strokes) {
      if (st.shape === "line") {
        const a = strength * clamp01((now - st.born) / FADE_IN_MS);
        if (a <= 0) continue;
        const pts = linePoints(st);
        // soft halo, then a clean core
        for (const pass of [
          { k: 1.7, a: 0.3 * a },
          { k: 1, a },
        ]) {
          ctx.strokeStyle = `rgba(0,0,0,${pass.a})`;
          ctx.lineWidth = st.size * pass.k;
          traceSmooth(ctx, pts);
          ctx.stroke();
        }
      } else {
        const path = shapePath(st.shape);
        const r = stampRadius(st.size);
        for (const m of st.stamps) {
          const a = strength * clamp01((now - m.born) / FADE_IN_MS);
          if (a <= 0) continue;
          ctx.fillStyle = `rgba(0,0,0,${0.3 * a})`;      // soft halo
          fillShape(ctx, path, m, r * m.s * 1.28);
          ctx.fillStyle = `rgba(0,0,0,${a})`;            // clean shape
          fillShape(ctx, path, m, r * m.s);
        }
      }
    }
    ctx.restore();
  }

  /** glowing strokes: layered soft halos + a bright core + a brighter centre */
  private paintNeon(ctx: CanvasRenderingContext2D) {
    const L = this.neonLayer;
    if (L.strokes.length === 0) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const st of L.strokes) {
      const p = NEON_PRESETS[st.style ?? "neon"];
      const g = clamp01(st.glow ?? 0.6);
      const [r, gr, b] = p.glow;
      const gs = p.glowScale;

      if (st.shape === "line") {
        const size = st.size * p.widthScale;
        const pts = linePoints(st);

        // outer glow -> inner glow (4 soft passes approximate a smooth falloff)
        const halos = [
          { k: 2.2 + 6.5 * g, a: (0.05 + 0.1 * g) * gs },
          { k: 1.7 + 3.8 * g, a: (0.09 + 0.15 * g) * gs },
          { k: 1.35 + 1.8 * g, a: (0.16 + 0.22 * g) * gs },
          { k: 1.12 + 0.7 * g, a: (0.3 + 0.25 * g) * gs },
        ];
        for (const h of halos) {
          ctx.strokeStyle = `rgba(${r},${gr},${b},${Math.min(1, h.a)})`;
          ctx.lineWidth = size * h.k;
          traceSmooth(ctx, pts);
          ctx.stroke();
        }
        ctx.strokeStyle = p.core;
        ctx.lineWidth = size;
        traceSmooth(ctx, pts);
        ctx.stroke();

        ctx.strokeStyle = p.centre;
        ctx.lineWidth = Math.max(1, size * 0.4);
        traceSmooth(ctx, pts);
        ctx.stroke();
      } else {
        // glowing hearts / stars / sparkles: halo outlines around each shape, then the shape itself
        const path = shapePath(st.shape);
        const rad = stampRadius(st.size) * p.widthScale;
        const halos = [
          { w: 0.9 + 1.6 * g, a: (0.06 + 0.1 * g) * gs },
          { w: 0.5 + 0.9 * g, a: (0.12 + 0.16 * g) * gs },
          { w: 0.26 + 0.4 * g, a: (0.25 + 0.25 * g) * gs },
        ];
        for (const m of st.stamps) {
          const rr = rad * m.s;
          for (const h of halos) {
            ctx.strokeStyle = `rgba(${r},${gr},${b},${Math.min(1, h.a)})`;
            strokeShape(ctx, path, m, rr, rr * h.w);
          }
          ctx.fillStyle = p.core;
          fillShape(ctx, path, m, rr);
          ctx.fillStyle = p.centre;
          fillShape(ctx, path, m, rr * 0.55);
        }
      }
    }
    ctx.restore();
  }

  /**
   * Renders fog + wiped lines + neon onto an internal canvas (video-native
   * size) and returns it, or null when there is nothing to show.
   * `source` is the <video>: the fog softly diffuses it, like real condensation.
   * The caller draws the result over the video with the SAME crop + mirroring
   * as the video. Pass `Infinity` for `now` for fully-formed lines (photos).
   */
  compose(now: number, source?: CanvasImageSource | null): HTMLCanvasElement | null {
    if (!this.hasContent()) return null;

    const ctx = this.fxCtx;
    ctx.clearRect(0, 0, this.w, this.h);

    if (this.fogOpacity() > 0) {
      if (this.dirty) this.refreshMask();
      this.condensation.paint(ctx, this.w, this.h, this.maskCanvas, source);
      this.eraseStrokes(ctx, now);
    }

    this.paintNeon(ctx);
    return this.fxCanvas;
  }
}
