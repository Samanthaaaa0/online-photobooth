import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { FogEngine, NEON_PRESETS } from "./fogEngine";
import type { BrushShape, FogMode, NeonStyle, Tool } from "./fogEngine";
import { GestureTracker } from "./handGestures";
import { getHandTracker, loadHandTracker } from "../utils/handTracker";
import { CAMERA_WINDOW_ASPECT } from "../utils/cameraGeometry";
import "../FogPlayground.css";

type FogPlaygroundProps = {
  engine: FogEngine;          // owned by CameraPage (survives DONE)
  stream: MediaStream | null; // the EXISTING webcam stream
  isFrontCamera: boolean;
  includeEffect: boolean;
  onIncludeEffectChange: (value: boolean) => void;
  onClose: () => void;
};

// The viewport uses the SAME aspect ratio + object-fit: cover crop as the camera window on the
// main page and the saved photos, so what you see here is exactly what gets captured.
const VIEWPORT_STYLE = { "--ar": CAMERA_WINDOW_ASPECT } as CSSProperties;

const NEON_STYLES: NeonStyle[] = ["neon", "pink", "soft"];

const SHAPES: { id: BrushShape; glyph: string; label: string }[] = [
  { id: "line", glyph: "━", label: "Smooth line" },
  { id: "heart", glyph: "♥", label: "Hearts" },
  { id: "star", glyph: "★", label: "Stars" },
  { id: "sparkle", glyph: "✦", label: "Sparkles" },
];

// A short loss of the hand (a blurry frame, a finger turning) must not cut the line in two:
// the pen stays down for this many camera frames before it lifts.
const PEN_GRACE_FRAMES = 6;
// pointing must be seen this many frames in a row before a stroke starts (no accidental dots)
const START_FRAMES = 2;

function FogPlayground({
  engine,
  stream,
  isFrontCamera,
  includeEffect,
  onIncludeEffectChange,
  onClose,
}: FogPlaygroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const effectCanvasRef = useRef<HTMLCanvasElement>(null);
  const markerCanvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const ledRef = useRef<HTMLElement>(null);

  // toolbar state (the per-frame loop never touches React state)
  const [tool, setTool] = useState<Tool>(engine.tool);
  const [fogMode, setFogMode] = useState<FogMode>(engine.fogMode);
  const [fogOn, setFogOn] = useState(engine.isFogOn());
  const [neonStyle, setNeonStyle] = useState<NeonStyle>(engine.neonStyle);
  const [shape, setShape] = useState<BrushShape>(engine.shape);
  const [level, setLevel] = useState(Math.round(engine.getLevel() * 100));
  const [brush, setBrush] = useState(engine.getBrush());
  const [canUndo, setCanUndo] = useState(engine.canUndo());

  const [tracking, setTracking] = useState(true);
  const trackingRef = useRef(true);
  const [preview, setPreview] = useState(false);
  const previewRef = useRef(false);

  const mirror = isFrontCamera ? "scaleX(-1)" : "scaleX(1)";

  // ---- start loading the hand model (instant if it was already loaded) ----
  useEffect(() => {
    loadHandTracker().catch(() => {
      if (statusRef.current) statusRef.current.textContent = "TRACKER FAILED TO LOAD";
    });
  }, []);

  // ---- show the EXISTING stream (no new getUserMedia, tracks never stopped) ----
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.play().catch(() => {});

    return () => {
      video.srcObject = null; // detach only; CameraPage owns the tracks
    };
  }, [stream]);

  // ---- keyboard: Esc = leave preview / done, Ctrl/Cmd+Z = undo ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (previewRef.current) {
          previewRef.current = false;
          setPreview(false);
        } else {
          onClose();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        engine.undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine, onClose]);

  // ---- main loop: hand tracking -> engine -> canvases ----
  useEffect(() => {
    engine.activate();
    engine.onChange = () => setCanUndo(engine.canUndo());
    setCanUndo(engine.canUndo());

    const tracker = new GestureTracker();

    let raf = 0;
    let frameLast = performance.now();
    let lastTs = 0;
    let lastVideoTime = -1;
    let lastStatus = "";
    let lastLedOff = false;

    // pen state
    let penDown = false;
    let missed = 0;

    // what the cursor looks like right now. Detection runs once per CAMERA frame (~30/s) but the
    // screen redraws ~60/s, so the cursor is remembered and redrawn every screen frame.
    let cursor: { x: number; y: number; r: number; kind: "pen" | "ready" } | null = null;

    const setStatus = (text: string, ledOff: boolean) => {
      if (text !== lastStatus && statusRef.current) {
        statusRef.current.textContent = text;
        lastStatus = text;
      }
      if (ledOff !== lastLedOff && ledRef.current) {
        ledRef.current.classList.toggle("off", ledOff);
        lastLedOff = ledOff;
      }
    };

    const stopPen = () => {
      if (penDown) engine.liftPen();
      penDown = false;
      missed = 0;
    };

    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - frameLast) / 1000);
      frameLast = now;

      const video = videoRef.current;
      const fxCanvas = effectCanvasRef.current;
      const markerCanvas = markerCanvasRef.current;

      if (video && fxCanvas && markerCanvas && video.videoWidth > 0 && video.videoHeight > 0) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;

        if (fxCanvas.width !== vw || fxCanvas.height !== vh) {
          fxCanvas.width = vw;
          fxCanvas.height = vh;
        }
        if (markerCanvas.width !== vw || markerCanvas.height !== vh) {
          markerCanvas.width = vw;
          markerCanvas.height = vh;
        }
        engine.setSize(vw, vh);

        const scale = vw / 640;
        const handModel = getHandTracker();
        const trackActive = trackingRef.current && !previewRef.current;

        if (!trackActive) {
          // tracking OFF (or previewing): ignore hands completely, hide every marker,
          // keep all artwork exactly as it is
          tracker.reset();
          stopPen();
          cursor = null;
          setStatus(previewRef.current ? "PREVIEW" : "TRACKING OFF", true);
        } else if (!handModel) {
          cursor = null;
          setStatus("LOADING TRACKER...", false);
        } else if (video.currentTime !== lastVideoTime && now > lastTs) {
          // a NEW camera frame arrived: detect on it exactly once
          lastVideoTime = video.currentTime;
          lastTs = now;

          let landmarks: { x: number; y: number }[] | null = null;
          try {
            const result = handModel.detectForVideo(video, now);
            landmarks = result.landmarks.length > 0 ? result.landmarks[0] : null;
          } catch {
            landmarks = null; // model closed / not ready: skip this frame
          }

          let pointing = false;
          let tip: { x: number; y: number } | null = null;

          if (landmarks) {
            const r = tracker.read(landmarks, vw, vh);
            tip = r.indexTip;
            // a stroke needs a couple of confirming frames to START, none to CONTINUE
            pointing = r.pose === "point" && (penDown || r.frames >= START_FRAMES);
          } else {
            tracker.reset();
          }

          const neon = engine.tool === "neon";

          if (pointing && tip) {
            missed = 0;
            penDown = true;
            const sp = engine.drawAt({ x: tip.x * vw, y: tip.y * vh }, now);
            cursor = { x: sp.x, y: sp.y, r: engine.markerRadius(), kind: "pen" };
            setStatus(neon ? "POINT: GLOW DRAWING" : "POINT: CLEARING FOG", false);
          } else if (penDown) {
            // hand lost for a moment: keep the line open for a few frames
            missed++;
            if (missed > PEN_GRACE_FRAMES) {
              stopPen();
              cursor = null;
              setStatus(landmarks ? "HAND READY" : "NO HAND", false);
            }
          } else {
            cursor = landmarks && tip ? { x: tip.x * vw, y: tip.y * vh, r: 9 * scale, kind: "ready" } : null;
            setStatus(landmarks ? "HAND READY" : "NO HAND", false);
          }
        }

        // ---- draw the cursor (every screen frame, from the remembered state) ----
        const mk = markerCanvas.getContext("2d")!;
        mk.clearRect(0, 0, vw, vh);
        if (cursor && trackActive) {
          mk.lineWidth = (cursor.kind === "pen" ? 2 : 3) * scale;
          if (cursor.kind === "pen") {
            const col = neonColour(engine);
            mk.strokeStyle = col;
            mk.shadowColor = col;
            mk.shadowBlur = 8;
          } else {
            mk.strokeStyle = "rgba(255,255,255,0.55)";
          }
          mk.beginPath();
          mk.arc(cursor.x, cursor.y, Math.max(5 * scale, cursor.r), 0, Math.PI * 2);
          mk.stroke();
          mk.shadowBlur = 0;
        }

        // ---- fog + wiped lines + glow (video is passed so fog can diffuse it) ----
        engine.update(dt);
        const fx = fxCanvas.getContext("2d")!;
        fx.clearRect(0, 0, vw, vh);
        const composed = engine.compose(now, video);
        if (composed) fx.drawImage(composed, 0, 0);
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      engine.liftPen();
      engine.onChange = null;
    };
  }, [engine]);

  // ---- toolbar handlers ----
  const syncFromEngine = () => {
    setLevel(Math.round(engine.getLevel() * 100));
    setBrush(engine.getBrush());
    setCanUndo(engine.canUndo());
  };

  const chooseFog = (m: FogMode) => {
    engine.setFogMode(m);
    setFogMode(m);
    setFogOn(true);
    setTool("fog");
    syncFromEngine();
  };

  const chooseNoFog = () => {
    engine.setFogOff();
    setFogOn(false);
    setTool("neon");
    syncFromEngine();
  };

  const chooseNeon = () => {
    engine.setTool("neon");
    setTool("neon");
    syncFromEngine();
  };

  const chooseStyle = (s: NeonStyle) => {
    engine.setNeonStyle(s);
    setNeonStyle(s);
  };

  const chooseShape = (s: BrushShape) => {
    engine.setShape(s);
    setShape(s);
  };

  const changeLevel = (v: number) => {
    engine.setLevel(v / 100);
    setLevel(v);
  };

  const changeBrush = (v: number) => {
    engine.setBrush(v);
    setBrush(v);
  };

  const toggleTracking = () => {
    trackingRef.current = !trackingRef.current;
    setTracking(trackingRef.current);
  };

  const togglePreview = () => {
    previewRef.current = !previewRef.current;
    setPreview(previewRef.current);
  };

  const hint =
    tool === "neon"
      ? fogOn
        ? "NEON DRAW: point ☝ with one finger to draw glowing lines"
        : "NEON DRAW: point ☝ to draw glowing lines · pick FOG ART or FOG REVEAL to add fog"
      : fogMode === "art"
        ? "FOG ART: point ☝ with one finger to clear the fog"
        : "FOG REVEAL: wipe the fog away with one finger ☝";

  return (
    <div
      className={`fp-overlay ${preview ? "fp-previewing" : ""}`}
      role="dialog"
      aria-label="Cam Lab"
    >

      <header className="fp-titlebar">
        <span className="fp-title">✦ CAM LAB.EXE</span>

        <span className="fp-status">
          <i className="fp-led" ref={ledRef} />
          <span ref={statusRef}>STARTING...</span>
        </span>

        <span className="fp-hint">{hint} · ESC = DONE</span>
      </header>

      <div className="fp-stage">
        <div className="fp-viewport" style={VIEWPORT_STYLE}>

          <video
            ref={videoRef}
            className="fp-layer fp-video"
            autoPlay
            playsInline
            muted
            style={{ transform: mirror }}
          />

          <canvas
            ref={effectCanvasRef}
            className="fp-layer fp-effect"
            style={{ transform: mirror }}
          />

          <canvas
            ref={markerCanvasRef}
            className="fp-layer fp-markers"
            style={{ transform: mirror }}
          />

          <span className="fp-corner fp-tl" />
          <span className="fp-corner fp-tr" />
          <span className="fp-corner fp-bl" />
          <span className="fp-corner fp-br" />

        </div>
      </div>

      {preview ? (
        <div className="fp-preview-bar">
          <button className="fp-btn active" onClick={togglePreview}>
            ◂ BACK TO EDITING
          </button>
          <button className="fp-btn fp-done" onClick={onClose}>
            DONE ▸ CAMERA
          </button>
        </div>
      ) : (
        <footer className="fp-toolbar">

          <div className="fp-row">

            <div className="fp-group">
              <button
                className={`fp-btn ${tool === "fog" && fogMode === "art" ? "active" : ""}`}
                onClick={() => chooseFog("art")}
                aria-pressed={tool === "fog" && fogMode === "art"}
              >
                FOG ART
              </button>
              <button
                className={`fp-btn ${tool === "fog" && fogMode === "reveal" ? "active" : ""}`}
                onClick={() => chooseFog("reveal")}
                aria-pressed={tool === "fog" && fogMode === "reveal"}
              >
                FOG REVEAL
              </button>
              <button
                className={`fp-btn ${tool === "neon" ? "active" : ""}`}
                onClick={chooseNeon}
                aria-pressed={tool === "neon"}
              >
                NEON DRAW
              </button>
              {fogOn && (
                <button className="fp-btn" onClick={chooseNoFog} title="Take the fog away">
                  NO FOG
                </button>
              )}
            </div>

            {tool === "neon" && (
              <div className="fp-group">
                {NEON_STYLES.map((s) => (
                  <button
                    key={s}
                    className={`fp-btn fp-swatch ${neonStyle === s ? "active" : ""}`}
                    onClick={() => chooseStyle(s)}
                    aria-pressed={neonStyle === s}
                    style={{ "--sw": NEON_PRESETS[s].swatch } as CSSProperties}
                  >
                    <i className="fp-dot" />
                    {NEON_PRESETS[s].label}
                  </button>
                ))}
              </div>
            )}

            <div className="fp-group" role="group" aria-label="Brush shape">
              {SHAPES.map((s) => (
                <button
                  key={s.id}
                  className={`fp-btn fp-shape ${shape === s.id ? "active" : ""}`}
                  onClick={() => chooseShape(s.id)}
                  aria-pressed={shape === s.id}
                  aria-label={s.label}
                  title={s.label}
                >
                  {s.glyph}
                </button>
              ))}
            </div>

            <label className="fp-slider">
              <span>BRUSH SIZE</span>
              <input
                type="range"
                min={1}
                max={10}
                value={brush}
                onChange={(e) => changeBrush(Number(e.target.value))}
              />
            </label>

            <label className="fp-slider">
              <span>{tool === "neon" ? "GLOW INTENSITY" : "FOG INTENSITY"}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={level}
                onChange={(e) => changeLevel(Number(e.target.value))}
              />
            </label>

            <div className="fp-group">
              <button className="fp-btn" onClick={() => engine.undo()} disabled={!canUndo}>
                ↶ UNDO
              </button>
              <button className="fp-btn" onClick={() => engine.clear()}>
                CLEAR
              </button>
            </div>

            <button className="fp-btn fp-preview-btn" onClick={togglePreview}>
              ◉ PREVIEW RESULT
            </button>

            <div className="fp-group fp-group-right">
              <button
                className={`fp-btn fp-toggle ${tracking ? "active" : ""}`}
                onClick={toggleTracking}
                aria-pressed={tracking}
              >
                HAND TRACKING: {tracking ? "ON" : "OFF"}
              </button>
              <button
                className={`fp-btn fp-toggle ${includeEffect ? "active" : ""}`}
                onClick={() => onIncludeEffectChange(!includeEffect)}
                aria-pressed={includeEffect}
              >
                EFFECT IN PHOTO: {includeEffect ? "ON" : "OFF"}
              </button>
              <button className="fp-btn fp-done" onClick={onClose}>
                DONE ▸ CAMERA
              </button>
            </div>

          </div>

        </footer>
      )}

    </div>
  );
}

/** colour of the brush cursor: the glow colour for glow drawing, turquoise for fog */
function neonColour(engine: FogEngine) {
  return engine.tool === "neon" ? NEON_PRESETS[engine.neonStyle].swatch : "rgba(64,224,208,0.95)";
}

export default FogPlayground;
