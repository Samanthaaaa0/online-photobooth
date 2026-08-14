import { useState } from "react";

import CameraSetup from "./pages/CameraSetup";
import LayoutSelection from "./pages/LayoutSelection";
import CameraPage from "./pages/CameraPage"

function App() {
  const [page, setPage] = useState<"intro" | "layout" | "camera">("intro");

  return (
    <>
      {page === "intro" && (
        <CameraSetup
          onStart={() => {
            console.log("START BUTTON CLICKED");
            setPage("layout");
          }}
        />
      )}

      {page === "layout" && (
        <LayoutSelection
          onSelectLayout={() => setPage("camera")}
        />
      )}

      {page === "camera" && (
        <CameraPage />
      )}
    </>
  );
}

export default App;