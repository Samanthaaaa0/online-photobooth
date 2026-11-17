// cameraGeometry.ts
// SINGLE SOURCE OF TRUTH for where the live camera sits inside the camera
// frame artwork. Both the CSS (via CSS variables) and the photo capture code
// read these numbers, so the preview and the saved photo can never disagree.
//
// How the numbers were obtained (not guessed): the transparent opening of
// assets/cameraframe.png was measured from the PNG's alpha channel.
//   art size            : 931 x 624 px
//   opening (alpha<50%) : x 74..474, y 243..542  ->  401 x 300 px  (~4:3)
// The camera box is the opening grown by BLEED px on every side so the video
// tucks UNDER the opaque bezel (the frame image is drawn on top). That way
// the anti-aliased bezel edge blends into the video instead of showing a gap.
//
// If you ever swap the frame artwork, re-measure these four numbers; nothing
// else needs to change.

import type { CSSProperties } from "react";

export const FRAME_ART = { width: 931, height: 624 };

const APERTURE = { x: 74, y: 243, w: 401, h: 300 };
const BLEED = 2;

export const CAMERA_WINDOW = {
  x: APERTURE.x - BLEED,
  y: APERTURE.y - BLEED,
  w: APERTURE.w + BLEED * 2,
  h: APERTURE.h + BLEED * 2,
};

/** width / height of the camera box (the aspect the video is cropped to). */
export const CAMERA_WINDOW_ASPECT = CAMERA_WINDOW.w / CAMERA_WINDOW.h;

const pct = (value: number, total: number) => `${((value / total) * 100).toFixed(4)}%`;

/** Put this on the .camera-frame element: it feeds the CSS variables that
 *  size and position the video, canvases and frame art. */
export const CAMERA_FRAME_STYLE = {
  "--frame-ratio": (FRAME_ART.width / FRAME_ART.height).toFixed(5),
  "--win-l": pct(CAMERA_WINDOW.x, FRAME_ART.width),
  "--win-t": pct(CAMERA_WINDOW.y, FRAME_ART.height),
  "--win-w": pct(CAMERA_WINDOW.w, FRAME_ART.width),
  "--win-h": pct(CAMERA_WINDOW.h, FRAME_ART.height),
} as CSSProperties;

/**
 * The part of a (srcW x srcH) image that `object-fit: cover` shows inside a
 * box of the given aspect ratio (centered, like object-position: 50% 50%).
 * Using this for photos guarantees the photo matches the live preview crop.
 */
export function coverCrop(srcW: number, srcH: number, destAspect: number) {
  const srcAspect = srcW / srcH;
  let sw = srcW;
  let sh = srcH;
  if (srcAspect > destAspect) {
    sw = srcH * destAspect; // source is wider: crop the sides
  } else {
    sh = srcW / destAspect; // source is taller: crop top and bottom
  }
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh };
}
