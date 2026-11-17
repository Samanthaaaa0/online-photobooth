// handTracker.ts
// One shared MediaPipe hand model, loaded on demand (the first time CAM LAB needs it, or a
// moment earlier when the button is hovered) and then kept, so reopening CAM LAB is instant.
// Only the hand model is loaded: nothing else on the site needs tracking any more.

import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let promise: Promise<HandLandmarker> | null = null;
let instance: HandLandmarker | null = null;

async function create(delegate: "GPU" | "CPU") {
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  return HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: "VIDEO",
    numHands: 1,
  });
}

/** starts loading (or returns the load already in progress / finished) */
export function loadHandTracker(): Promise<HandLandmarker> {
  if (!promise) {
    promise = (async () => {
      try {
        instance = await create("GPU");
      } catch {
        instance = await create("CPU"); // some machines have no usable GPU delegate
      }
      return instance;
    })().catch((err) => {
      promise = null; // allow a retry next time
      throw err;
    });
  }
  return promise;
}

/** the loaded model, or null while it is still loading */
export const getHandTracker = () => instance;
