// noise.ts: tiny deterministic value-noise helpers shared by the fog engine
// and the condensation texture.

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function smoothstep(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** random-looking but repeatable number 0..1 for an integer cell */
export function hash(ix: number, iy: number, seed: number) {
  let h =
    Math.imul(ix, 374761393) ^
    Math.imul(iy, 668265263) ^
    Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function valueNoise(x: number, y: number, seed: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** 3-octave fractal noise, roughly 0..1 */
export function fbm(x: number, y: number, seed: number) {
  return (
    valueNoise(x, y, seed) * 0.55 +
    valueNoise(x * 2.1, y * 2.1, seed + 1) * 0.3 +
    valueNoise(x * 4.3, y * 4.3, seed + 2) * 0.15
  );
}
