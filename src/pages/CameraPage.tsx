import { useEffect, useRef, useState } from "react";
import cameraFrame from "../assets/cameraframe.png";
import startbutton from "../assets/startbutton.png";

import "../CameraPage.css";

type LayoutType =
  | "4-cuts"
  | "6-cuts"
  | "meme";

type CameraPageProps = {
  layout: LayoutType | null;
  onComplete: (photos: string[]) => void;
};

function CameraPage({
  layout,
  onComplete,
}: CameraPageProps) {
  // set up camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraStarted, setCameraStarted] = useState(false);
  const isFrontCamera = true;

  // set up countdown timer
  const [timer, setTimer] = useState(3);

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


  // START CAMERA WHEN PAGE LOADS
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