import { useState } from "react";

import "../PhotoSelection.css";

type LayoutType =
  | "4-cuts"
  | "6-cuts"
  | "meme";

type PhotoSelectionProps = {
  photos: string[];
  layout: LayoutType | null;
  onBack: () => void;
  onContinue: (selectedPhotos: string[]) => void;
};

function PhotoSelection({
  photos,
  layout,
  onBack,
  onContinue,
}: PhotoSelectionProps) {

  // How many photos does the user need?
  const numberToSelect =
    layout === "4-cuts" ? 4 : 6;

  // Stores the INDEX of each selected photo
  const [selectedPhotos, setSelectedPhotos] = useState<number[]>([]);


  const togglePhoto = (index: number) => {

    setSelectedPhotos((current) => {

      // If already selected, remove it
      if (current.includes(index)) {
        return current.filter(
          (photoIndex) => photoIndex !== index
        );
      }

      // Don't allow more than required
      if (current.length >= numberToSelect) {
        return current;
      }

      // Add selected photo
      return [...current, index];
    });

  };


  const handleContinue = () => {

    const selected = selectedPhotos.map(
      (index) => photos[index]
    );

    onContinue(selected);
  };


  return (
    <div className="photo-selection-page">

      {/* HEADER */}

      <div className="photo-selection-header">

        <h1>
          ✦ PICK YOUR FAVOURITES ✦
        </h1>

        <p>
          CHOOSE {numberToSelect} PHOTOS
        </p>

      </div>


      {/* SELECTION COUNT */}

      <div className="selection-count">

        {selectedPhotos.length} / {numberToSelect}

      </div>


      {/* PHOTOS */}

      <div className="photo-selection-grid">

        {photos.map((photo, index) => {

          const selectedPosition =
            selectedPhotos.indexOf(index);

          const isSelected =
            selectedPosition !== -1;

          return (

            <button
              key={index}
              className={`selection-photo ${
                isSelected ? "selected" : ""
              }`}
              onClick={() => togglePhoto(index)}
            >

              <img
                src={photo}
                alt={`Photo ${index + 1}`}
              />

              {/* PHOTO NUMBER */}

              <span className="selection-number">

                {String(index + 1).padStart(2, "0")}

              </span>


              {/* SELECTED NUMBER */}

              {isSelected && (

                <span className="selection-check">

                  ✓

                </span>

              )}

            </button>

          );

        })}

      </div>


      {/* ACTIONS */}

      <div className="selection-actions">

        <button
          className="back-button"
          onClick={onBack}
        >
          ← BACK
        </button>


        <button
          className="continue-button"
          disabled={
            selectedPhotos.length !== numberToSelect
          }
          onClick={handleContinue}
        >
          CONTINUE →
        </button>

      </div>

    </div>
  );
}

export default PhotoSelection;