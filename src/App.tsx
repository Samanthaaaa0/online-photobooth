import { useRef, useState } from "react";
import "./App.css";
import ToggleSwitch from "./components/ToggleSwitch.tsx";
import cameraFrame from "./assets/cameraframe.png";
import startbutton from "./assets/Startbutton.png";

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStarted, setCameraStarted] = useState(false);

  const isFrontCamera = true;

  const toggleCamera = async () => {
    if (!cameraStarted) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setCameraStarted(true);
      } catch (error) {
        console.error("Could not access camera:", error);
      }
    } else {
      const stream = videoRef.current?.srcObject as MediaStream | null;

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      setCameraStarted(false);
    }
  };

  return (
    

      <div className="pc-window">

        {/* actual website */}
        <div className="photobooth-page">

          <h1>photobooth</h1>
          <p>Check yourself before taking pictures</p>

          <div className="booth-layout">

            {/* MACHINE HEADER */}
            <div className="booth-header">
              <span>✦ PHOTOBOOTH.EXE</span>
              <span>v1.0</span>
            </div>

            {/* CAMERA */}
            <div className="camera-frame">

              {/* LIVE CAMERA */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="camera-video"
                style={{
                  display: cameraStarted ? "block" : "none",
                  transform: isFrontCamera ? "scaleX(-1)" : "scaleX(1)",
                }}
              />

              {/* CAMERA OFF */}
              {!cameraStarted && (
                <div className="camera-off">
                  <div className="camera-icon">📸</div>

                  <div className="camera-hint">
                    Turn on the camera
                  </div>
                </div>
              )}

              {/* Y2K FRAME */}
              <img
                src={cameraFrame}
                className="camera-frame-overlay"
                alt=""
              />

            </div>

            {/* CONTROLS */}
            <div className="booth-controls">

              {/* CAMERA STATUS */}
              <div className="camera-control">
                <div className="control-label">
                  Turn on the camera
                </div>

                <ToggleSwitch
                  checked={cameraStarted}
                  onChange={toggleCamera}
                />
              </div>

              {/* START */}
              <button className="start-button">
                {/* ✦ START ✦ */}
                <img 
                  src = {startbutton}
                  alt="start button"
                />
              </button>

            </div>

            {/* STATUS BAR */}
            <div className="booth-status">

              <span className={cameraStarted ? "status-live" : "status-off"}>
                {cameraStarted ? "● LIVE" : "○ STANDBY"}
              </span>

              <span>
                DIGITAL CAM 2000
              </span>

              <span>
                128 MB
              </span>

            </div>

          </div>

        </div> {/* photobooth-page */}

        {/* old PC frame */}
        {/* <img
          src={windowFrame}
          className="window-frame-overlay"
          alt=""
        /> */}

      </div>

        )
}

export default App;