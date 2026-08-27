export type FilterName =
  | "normal"
  | "blackWhite"
  | "warmVintage"
  | "polaroid"
  | "digicamSoftLight"
  | "coolTone";

export interface FilterSettings {
  exposure: number;
  brightness: number;
  contrast: number;

  highlights: number;
  shadows: number;

  saturation: number;
  vibrance: number;

  temperature: number;
  tint: number;

  grain: number;
}

export const filters: Record<
  FilterName,
  FilterSettings
> = {
  // =========================
  // NORMAL
  // =========================

  normal: {
    exposure: 0,
    brightness: 0,
    contrast: 0,

    highlights: 0,
    shadows: 0,

    saturation: 0,
    vibrance: 0,

    temperature: 0,
    tint: 0,

    grain: 0,
  },


  // =========================
  // BLACK & WHITE
  // =========================

  blackWhite: {
    exposure: 10,
    brightness: 0,
    contrast: 40,

    highlights: 0,
    shadows: 0,

    saturation: -100,
    vibrance: -100,

    temperature: 0,
    tint: 0,

    grain: 5,
  },


  // =========================
  // WARM VINTAGE
  // =========================

  warmVintage: {
    exposure: -10,
    brightness: 0,
    contrast: 50,

    highlights: -30,
    shadows: 15,

    saturation: -30,
    vibrance: -20,

    temperature: 10,
    tint: 5,

    grain: 12,
  },


  // =========================
  // POLAROID
  // =========================

  polaroid: {
    exposure: 30,
    brightness: 10,
    contrast: 30,

    highlights: -15,
    shadows: -30,

    saturation: -10,
    vibrance: 12,

    temperature: -10,
    tint: 0,

    grain: 10,
  },


  // =========================
  // DIGICAM SOFT LIGHT
  // =========================

  digicamSoftLight: {
    exposure: 20,
    brightness: 2,
    contrast: 2,

    highlights: -20,
    shadows: 12,

    saturation: -5,
    vibrance: 3,

    temperature: -4,
    tint: 2,

    grain: 5,
  },


  // =========================
  // COOL TONE
  // =========================

  coolTone: {
    exposure: 5,
    brightness: 0,
    contrast: 30,

    highlights: -5,
    shadows: 5,

    saturation: -22,
    vibrance: -10,

    temperature: -15,
    tint: 0,

    grain: 3,
  },
};