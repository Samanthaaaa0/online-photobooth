import { useState } from "react";

import "../Editor.css";

type LayoutType =
  | "4-cuts"
  | "6-cuts"
  | "meme";

type EditorProps = {
  photos: string[];
  layout: LayoutType | null;
  onBack: () => void;
};

function Editor({
  photos,
  layout,
  onBack,
}: EditorProps) {

  const [filter, setFilter] = useState("normal");
  const [frame, setFrame] = useState("silver");

  const layoutName =
    layout === "4-cuts"
      ? "4 CUTS"
      : layout === "6-cuts"
        ? "6 CUTS"
        : "MEME MODE";

  return (
    <div className="editor-page">

      {/* ================= HEADER ================= */}

      <header className="editor-topbar">

        <div className="editor-brand">
          ✦ PHOTOBOOTH.EXE
        </div>

        <div className="editor-title">
          PHOTO EDITOR 2000
        </div>

        <div className="editor-status">
          <span className="status-light">●</span>
          EDITING
        </div>

      </header>


      {/* ================= MAIN ================= */}

      <main className="editor-workspace">


        {/* ========== LEFT PANEL ========== */}

        <aside className="editor-panel left-panel">

          <div className="panel-heading">
            ✦ DECORATE
          </div>


          {/* FRAME */}

          <section className="control-group">

            <div className="control-title">
              FRAME
            </div>

            <button
              className={`editor-option ${
                frame === "silver" ? "active" : ""
              }`}
              onClick={() => setFrame("silver")}
            >
              <span className="option-preview silver-preview" />
              SILVER
            </button>

            <button
              className={`editor-option ${
                frame === "pastel" ? "active" : ""
              }`}
              onClick={() => setFrame("pastel")}
            >
              <span className="option-preview pastel-preview" />
              PASTEL
            </button>

          </section>


          {/* FILTER */}

          <section className="control-group">

            <div className="control-title">
              FILTER
            </div>

            <button
              className={`editor-option ${
                filter === "normal" ? "active" : ""
              }`}
              onClick={() => setFilter("normal")}
            >
              ◉ NORMAL
            </button>

            <button
              className={`editor-option ${
                filter === "soft" ? "active" : ""
              }`}
              onClick={() => setFilter("soft")}
            >
              ○ SOFT
            </button>

            <button
              className={`editor-option ${
                filter === "retro" ? "active" : ""
              }`}
              onClick={() => setFilter("retro")}
            >
              ○ RETRO
            </button>

          </section>


          {/* PHOTO COUNT */}

          <div className="capture-info">

            <span>
              CAPTURES
            </span>

            <strong>
              {photos.length.toString().padStart(2, "0")}
            </strong>

          </div>

        </aside>



        {/* ========== PHOTO PREVIEW ========== */}

        <section className="editor-preview-area">

            <div className="preview-label">
                PREVIEW WINDOW
            </div>

            <div
                className={`photo-print frame-${frame} ${
                layout === "6-cuts"
                    ? "print-six"
                    : "print-four"
                }`}
            >

                <div className="print-top-decoration">
                ✦
                </div>


                <div
                    className={
                        layout === "6-cuts"
                        ? "photo-grid grid-six"
                        : "photo-grid grid-four"
                    }
                    >
                    {photos.map((photo, index) => (
                        <div
                        className={`strip-photo filter-${filter}`}
                        key={index}
                        >
                        <img
                            src={photo}
                            alt={`Photo ${index + 1}`}
                        />

                        <span className="photo-number">
                            {String(index + 1).padStart(2, "0")}
                        </span>
                        </div>
                    ))}
                    </div>

                <div className="print-bottom">

                <div className="print-date">
                    PHOTOBOOTH 2000
                </div>

                <div className="print-stars">
                    ✦ ♡ ✦
                </div>

                </div>

            </div>

            </section>



        {/* ========== RIGHT PANEL ========== */}

        <aside className="editor-panel right-panel">

          <div className="panel-heading">
            ✦ INFO
          </div>


          <div className="info-box">

            <span>
              MODE
            </span>

            <strong>
              {layoutName}
            </strong>

          </div>


          <div className="info-box">

            <span>
              PHOTOS
            </span>

            <strong>
              {photos.length} / {
                layout === "4-cuts"
                  ? 4
                  : layout === "6-cuts"
                    ? 6
                    : 6
              }
            </strong>

          </div>


          <div className="tiny-note">

            ✦ DRAG TO DECORATE<br />
            ✦ CLICK TO CUSTOMIZE<br />
            ✦ SAVE YOUR MEMORIES

          </div>

        </aside>

      </main>



      {/* ================= FOOTER ================= */}

      <footer className="editor-footer">

        <button
          className="editor-back-button"
          onClick={onBack}
        >
          ◀ BACK
        </button>


        <div className="editor-footer-display">

          <span className="display-dot">
            ●
          </span>

          READY TO PRINT

        </div>


        <button
          className="editor-next-button"
          onClick={() => {
            console.log("Continue to final:", photos);
          }}
        >
          PRINT / SAVE ▶
        </button>

      </footer>

    </div>
  );
}

export default Editor;