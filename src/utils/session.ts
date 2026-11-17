// session.ts
// The two numbers that shape a photobooth session. Change them here and every page follows.

export type LayoutType = "4-cuts" | "6-cuts" | "meme";

/** how many photos the camera takes in one session (more than the strip needs, so there is choice) */
export const PHOTOS_PER_SESSION = 8;

/** how many of those photos go on the strip, per layout */
export const PICKS_PER_LAYOUT: Record<LayoutType, number> = {
  "4-cuts": 4,
  "6-cuts": 6,
  meme: 6,
};

export const picksFor = (layout: LayoutType | null) =>
  layout ? PICKS_PER_LAYOUT[layout] : PICKS_PER_LAYOUT["4-cuts"];
