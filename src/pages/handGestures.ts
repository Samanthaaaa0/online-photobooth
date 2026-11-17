// handGestures.ts
// One gesture only: POINT (index finger out, other fingers folded) = draw.
//
// There is deliberately no pinch / palm / peace gesture any more: pinch used to "move the
// drawing" and kept firing by accident while drawing, so it was removed. Fewer gestures =
// nothing to trigger by mistake.

export type Pose = "none" | "point";

export interface LM {
  x: number;
  y: number;
}

export interface HandReading {
  pose: Pose;
  frames: number;  // how many frames in a row this pose has been held
  indexTip: LM;    // normalised 0..1
}

// A finger counts as "out" when its tip is this much farther from the wrist than its middle
// knuckle. The index must be clearly out, the other three only need to be NOT clearly out,
// so a relaxed, slightly curled hand still counts as pointing.
const INDEX_OUT = 1.15;
const OTHERS_FOLDED = 1.22;

export class GestureTracker {
  private lastPose: Pose = "none";
  private frames = 0;

  reset() {
    this.lastPose = "none";
    this.frames = 0;
  }

  read(hand: LM[], vw: number, vh: number): HandReading {
    const dist = (p: LM, q: LM) => Math.hypot((p.x - q.x) * vw, (p.y - q.y) * vh);
    const wrist = hand[0];
    const reach = (tip: number, pip: number) =>
      dist(hand[tip], wrist) / (dist(hand[pip], wrist) || 1);

    const pointing =
      reach(8, 6) > INDEX_OUT &&
      reach(12, 10) < OTHERS_FOLDED &&
      reach(16, 14) < OTHERS_FOLDED &&
      reach(20, 18) < OTHERS_FOLDED;

    const pose: Pose = pointing ? "point" : "none";
    this.frames = pose === this.lastPose ? this.frames + 1 : 1;
    this.lastPose = pose;

    return { pose, frames: this.frames, indexTip: hand[8] };
  }
}
