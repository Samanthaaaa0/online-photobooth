import { useState } from "react";

import CameraSetup from "./pages/CameraSetup";
import LayoutSelection from "./pages/LayoutSelection";
import CameraPage from "./pages/CameraPage";
import PhotoSelection from "./pages/PhotoSelection";
import Editor from "./pages/Editor";
import Deco from "./pages/Deco";

type Page =
  | "intro"
  | "layout"
  | "camera"
  | "photo-selection"
  | "editor"
  | "deco";

type LayoutType =
  | "4-cuts"
  | "6-cuts"
  | "meme";

function App() {

  const [page, setPage] = useState<Page>("intro");

  const [layout, setLayout] = useState<LayoutType | null>(null);

  const [photos, setPhotos] = useState<string[]>([]);

  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);

  // need to combine frame and photo before moving on
  const [finalImage, setFinalImage] = useState<string | null>(null);

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
          onSelectLayout={(selectedLayout) => {
            setLayout(selectedLayout);
            setPage("camera");
          }}
        />
      )}

      {page === "camera" && (
        <CameraPage
          layout={layout}
          onComplete={(takenPhotos) => {
            setPhotos(takenPhotos);
            setPage("photo-selection");
          }}
        />
      )}

      {page === "photo-selection" && (
        <PhotoSelection
          photos={photos}
          layout={layout}
          onBack={() => {
            setPage("camera");
          }}
          onContinue={(selectedPhotos) => {
            setSelectedPhotos(selectedPhotos);
            setPage("editor");
          }}
        />
      )}

      {page === "editor" && (
        <Editor
            photos={selectedPhotos}
            layout={layout}
            onBack={() => {
                setPage("photo-selection");
            }}
            onContinue={(image) => {
                setFinalImage(image);
                setPage("deco");
            }}
        />
      )}

      {page === "deco" && finalImage && (
        <Deco
            image={finalImage}
            onBack={() => {
                setPage("editor");
            }}
        />
    )}

    </>
  );
}

export default App;