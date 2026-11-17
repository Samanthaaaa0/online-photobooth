import { useEffect, useRef, useState } from "react";
import cameraFrame from "../assets/cameraframe.png";
import startbutton from "../assets/Startbutton.png";

import "../CameraPage.css";
import FogPlayground from "./FogPlayground";
import { FogEngine } from "./fogEngine";
import { loadHandTracker } from "../utils/handTracker";
import { PHOTOS_PER_SESSION } from "../utils/session";
import type { LayoutType } from "../utils/session";
import {
  CAMERA_FRAME_STYLE,
  CAMERA_WINDOW_ASPECT,
  coverCrop,
} from "../utils/cameraGeometry";

type CameraPageProps = {
  layout: LayoutType | null;
  onComplete: (photos: string[]) => void;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

function CameraPage({ onComplete }: CameraPageProps) {
  // ---- camera ----
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const isFrontCamera = true;

  // ---- settings ----
  const [timer, setTimer] = useState(0);
  const [vibe, setVibe] = useState("sky");

  // ---- the session ----
  const [photos, setPhotos] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isTakingPhotos, setIsTakingPhotos] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);

  // ---- CAM LAB (the fullscreen fog / drawing mode). The engine lives here so the artwork
  //      survives pressing DONE and can be composited into the photos. ----
  const [fogEngine] = useState(() => new FogEngine());
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const [includeEffect, setIncludeEffect] = useState(true);
  const includeEffectRef = useRef(true);
  const [effectActive, setEffectActive] = useState(false);
  const effectCanvasRef = useRef<HTMLCanvasElement>(null);

  // ===================================================================
  // CAMERA LIFECYCLE
  // ===================================================================

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setCameraStarted(false);
  };

  // ===================================================================
  // CAM LAB artwork shown live on this page (redrawn every frame because
  // the fog softly diffuses the live camera). Only runs while there is something to show.
  // ===================================================================

  useEffect(() => {
    if (!cameraStarted || playgroundOpen || !effectActive || !includeEffect) {
      const c = effectCanvasRef.current;
      c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
      return;
    }

    let raf = 0;
    let last = performance.now();

    const tick = () => {
      const video = videoRef.current;
      const canvas = effectCanvasRef.current;
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (video && canvas && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        fogEngine.setSize(video.videoWidth, video.videoHeight);
        fogEngine.update(dt);

        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const fx = fogEngine.compose(Infinity, video);
        if (fx) ctx.drawImage(fx, 0, 0);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cameraStarted, playgroundOpen, effectActive, includeEffect, fogEngine]);

  const openPlayground = () => {
    if (!cameraStarted || isTakingPhotos) return;
    setPlaygroundOpen(true);
  };

  const closePlayground = () => {
    setPlaygroundOpen(false);
    setEffectActive(fogEngine.hasContent());
  };

  const changeIncludeEffect = (value: boolean) => {
    includeEffectRef.current = value;
    setIncludeEffect(value);
  };

  // start loading the hand model a moment before it is needed (it is ~10 MB the first time)
  const warmUpTracker = () => {
    loadHandTracker().catch(() => {});
  };

  // ===================================================================
  // TAKING PHOTOS
  // ===================================================================

  const takePhoto = (): string | null => {
    const video = videoRef.current;

    if (!video || video.videoWidth === 0) return null;

    // The preview shows the video with `object-fit: cover` inside the camera window. Crop the
    // photo with the SAME rule so photo == preview, whatever resolution / aspect ratio the
    // webcam delivers (4:3, 16:9, ...).
    const crop = coverCrop(video.videoWidth, video.videoHeight, CAMERA_WINDOW_ASPECT);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(crop.sw);
    canvas.height = Math.round(crop.sh);

    const context = canvas.getContext("2d");
    if (!context) return null;

    // one mirror for the whole composite, exactly like the CSS scaleX(-1)
    if (isFrontCamera) {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }

    // every layer below is video-sized, so each uses the same source crop
    const drawLayer = (layer: CanvasImageSource) =>
      context.drawImage(
        layer,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
        0,
        0,
        canvas.width,
        canvas.height
      );

    drawLayer(video);

    // CAM LAB artwork (fog + drawings + glow), if the user wants it.
    // No cursors, markers or UI are ever part of this canvas.
    if (includeEffectRef.current) {
      const fx = fogEngine.compose(Infinity, video);
      if (fx && fx.width === video.videoWidth && fx.height === video.videoHeight) {
        drawLayer(fx);
      }
    }

    return canvas.toDataURL("image/png");
  };

  const triggerFlash = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
  };

  const runCountdown = async (photoIndex?: number): Promise<string | null> => {
    for (let count = timer; count >= 1; count--) {
      setCountdown(count);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    triggerFlash();

    const photo = takePhoto();

    if (photo) {
      setPhotos((prev) => {
        if (photoIndex === undefined) return [...prev, photo];
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

    const newPhotos: string[] = [];

    for (let i = 0; i < PHOTOS_PER_SESSION; i++) {
      const photo = await runCountdown();
      if (photo) newPhotos.push(photo);

      // small pause between photos
      if (i < PHOTOS_PER_SESSION - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    setPhotos(newPhotos);
    setIsTakingPhotos(false);
    setSessionComplete(true);
  };

  const startRetake = async (photoIndex: number) => {
    if (isTakingPhotos) return;

    setIsTakingPhotos(true);
    setSelectedPhoto(null);

    await runCountdown(photoIndex);

    setIsTakingPhotos(false);
  };

  const finishCamera = () => {
    stopCamera();
    onComplete(photos);
  };

  // ===================================================================
  // RENDER
  // ===================================================================

  const mirror = isFrontCamera ? "scaleX(-1)" : "scaleX(1)";

  return (
    <>
      {flash && <div className="camera-flash" />}

      <div className="camera-topbar">
        <span>✦ PHOTOBOOTH.EXE</span>
        <span>DIGITAL CAM 2000</span>
        <span className="rec-status">
          {isTakingPhotos ? "● CAPTURING" : sessionComplete ? "● REVIEW" : "● READY"}
        </span>
      </div>

      <div className={`camera-page vibe-${vibe}`}>

        {/* ================= SETTINGS ================= */}
        <aside className="camera-settings">

          <div className="panel-title">
            <span><i className="led" />SETTINGS</span>
          </div>

          <div className="settings-body">

            <div className="settings-section">
              <div className="settings-label">COUNTDOWN</div>

              <div className="timer-options" role="group" aria-label="Countdown">
                {[0, 1, 5, 10].map((seconds) => (
                  <button
                    key={seconds}
                    className={timer === seconds ? "selected" : ""}
                    onClick={() => setTimer(seconds)}
                    disabled={isTakingPhotos}
                    aria-pressed={timer === seconds}
                  >
                    {seconds === 0 ? "OFF" : `${seconds}s`}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-label">BACKGROUND</div>

              <div className="vibe-options">
                {(["sky", "pink", "white", "black"] as const).map((v) => (
                  <button
                    key={v}
                    className={`vibe-swatch ${v} ${vibe === v ? "selected" : ""}`}
                    onClick={() => setVibe(v)}
                    aria-label={`${v} background`}
                    aria-pressed={vibe === v}
                  >
                    <span className="vibe-dot" />
                    <span className="vibe-name">{v.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-section settings-lab">
              <div className="settings-label">EFFECTS</div>

              <button
                className="playground-button"
                onClick={openPlayground}
                onPointerEnter={warmUpTracker}
                onFocus={warmUpTracker}
                disabled={!cameraStarted || isTakingPhotos}
              >
                ✦ CAM LAB
              </button>
              <p className="settings-note">Fog &amp; neon drawing. Nothing is applied until you use it.</p>

              {effectActive && (
                <button
                  className={`effect-toggle ${includeEffect ? "on" : ""}`}
                  onClick={() => changeIncludeEffect(!includeEffect)}
                  aria-pressed={includeEffect}
                >
                  <span>EFFECT IN PHOTO</span>
                  <b>{includeEffect ? "ON" : "OFF"}</b>
                </button>
              )}
            </div>

          </div>
        </aside>

        {/* ================= CAMERA ================= */}
        <main className="camera-center">
          <div className="camera-stage" style={CAMERA_FRAME_STYLE}>
          <div className="camera-frame">

            {!cameraStarted && <div className="camera-off">CAMERA OFF</div>}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video1"
              style={{
                display: cameraStarted ? "block" : "none",
                transform: mirror,
              }}
            />

            <canvas
              ref={effectCanvasRef}
              className="playground-preview-canvas"
              style={{
                transform: mirror,
                display: effectActive && includeEffect ? "block" : "none",
              }}
            />

            {countdown !== null && (
              <div className="countdown-wrapper">
                <div className="countdown-display">{countdown}</div>
              </div>
            )}

            <img src={cameraFrame} className="camera-frame-overlay1" alt="" />

          </div>

          <div className="camera-controls">

            {selectedPhoto !== null && !isTakingPhotos && (
              <button
                className="retake-selected-button"
                onClick={() => startRetake(selectedPhoto)}
              >
                ↻ RETAKE {pad2(selectedPhoto + 1)}
              </button>
            )}

            {!sessionComplete && selectedPhoto === null && (
              <button
                className="camera-start-button"
                disabled={!cameraStarted || isTakingPhotos}
                onClick={startPhotoSession}
              >
                <img src={startbutton} alt="Start" />
              </button>
            )}

            {sessionComplete && !isTakingPhotos && (
              <button className="next-button" onClick={finishCamera}>
                PICK PHOTOS →
              </button>
            )}

          </div>
          </div>
        </main>

        {/* ================= TAKEN PHOTOS ================= */}
        <aside className="photo-history">

          <div className="panel-title">
            <span><i className="led" />TAKEN PHOTOS</span>
            <span className="history-count">
              {pad2(photos.length)} / {pad2(PHOTOS_PER_SESSION)}
            </span>
          </div>

          <div className="photo-list">
            {Array.from({ length: PHOTOS_PER_SESSION }).map((_, index) => {
              const photo = photos[index];

              return (
                <button
                  className={`photo-thumbnail ${photo ? "has-photo" : "empty-photo"} ${
                    selectedPhoto === index ? "selected-photo" : ""
                  }`}
                  key={index}
                  onClick={() => {
                    if (photo && !isTakingPhotos) {
                      setSelectedPhoto(selectedPhoto === index ? null : index);
                    }
                  }}
                  aria-label={photo ? `Photo ${index + 1}, tap to retake` : `Empty slot ${index + 1}`}
                >
                  {photo ? (
                    <img src={photo} alt={`Photo ${index + 1}`} />
                  ) : (
                    <span className="empty-slot">{pad2(index + 1)}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="photo-count">
            {selectedPhoto !== null ? "TAP A PHOTO AGAIN TO DESELECT" : photos.length > 0 ? "TAP A PHOTO TO RETAKE IT" : "YOUR SHOTS APPEAR HERE"}
          </div>

        </aside>

      </div>

      {playgroundOpen && (
        <FogPlayground
          engine={fogEngine}
          stream={streamRef.current}
          isFrontCamera={isFrontCamera}
          includeEffect={includeEffect}
          onIncludeEffectChange={changeIncludeEffect}
          onClose={closePlayground}
        />
      )}
    </>
  );
}

export default CameraPage;
