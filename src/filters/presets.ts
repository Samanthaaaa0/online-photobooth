// presets.ts
// Photobooth looks. Every filter is just a bag of numbers read by
// utils/applyFilter.ts, so tweaking a look = editing numbers here.
//
// The first block is the original tone controls (unchanged meaning).
// The second block is what makes a look feel VINTAGE instead of just
// "color-corrected": faded blacks, tinted shadows/highlights, soft glow,
// vignette, light leaks, lens fringing and film grain.

export type FilterName =
  | "normal"
  | "boothBW"
  | "sepia"
  | "polaroid"
  | "disposable"
  | "y2kFlash"
  | "coolChrome";

type RGB = [number, number, number];

export interface FilterSettings {
  // ---- tone ----
  exposure: number;
  brightness: number;
  contrast: number;
  highlights: number;
  shadows: number;

  // ---- colour ----
  saturation: number;
  vibrance: number;
  temperature: number;
  tint: number;

  // ---- vintage ----
  fadeBlack: number;     // 0..60  lifts the blacks (matte, faded print)
  fadeWhite: number;     // 0..40  lowers the white point (never pure white)
  mono: number;          // 0..1   black & white amount
  monoTint: RGB;         // colour of the monochrome (sepia, warm silver...)
  shadowTint: RGB;       // colour pushed into the shadows
  shadowAmount: number;  // 0..1
  highlightTint: RGB;    // colour pushed into the highlights
  highlightAmount: number; // 0..1

  // ---- lens + film ----
  bloom: number;         // 0..1   soft glow from bright areas
  bloomColor: RGB;
  vignette: number;      // 0..1   dark corners
  leak: number;          // 0..1   light leak strength
  leakColor: RGB;
  leakSide: "left" | "right" | "top" | "bottom";
  aberration: number;    // px of red/blue fringing at the edges
  grain: number;         // 0..60  film grain
  dateStamp: boolean;    // orange digicam date in the corner
}

const WHITE: RGB = [255, 255, 255];
const NEUTRAL: RGB = [128, 128, 128];

const base: FilterSettings = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  saturation: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,

  fadeBlack: 0,
  fadeWhite: 0,
  mono: 0,
  monoTint: WHITE,
  shadowTint: NEUTRAL,
  shadowAmount: 0,
  highlightTint: NEUTRAL,
  highlightAmount: 0,

  bloom: 0,
  bloomColor: WHITE,
  vignette: 0,
  leak: 0,
  leakColor: [255, 120, 40],
  leakSide: "right",
  aberration: 0,
  grain: 0,
  dateStamp: false,
};

export const filters: Record<FilterName, FilterSettings> = {
  // untouched
  normal: { ...base },

  // the classic strip from a real booth: contrasty, slightly warm silver,
  // soft glow on the highlights, heavy grain, darker corners
  boothBW: {
    ...base,
    exposure: 8,
    contrast: 38,
    highlights: -10,
    shadows: 6,
    mono: 1,
    monoTint: [255, 247, 236],
    fadeBlack: 14,
    fadeWhite: 8,
    bloom: 0.28,
    vignette: 0.42,
    grain: 26,
  },

  // faded brown print from an old album
  sepia: {
    ...base,
    exposure: 4,
    contrast: 28,
    highlights: -12,
    mono: 1,
    monoTint: [255, 224, 184],
    shadowTint: [60, 30, 10],
    shadowAmount: 0.5,
    fadeBlack: 26,
    fadeWhite: 14,
    bloom: 0.22,
    vignette: 0.5,
    grain: 22,
  },

  // faded instant film: lifted blacks, warm cream highlights, teal shadows
  polaroid: {
    ...base,
    exposure: 14,
    contrast: -4,
    highlights: -18,
    shadows: 14,
    saturation: -12,
    vibrance: 14,
    temperature: 8,
    fadeBlack: 30,
    fadeWhite: 16,
    shadowTint: [30, 95, 100],
    shadowAmount: 0.55,
    highlightTint: [255, 226, 160],
    highlightAmount: 0.5,
    bloom: 0.3,
    bloomColor: [255, 232, 200],
    vignette: 0.32,
    grain: 14,
  },

  // single-use camera + flash: punchy colour, green shadows, warm leak,
  // orange date stamp
  disposable: {
    ...base,
    exposure: 10,
    contrast: 34,
    highlights: -8,
    saturation: 14,
    vibrance: 8,
    temperature: 6,
    tint: -4,
    fadeBlack: 10,
    shadowTint: [20, 90, 80],
    shadowAmount: 0.45,
    highlightTint: [255, 214, 150],
    highlightAmount: 0.35,
    bloom: 0.24,
    bloomColor: [255, 220, 190],
    vignette: 0.45,
    leak: 1.0,
    leakColor: [255, 95, 25],
    leakSide: "right",
    grain: 28,
    dateStamp: true,
  },

  // early-2000s digicam with the built-in flash: bright, a little blown out,
  // cool blue-white cast, magenta pop, glowy, tiny lens fringing
  y2kFlash: {
    ...base,
    exposure: 26,
    brightness: 4,
    contrast: 26,
    highlights: -6,
    saturation: -8,
    vibrance: 6,
    temperature: -12,
    tint: 4,
    fadeBlack: 12,
    shadowTint: [40, 70, 150],
    shadowAmount: 0.5,
    highlightTint: [255, 190, 235],
    highlightAmount: 0.3,
    bloom: 0.42,
    bloomColor: [235, 240, 255],
    vignette: 0.2,
    aberration: 1.6,
    grain: 9,
  },

  // icy silver-blue, like a chrome digicam
  coolChrome: {
    ...base,
    exposure: 8,
    contrast: 30,
    highlights: -6,
    saturation: -36,
    vibrance: -4,
    temperature: -20,
    fadeBlack: 10,
    fadeWhite: 6,
    shadowTint: [20, 60, 130],
    shadowAmount: 0.6,
    highlightTint: [190, 235, 255],
    highlightAmount: 0.4,
    bloom: 0.3,
    bloomColor: [215, 238, 255],
    vignette: 0.3,
    aberration: 0.8,
    grain: 10,
  },
};

/** order + names shown in the Editor */
export const filterList: { id: FilterName; label: string }[] = [
  { id: "normal", label: "NORMAL" },
  { id: "boothBW", label: "BOOTH B&W" },
  { id: "sepia", label: "SEPIA 98" },
  { id: "polaroid", label: "POLAROID" },
  { id: "disposable", label: "DISPOSABLE" },
  { id: "y2kFlash", label: "Y2K FLASH" },
  { id: "coolChrome", label: "COOL CHROME" },
];
