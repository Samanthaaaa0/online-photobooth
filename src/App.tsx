import { useRef, useState } from "react";
import "./App.css";
import ToggleSwitch from "./components/ToggleSwitch.tsx";
import cameraFrame from "./assets/cameraframe2.png";
import "./Popup.css"

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
    <div>
      <h1>photobooth</h1>

      <p>Check yourself before taking pictures</p>

      <div className="booth-layout">
        {/* camera set up */}
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
            <div className="camera-icon">📷</div>
            <div className="camera-hint">
              Turn on the camera ♡
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
      
      {/* Controls */}
      <div className="booth-controls">

        {/* Camera toggle */}
        <div className="control-card">

          <div className="control-title">
            📷 CAMERA
          </div>

          <div className="control-description">
            Turn your camera on or off
          </div>

          <ToggleSwitch
            checked={cameraStarted}
            onChange={toggleCamera}
          />

        </div>


        {/* Start photobooth */}
        <div className="control-card">

          <div className="control-title">
            ✦ PHOTOBOOTH
          </div>

          <div className="control-description">
            Ready to take pictures?
          </div>

          <button className="start-button">
            GET STARTED ♡
          </button>

        </div>

      </div>

    </div>

    </div>
  );
}

export default App;