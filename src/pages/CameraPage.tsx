import { useEffect, useRef, useState } from "react";
import cameraFrame from "../assets/cameraframe.png";
import startbutton from "../assets/startbutton.png";
import {
  FaceLandmarker,
  HandLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

import "../CameraPage.css";

type LayoutType =
  | "4-cuts"
  | "6-cuts"
  | "meme";

type CameraPageProps = {
  layout: LayoutType | null;
  onComplete: (photos: string[]) => void;
};

// ---- FOG TUNING -------------------------------------------------
const FOG_GRID_W = 160;      // resolution of the fog map
const FOG_MAX = 0.9;         // fog opacity (flat everywhere = matte)
const FOG_SPREAD = 0.4;      // how fast fog spreads while mouth is open (bigger = faster)
const FOG_EDGE = 14;         // softness of the spreading fog edge (grid cells)
const FOG_COLOR = [233, 236, 241]; // matte grey-white (r, g, b)

// brush width in video pixels for slider value 1..10
const brushWidthFor = (value: number, videoWidth: number) =>
  videoWidth * (0.003 + value * 0.005);

// one drawn line (points are stored in "drawing space", so the whole
// drawing can be moved without touching the fog)
type Stroke = { size: number; points: { x: number; y: number }[] };

// cheap drifting noise (0..1) so the fog looks wispy instead of a flat blob
function fogNoise(x: number, y: number, t: number) {
  return (
    0.5 +
    0.25 * Math.sin(x * 0.17 + t * 0.0006) * Math.cos(y * 0.21 - t * 0.0005) +
    0.25 * Math.sin((x + y) * 0.09 + t * 0.0003)
  );
}

function CameraPage({
  onComplete,
}: CameraPageProps) {
  // set up camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraStarted, setCameraStarted] = useState(false);
  const isFrontCamera = true;

  // set up countdown timer
  const [timer, setTimer] = useState(0);

  // set up photos
  const [photos, setPhotos] = useState<string[]>([]);

  // set up background colour
  const [vibe, setVibe] = useState("black");

  // set up picture capturing
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isTakingPhotos, setIsTakingPhotos] = useState(false);

  const [sessionComplete, setSessionComplete] = useState(false);

  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);

  const [flash, setFlash] = useState(false);

  // set up fog / finger tracking
  const fogCanvasRef = useRef<HTMLCanvasElement>(null);
  const fingerCanvasRef = useRef<HTMLCanvasElement>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);

  // fog on/off (OFF by default) + hint state
  const [fogEnabled, setFogEnabled] = useState(false);
  const [hasTriedFog, setHasTriedFog] = useState(false);
  const fogEnabledRef = useRef(false); // mirror for the animation loop

  // brush size (1..10, thin by default) + undo availability
  const [brushSize, setBrushSize] = useState(2);
  const brushSizeRef = useRef(2);
  const [strokeCount, setStrokeCount] = useState(0);

  // fog map (opacity 0..1 per cell) + helper canvas
  const densityRef = useRef<Float32Array | null>(null);
  const gridRef = useRef({ w: 0, h: 0 });
  const densityCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const densityImageRef = useRef<ImageData | null>(null);
  const lastFrameRef = useRef(0);

  // fog spreading from the mouth
  const fogReachRef = useRef(0);
  const fogOriginRef = useRef<{ x: number; y: number } | null>(null);
  const fogActiveRef = useRef(false); // fog map still changing

  // drawing (separate from the fog)
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 }); // moves the drawing only
  const dragLastRef = useRef<{ x: number; y: number } | null>(null);
  const smoothPtRef = useRef<{ x: number; y: number } | null>(null);

  // gestures
  const pinchingRef = useRef(false); // thumb + index touching = move drawing
  const pointFramesRef = useRef(0);  // frames in a row the "point" pose was held


  // START CAMERA WHEN PAGE LOADS
  useEffect(() => {
    startCamera();

    return () => {
      stopCamera();
    };
  }, []);


  // LOAD FACE + HAND MODELS ONCE
  useEffect(() => {
    let cancelled = false;

    async function initModels() {
      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );

      const faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1,
      });

      const handLandmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
      });

      if (cancelled) return;
      faceLandmarkerRef.current = faceLandmarker;
      handLandmarkerRef.current = handLandmarker;
    }

    initModels();

    return () => {
      cancelled = true;
      faceLandmarkerRef.current?.close();
      handLandmarkerRef.current?.close();
    };
  }, []);


  // DETECTION + DRAWING LOOP (only does real work while fog is ON)
  useEffect(() => {
    if (!cameraStarted) return;

    const detect = () => {
      const video = videoRef.current;
      const fogCanvas = fogCanvasRef.current;
      const fingerCanvas = fingerCanvasRef.current;
      const faceLandmarker = faceLandmarkerRef.current;
      const handLandmarker = handLandmarkerRef.current;

      if (
        fogEnabledRef.current &&
        video &&
        fogCanvas &&
        fingerCanvas &&
        faceLandmarker &&
        handLandmarker &&
        video.videoWidth > 0
      ) {
        // Canvases match the video's native size so object-fit: cover
        // crops them exactly like the video.
        if (
          fogCanvas.width !== video.videoWidth ||
          fogCanvas.height !== video.videoHeight
        ) {
          fogCanvas.width = video.videoWidth;
          fogCanvas.height = video.videoHeight;
        }
        if (
          fingerCanvas.width !== video.videoWidth ||
          fingerCanvas.height !== video.videoHeight
        ) {
          fingerCanvas.width = video.videoWidth;
          fingerCanvas.height = video.videoHeight;
        }

        const vw = fogCanvas.width;
        const vh = fogCanvas.height;

        // ---- (re)build the fog map if needed ----
        const gw = FOG_GRID_W;
        const gh = Math.max(1, Math.round((gw * vh) / vw));

        if (
          !densityRef.current ||
          gridRef.current.w !== gw ||
          gridRef.current.h !== gh
        ) {
          densityRef.current = new Float32Array(gw * gh);
          gridRef.current = { w: gw, h: gh };

          const dc = document.createElement("canvas");
          dc.width = gw;
          dc.height = gh;
          densityCanvasRef.current = dc;
          const img = dc.getContext("2d")!.createImageData(gw, gh);
          for (let i = 0; i < gw * gh; i++) {
            img.data[i * 4] = FOG_COLOR[0];
            img.data[i * 4 + 1] = FOG_COLOR[1];
            img.data[i * 4 + 2] = FOG_COLOR[2];
            img.data[i * 4 + 3] = 0;
          }
          densityImageRef.current = img;
          fogOriginRef.current = null;
          fogReachRef.current = 0;
        }

        const density = densityRef.current!;
        const densityCanvas = densityCanvasRef.current!;
        const densityImage = densityImageRef.current!;

        const fogCtx = fogCanvas.getContext("2d")!;
        const fingerCtx = fingerCanvas.getContext("2d")!;
        const now = performance.now();
        const dt = Math.min(
          0.05,
          Math.max(0, (now - lastFrameRef.current) / 1000)
        );
        lastFrameRef.current = now;

        const faceResult = faceLandmarker.detectForVideo(video, now);
        const handResult = handLandmarker.detectForVideo(video, now);

        // ---- Mouth open -> fog slowly spreads until it covers everything ----
        let jawOpen = 0;
        let mouthNx: number | null = null;
        let mouthNy: number | null = null;

        if (faceResult.faceLandmarks.length > 0) {
          const lm = faceResult.faceLandmarks[0];
          mouthNx = (lm[13].x + lm[14].x) / 2;
          mouthNy = (lm[13].y + lm[14].y) / 2;
        }

        if (faceResult.faceBlendshapes?.length) {
          const jaw = faceResult.faceBlendshapes[0].categories.find(
            (c) => c.categoryName === "jawOpen"
          );
          jawOpen = jaw ? jaw.score : 0;
        }

        const maxReach = Math.hypot(gw, gh) * 1.15;

        if (
          jawOpen > 0.1 &&
          mouthNx !== null &&
          mouthNy !== null &&
          fogReachRef.current < maxReach + FOG_EDGE
        ) {
          if (!fogOriginRef.current) {
            fogOriginRef.current = { x: mouthNx * gw, y: mouthNy * gh };
          }
          fogReachRef.current += gw * FOG_SPREAD * jawOpen * dt;
          fogActiveRef.current = true;
        }

        let fogChanged = false;
        const origin = fogOriginRef.current;

        if (origin && fogActiveRef.current) {
          const reach = fogReachRef.current;
          const grow = 0.15 * dt * 60; // fade-in speed per cell

          for (let y = 0; y < gh; y++) {
            for (let x = 0; x < gw; x++) {
              const d = Math.hypot(x - origin.x, y - origin.y);
              // wobbly edge so the fog front looks natural
              const edgeVal = reach * (0.92 + 0.16 * fogNoise(x, y, 0)) - d;
              if (edgeVal <= 0) continue;

              const target = Math.min(1, edgeVal / FOG_EDGE) * FOG_MAX;
              const i = y * gw + x;
              if (density[i] < target) {
                density[i] = Math.min(target, density[i] + grow);
                fogChanged = true;
              }
            }
          }
          fogActiveRef.current = fogChanged;
        }

        if (fogChanged) {
          const px = densityImage.data;
          for (let i = 0; i < density.length; i++) {
            px[i * 4 + 3] = density[i] * 255;
          }
          densityCanvas.getContext("2d")!.putImageData(densityImage, 0, 0);
        }

        // ---- Hand gestures ----
        fingerCtx.clearRect(0, 0, fingerCanvas.width, fingerCanvas.height);

        if (handResult.landmarks.length > 0) {
          const hand = handResult.landmarks[0];
          const wrist = hand[0];
          const thumb = hand[4];
          const index = hand[8];

          const dist = (
            p: { x: number; y: number },
            q: { x: number; y: number }
          ) => Math.hypot((p.x - q.x) * vw, (p.y - q.y) * vh);

          // a finger is "straight" when its tip is clearly farther from the
          // wrist than its middle knuckle
          const isExtended = (tipI: number, pipI: number, k: number) =>
            dist(hand[tipI], wrist) > dist(hand[pipI], wrist) * k;

          // POINT: index straight, middle / ring / pinky curled into a fist
          const pointing =
            isExtended(8, 6, 1.2) &&
            !isExtended(12, 10, 1.1) &&
            !isExtended(16, 14, 1.1) &&
            !isExtended(20, 18, 1.1);

          // PINCH: thumb tip touching index tip (relative to hand size)
          const handSize = dist(wrist, hand[9]) || 1;
          const pinchRatio = dist(thumb, index) / handSize;
          if (pinchingRef.current) {
            if (pinchRatio > 0.45) pinchingRef.current = false;
          } else if (pinchRatio < 0.25) {
            pinchingRef.current = true;
          }

          // hold the point pose for 2 frames -> no accidental flicker
          pointFramesRef.current =
            pointing && !pinchingRef.current
              ? Math.min(5, pointFramesRef.current + 1)
              : 0;
          const drawing = pointFramesRef.current >= 2;

          if (pinchingRef.current) {
            // ===== MOVE THE DRAWING (fog stays where it is) =====
            currentStrokeRef.current = null;
            smoothPtRef.current = null;

            const midX = ((thumb.x + index.x) / 2) * vw;
            const midY = ((thumb.y + index.y) / 2) * vh;
            const last = dragLastRef.current;
            if (last) {
              dragOffsetRef.current.x += midX - last.x;
              dragOffsetRef.current.y += midY - last.y;
            }
            dragLastRef.current = { x: midX, y: midY };

            fingerCtx.lineWidth = 3;
            fingerCtx.strokeStyle = "rgba(255, 79, 163, 0.9)";
            fingerCtx.beginPath();
            fingerCtx.moveTo(thumb.x * vw, thumb.y * vh);
            fingerCtx.lineTo(index.x * vw, index.y * vh);
            fingerCtx.stroke();

            fingerCtx.beginPath();
            fingerCtx.arc(midX, midY, 11, 0, Math.PI * 2);
            fingerCtx.fillStyle = "#ff4fa3";
            fingerCtx.shadowColor = "rgba(255, 79, 163, 0.9)";
            fingerCtx.shadowBlur = 12;
            fingerCtx.fill();
            fingerCtx.shadowBlur = 0;
          } else {
            dragLastRef.current = null;

            if (drawing) {
              // ===== DRAW: index fingertip clears a line in the fog =====
              const raw = { x: index.x * vw, y: index.y * vh };
              const prev = smoothPtRef.current;
              // light smoothing so the line isn't jittery
              const sp = prev
                ? {
                    x: prev.x + (raw.x - prev.x) * 0.6,
                    y: prev.y + (raw.y - prev.y) * 0.6,
                  }
                : raw;
              smoothPtRef.current = sp;

              const gx = Math.min(gw - 1, Math.max(0, Math.floor((sp.x / vw) * gw)));
              const gy = Math.min(gh - 1, Math.max(0, Math.floor((sp.y / vh) * gh)));
              const onFog = density[gy * gw + gx] > 0.35; // can only draw on fog

              const size = brushWidthFor(brushSizeRef.current, vw);

              if (onFog) {
                const off = dragOffsetRef.current;
                const pt = { x: sp.x - off.x, y: sp.y - off.y };
                const stroke = currentStrokeRef.current;

                if (!stroke) {
                  const fresh: Stroke = { size, points: [pt] };
                  strokesRef.current.push(fresh);
                  currentStrokeRef.current = fresh;
                  setStrokeCount(strokesRef.current.length);
                } else {
                  const lp = stroke.points[stroke.points.length - 1];
                  if (Math.hypot(pt.x - lp.x, pt.y - lp.y) > 1.5) {
                    stroke.points.push(pt);
                  }
                }
              } else {
                currentStrokeRef.current = null;
              }

              // brush preview: ring shows the real brush size
              fingerCtx.lineWidth = 2;
              fingerCtx.strokeStyle = onFog
                ? "rgba(64, 224, 208, 0.95)"
                : "rgba(255, 255, 255, 0.5)";
              fingerCtx.beginPath();
              fingerCtx.arc(sp.x, sp.y, Math.max(5, size / 2 + 2), 0, Math.PI * 2);
              fingerCtx.stroke();
            } else {
              // idle: faint ring, nothing is drawn
              currentStrokeRef.current = null;
              smoothPtRef.current = null;
              fingerCtx.lineWidth = 3;
              fingerCtx.strokeStyle = "rgba(255, 255, 255, 0.55)";
              fingerCtx.beginPath();
              fingerCtx.arc(index.x * vw, index.y * vh, 9, 0, Math.PI * 2);
              fingerCtx.stroke();
            }
          }
        } else {
          pinchingRef.current = false;
          pointFramesRef.current = 0;
          dragLastRef.current = null;
          smoothPtRef.current = null;
          currentStrokeRef.current = null;
        }

        // ---- Render: matte fog, then the drawing erases it ----
        fogCtx.clearRect(0, 0, vw, vh);

        if (fogOriginRef.current) {
          fogCtx.imageSmoothingEnabled = true;
          fogCtx.imageSmoothingQuality = "high";
          fogCtx.drawImage(densityCanvas, 0, 0, vw, vh);

          const strokes = strokesRef.current;
          if (strokes.length > 0) {
            const ox = dragOffsetRef.current.x;
            const oy = dragOffsetRef.current.y;

            fogCtx.save();
            fogCtx.globalCompositeOperation = "destination-out";
            fogCtx.lineCap = "round";
            fogCtx.lineJoin = "round";

            // pass 1 = soft halo, pass 2 = clean core
            for (const pass of [
              { k: 1.7, a: 0.3 },
              { k: 1, a: 1 },
            ]) {
              fogCtx.strokeStyle = `rgba(0,0,0,${pass.a})`;
              for (const st of strokes) {
                fogCtx.lineWidth = st.size * pass.k;
                fogCtx.beginPath();
                const first = st.points[0];
                fogCtx.moveTo(first.x + ox, first.y + oy);
                if (st.points.length === 1) {
                  fogCtx.lineTo(first.x + ox + 0.01, first.y + oy);
                }
                for (let i = 1; i < st.points.length; i++) {
                  fogCtx.lineTo(st.points[i].x + ox, st.points[i].y + oy);
                }
                fogCtx.stroke();
              }
            }
            fogCtx.restore();
          }
        }
      }

      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cameraStarted]);


  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      // Camera page may have disappeared while permission was loading
      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      videoRef.current.srcObject = stream;

      setCameraStarted(true);

    } catch (error) {
      console.error("Could not access camera:", error);
      setCameraStarted(false);
    }
  };

  const stopCamera = () => {
    console.log("STOPPING CAMERA");

    // Stop every track
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
    }

    // Disconnect video from camera
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setCameraStarted(false);
  };


  const takePhoto = (): string | null => {
    const video = videoRef.current;

    if (!video) return null;

    const canvas = document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) return null;

    if (isFrontCamera) {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // include the fog + drawing in the photo (same mirroring as the video)
    const fogCanvas = fogCanvasRef.current;
    if (
      fogEnabledRef.current &&
      fogCanvas &&
      fogCanvas.width === canvas.width &&
      fogCanvas.height === canvas.height
    ) {
      context.drawImage(fogCanvas, 0, 0, canvas.width, canvas.height);
    }

    return canvas.toDataURL("image/png");
  };

  const runCountdown = async (
    photoIndex?: number
  ): Promise<string | null> => {

    for (let count = timer; count >= 1; count--) {
      setCountdown(count);

      await new Promise((resolve) =>
        setTimeout(resolve, 1000)
      );
    }

    triggerFlash();

    const photo = takePhoto();

    if (photo) {
      setPhotos((prev) => {

        if (photoIndex === undefined) {
          return [...prev, photo];
        }

        const updated = [...prev];

        updated[photoIndex] = photo;

        return updated;
      });
    }

    setCountdown(null);

    return photo;
  };

  const startPhotoSession = async () => {
    if (isTakingPhotos) return;

    setIsTakingPhotos(true);
    setPhotos([]);
    setSessionComplete(false);

    const numberOfPhotos = 6;

    const newPhotos: string[] = [];

    for (let i = 0; i < numberOfPhotos; i++) {

      const photo = await runCountdown();

      if (photo) {
        newPhotos.push(photo);
      }

      // Small pause between photos
      if (i < numberOfPhotos - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000)
        );
      }
    }

    setPhotos(newPhotos);

    setIsTakingPhotos(false);
    setSessionComplete(true);

    // Send the six photos to App.tsx
    // onComplete(newPhotos);
  };

  const startRetake = async (photoIndex: number) => {
    if (isTakingPhotos) return;

    setIsTakingPhotos(true);
    setSelectedPhoto(null);

    await runCountdown(photoIndex);

    setIsTakingPhotos(false);
  };

  const triggerFlash = () => {
    setFlash(true);

    setTimeout(() => {
      setFlash(false);
    }, 180);
  };

  const finishCamera = () => {
    stopCamera();
    onComplete(photos);
  };

  // wipes the fog AND the drawing
  const clearFog = () => {
    densityRef.current?.fill(0);
    const img = densityImageRef.current;
    if (img) {
      for (let i = 3; i < img.data.length; i += 4) img.data[i] = 0;
      densityCanvasRef.current
        ?.getContext("2d")
        ?.putImageData(img, 0, 0);
    }

    fogReachRef.current = 0;
    fogOriginRef.current = null;
    fogActiveRef.current = false;

    strokesRef.current = [];
    currentStrokeRef.current = null;
    dragOffsetRef.current = { x: 0, y: 0 };
    dragLastRef.current = null;
    smoothPtRef.current = null;
    pinchingRef.current = false;
    pointFramesRef.current = 0;
    setStrokeCount(0);

    const fog = fogCanvasRef.current;
    fog?.getContext("2d")?.clearRect(0, 0, fog.width, fog.height);
    const finger = fingerCanvasRef.current;
    finger?.getContext("2d")?.clearRect(0, 0, finger.width, finger.height);
  };

  // removes the last line you drew
  const undoStroke = () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current.pop();
    currentStrokeRef.current = null;
    setStrokeCount(strokesRef.current.length);
  };

  const changeBrush = (value: number) => {
    brushSizeRef.current = value;
    setBrushSize(value);
  };

  const toggleFog = () => {
    const next = !fogEnabled;
    fogEnabledRef.current = next;
    setFogEnabled(next);
    setHasTriedFog(true);
    if (!next) clearFog(); // turning off removes the fog + drawing
  };

  // Ctrl/Cmd + Z = undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undoStroke();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
    {flash && (
      <div className="camera-flash" />
    )}

    <div className="camera-topbar">

      <span>
        ✦ PHOTOBOOTH.EXE
      </span>

      <span>
        DIGITAL CAM 2000
      </span>

      <span className="rec-status">
        {isTakingPhotos
          ? "● CAPTURING"
          : sessionComplete
            ? "● REVIEW"
            : "● READY"}
      </span>

    </div>
    
    <div className={`camera-page vibe-${vibe}`}>

        {/* LEFT SETTINGS */}

        <aside className="camera-settings">

          <div className="settings-section">

            <div className="settings-label">
              COUNTDOWN
            </div>

            <div className="timer-options">

              {[1, 5, 10].map((seconds) => (
                <button
                  key={seconds}
                  className={timer === seconds ? "selected" : ""}
                  onClick={() => setTimer(seconds)}
                  disabled={isTakingPhotos}
                  
                >
                  {seconds}s
                </button>
              ))}

            </div>

          </div>


          <div className="settings-section">

            <div className="settings-label">
              VIBE
            </div>

            <div className="vibe-options">

              <button
                className={`vibe-swatch pink ${
                  vibe === "pink" ? "selected" : ""
                }`}
                onClick={() => setVibe("pink")}
                aria-label="Pink vibe"
              >
                <span className="vibe-dot" />
                <span className="vibe-name">PINK</span>
              </button>

              <button
                className={`vibe-swatch blue ${
                  vibe === "blue" ? "selected" : ""
                }`}
                onClick={() => setVibe("blue")}
                aria-label="Blue vibe"
              >
                <span className="vibe-dot" />
                <span className="vibe-name">BLUE</span>
              </button>

              <button
                className={`vibe-swatch white ${
                  vibe === "white" ? "selected" : ""
                }`}
                onClick={() => setVibe("white")}
                aria-label="White vibe"
              >
                <span className="vibe-dot" />
                <span className="vibe-name">WHITE</span>
              </button>

              <button
                className={`vibe-swatch black ${
                  vibe === "black" ? "selected" : ""
                }`}
                onClick={() => setVibe("black")}
                aria-label="Black vibe"
              >
                <span className="vibe-dot" />
                <span className="vibe-name">BLACK</span>
              </button>

            </div>

          </div>


          <div className="settings-section">

            <div className="settings-label">
              FOG
            </div>

            <button
              className={`fog-toggle ${fogEnabled ? "on" : ""} ${
                !hasTriedFog ? "invite" : ""
              }`}
              onClick={toggleFog}
              aria-pressed={fogEnabled}
            >
              <span className="fog-toggle-icon">☁</span>
              <span>{fogEnabled ? "ON" : "OFF"}</span>
              {!hasTriedFog && <span className="fog-badge">TRY ME!</span>}
            </button>

            <p className={`fog-hint ${!hasTriedFog ? "invite" : ""}`}>
              {fogEnabled
                ? "Keep your mouth open: fog slowly covers the glass. ☝ Point (other fingers in a fist) to draw. 🤏 Pinch thumb + index and move to drag your drawing."
                : hasTriedFog
                  ? "Turn on to fog up the glass."
                  : "Psst! Turn me on, open your mouth to fog the glass, then point ☝ to draw!"}
            </p>

          </div>

        </aside>


        {/* CAMERA */}

        <main className="camera-center">
          <div className="camera-frame">

            {!cameraStarted && (
              <div className="camera-off">
                CAMERA OFF
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video1" 
              style={{
                    display: cameraStarted
                    ? "block"
                    : "none",

                    transform: isFrontCamera
                    ? "scaleX(-1)"
                    : "scaleX(1)",
                }}
              />

            <canvas
                ref={fogCanvasRef}
                className="fog-canvas"
                style={{ transform: isFrontCamera ? "scaleX(-1)" : "scaleX(1)" }}
              />

            <canvas
                ref={fingerCanvasRef}
                className="finger-canvas"
                style={{ transform: isFrontCamera ? "scaleX(-1)" : "scaleX(1)" }}
              />

            {countdown !== null && (
              <div className="countdown-wrapper">
                <div className="countdown-display">
                  {countdown}
                </div>
              </div>
            )}

            <img
              src={cameraFrame}
              className="camera-frame-overlay1"
              alt="" />

          </div>

          <div className="camera-controls">

          {selectedPhoto !== null && !isTakingPhotos && (
            <button
              className="retake-selected-button"
              onClick={() => startRetake(selectedPhoto)}
            >
              ↻ RETAKE {String(selectedPhoto + 1).padStart(2, "0")}
            </button>
          )}

          {!sessionComplete && selectedPhoto === null && (
            <button
              className="camera-start-button"
              disabled={!cameraStarted || isTakingPhotos}
              onClick={startPhotoSession}
            >
              <img
                src={startbutton}
                alt="Start"
              />
            </button>
          )}

          {sessionComplete && !isTakingPhotos && (
            <button
              className="next-button"
              onClick={finishCamera}
            >
              NEXT PHASE →
            </button>
          )}

          <div className="draw-tools">

            <button
              className="tool-button"
              onClick={undoStroke}
              disabled={!fogEnabled || strokeCount === 0}
            >
              ↶ UNDO
            </button>

            <label className="brush-control">
              <span className="brush-label">BRUSH</span>
              <input
                type="range"
                min={1}
                max={10}
                value={brushSize}
                onChange={(e) => changeBrush(Number(e.target.value))}
                disabled={!fogEnabled}
              />
              <span
                className="brush-preview"
                style={{
                  width: 3 + brushSize * 1.6,
                  height: 3 + brushSize * 1.6,
                }}
              />
            </label>

            <button
              className="fog-clear-button"
              onClick={clearFog}
              disabled={!fogEnabled}
            >
              ✕ CLEAR
            </button>

          </div>

        </div>

        </main>


        {/* PHOTO HISTORY */}

        <aside className="photo-history">

          <div className="history-title">
            <span>TAKEN PHOTOS </span>

            <span className="history-count">
              {photos.length.toString().padStart(2, "0")} / 06
            </span>
          </div>

          <div className="photo-list">

            {Array.from({ length: 6 }).map((_, index) => {

              const photo = photos[index];

              return (
                
                <button
                  className={`photo-thumbnail ${
                    photo ? "has-photo" : "empty-photo"
                  } ${
                    selectedPhoto === index ? "selected-photo" : ""
                  }`}
                  key={index}
                  onClick={() => {
                    if (photo && !isTakingPhotos) {
                      setSelectedPhoto(index);
                    }
                  }}
                >

                  {photo ? (
                    <img
                      src={photo}
                      alt={`Photo ${index + 1}`}
                    />
                  ) : (
                    <span className="empty-slot">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  )}

              </button>
            );
          })}

          </div>

          {selectedPhoto !== null && !isTakingPhotos && (
            <button
              className="retake-selected-button"
              onClick={() => startRetake(selectedPhoto)}
            >
              ↻ RETAKE{" "}
              {String(selectedPhoto + 1).padStart(2, "0")}
            </button>
          )}

          <div className="photo-count">
            {photos.length} / 6
          </div>

        </aside>

      </div></>
  );
}

export default CameraPage;