import { useEffect, useRef, useState } from "react";
import cameraFrame from "../assets/cameraframe.png";
import startbutton from "../assets/startbutton.png";

import "../CameraPage.css";

function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [cameraStarted, setCameraStarted] = useState(false);
  const isFrontCamera = true;

  const [timer, setTimer] = useState(3);

  const [photos, setPhotos] = useState<string[]>([]);

  const [vibe, setVibe] = useState("black");


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

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraStarted(true);

    } catch (error) {
      console.error("Could not access camera:", error);
      setCameraStarted(false);
    }
  };


  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;

    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
    }
  };


  return (
    <>
    <div className="camera-topbar">

      <span>
        ✦ PHOTOBOOTH.EXE
      </span>

      <span>
        DIGITAL CAM 2000
      </span>

      <span className="rec-status">
        ● READY
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

              {[3, 5, 10].map((seconds) => (
                <button
                  key={seconds}
                  className={timer === seconds ? "selected" : ""}
                  onClick={() => setTimer(seconds)}
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
                className={`vibe pink ${vibe === "pink" ? "selected" : ""}`}
                onClick={() => setVibe("pink")} />

              <button
                className={`vibe blue ${vibe === "blue" ? "selected" : ""}`}
                onClick={() => setVibe("blue")} />

              <button
                className={`vibe white ${vibe === "white" ? "selected" : ""}`}
                onClick={() => setVibe("white")} />

              <button
                className={`vibe black ${vibe === "black" ? "selected" : ""}`}
                onClick={() => setVibe("black")} />

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
              className="camera-video" 
              style={{
                    display: cameraStarted
                    ? "block"
                    : "none",

                    transform: isFrontCamera
                    ? "scaleX(-1)"
                    : "scaleX(1)",
                }}
              />

            <img
              src={cameraFrame}
              className="camera-frame-overlay"
              alt="" />

          </div>


          <button
            className="camera-start-button"
            disabled={!cameraStarted}
          >
            <img
              src={startbutton}
              alt="Start" />
          </button>

        </main>


        {/* PHOTO HISTORY */}

        <aside className="photo-history">

          <div className="history-title">
            TAKEN PHOTOS
          </div>

          <div className="photo-list">

            {Array.from({ length: 6 }).map((_, index) => {

              const photo = photos[index];

              return (
                <div
                  className={`photo-thumbnail ${
                    photo ? "has-photo" : "empty-photo"
                  }`}
                  key={index}
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

                  <span className="photo-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>

              </div>
            );
          })}

          </div>

          <div className="photo-count">
            {photos.length} / 6
          </div>

        </aside>

      </div></>
  );
}

export default CameraPage;