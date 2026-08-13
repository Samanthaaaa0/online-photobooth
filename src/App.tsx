import { useState } from "react";

import CameraSetup from "./pages/CameraSetup";
import LayoutSelection from "./pages/LayoutSelection";

function App() {
  const [page, setPage] = useState<"camera" | "layout">("camera");

  return (
    <>
      {page === "camera" && (
        <CameraSetup
          onStart={() => {
            console.log("START BUTTON CLICKED");
            setPage("layout");
          }}
        />
      )}

      {page === "layout" && (
        <LayoutSelection />
      )}
    </>
  );
}

export default App;