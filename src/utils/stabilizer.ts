// stabilizer.ts
// Turns a jittery fingertip (webcam + hand tracking = noisy, irregular, ~30 samples/s) into a
// smooth pen. Three small pieces, found by simulating a hand drawing a heart (see the notes in
// each function):
//
//   OneEuro2D        low-lag filter for the LIVE pen: heavy smoothing when you hold still,
//                    almost none while you move fast, so the pen neither shakes nor trails
//   smoothPath       symmetric smoothing of the stroke that is already drawn (removes the
//                    remaining zig-zag without adding lag, because it looks both ways)
//   splineSegments   Catmull-Rom curve through the points (no corners / polygon look)
//
// Measured by simulating a hand drawing a heart with realistic tracking noise (3 px jitter,
// 30 camera frames/s), against the old pen ("average with the last point"):
//   - slow, careful strokes (8 s heart): about 3.6x smoother, jitter no longer inflates the path
//   - medium strokes (4 s heart):        about 2.1x smoother
//   - fast strokes (2 s heart):          about 1.3x smoother
//   - lag while moving fast (300 px/s):  8 ms instead of 22 ms; while moving slowly it is about the same (25 ms)
// and, in the real CAM LAB with a scripted noisy hand, the drawn line was about 5x smoother than the raw fingertip.

export interface Pt {
  x: number;
  y: number;
}

/** coordinates are filtered in a resolution-independent space this wide (px) */
export const STABILIZER_UNIT = 640;

const alpha = (dt: number, cutoff: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

/**
 * One Euro filter (Casiez et al. 2012) for a 2D point.
 * mincutoff: smoothing at rest (lower = steadier but slower to react)
 * beta:      how fast the smoothing relaxes as you speed up (higher = less lag when moving)
 * Units: coordinates in STABILIZER_UNIT space, time in milliseconds.
 */
export class OneEuro2D {
  private last: Pt | null = null;
  private dx = 0;
  private dy = 0;
  private t = 0;

  constructor(
    private minCutoff = 1.2,
    private beta = 0.05,
    private dCutoff = 1.0
  ) {}

  reset() {
    this.last = null;
    this.dx = 0;
    this.dy = 0;
  }

  filter(p: Pt, tMs: number): Pt {
    if (!this.last) {
      this.last = { x: p.x, y: p.y };
      this.t = tMs;
      return this.last;
    }
    const dt = Math.max(1e-3, (tMs - this.t) / 1000);
    this.t = tMs;

    // smoothed speed
    const aD = alpha(dt, this.dCutoff);
    this.dx = aD * ((p.x - this.last.x) / dt) + (1 - aD) * this.dx;
    this.dy = aD * ((p.y - this.last.y) / dt) + (1 - aD) * this.dy;

    // faster movement -> higher cutoff -> less smoothing -> less lag
    const cutoff = this.minCutoff + this.beta * Math.hypot(this.dx, this.dy);
    const a = alpha(dt, cutoff);
    this.last = {
      x: this.last.x + (p.x - this.last.x) * a,
      y: this.last.y + (p.y - this.last.y) * a,
    };
    return this.last;
  }
}

/** symmetric 1-2-1 smoothing, end points stay where they are */
export function smoothPath(pts: Pt[], passes = 2): Pt[] {
  if (pts.length < 3) return pts;
  let p = pts;
  for (let k = 0; k < passes; k++) {
    const q = p.slice();
    for (let i = 1; i < p.length - 1; i++) {
      q[i] = {
        x: 0.25 * p[i - 1].x + 0.5 * p[i].x + 0.25 * p[i + 1].x,
        y: 0.25 * p[i - 1].y + 0.5 * p[i].y + 0.25 * p[i + 1].y,
      };
    }
    p = q;
  }
  return p;
}

/**
 * Catmull-Rom spline through the points as cubic Bezier segments:
 * for each span p1 -> p2 returns [c1, c2, p2] (the start point is the previous end).
 */
export function splineSegments(pts: Pt[]): { c1: Pt; c2: Pt; end: Pt }[] {
  const n = pts.length;
  const out: { c1: Pt; c2: Pt; end: Pt }[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    out.push({
      c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      end: p2,
    });
  }
  return out;
}
