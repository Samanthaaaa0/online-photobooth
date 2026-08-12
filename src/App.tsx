import { useRef, useState } from "react";
import "./App.css";
import ToggleSwitch from "./components/ToggleSwitch.tsx";

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStarted, setCameraStarted] = useState(false);

  const isFrontCamera = true;

  const toggleCamera = async () => {
    // Turn camera ON
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
    }

    // Turn camera OFF
    else {
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

      <video
        ref={videoRef}
        autoPlay
        playsInline
        width="500"
        height="500"
        style={{
          transform: isFrontCamera ? "scaleX(-1)" : "scaleX(1)",
        }}
      />

      <br />

      <ToggleSwitch
        checked={cameraStarted}
        onChange={toggleCamera}
      />
      
    </div>
  );
}

export default App;