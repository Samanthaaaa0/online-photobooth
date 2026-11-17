import { useState } from "react";

import "../PhotoSelection.css";
import { picksFor } from "../utils/session";
import type { LayoutType } from "../utils/session";

type PhotoSelectionProps = {
  photos: string[];
  layout: LayoutType | null;
  onBack: () => void;
  onContinue: (selectedPhotos: string[]) => void;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

const MODE_NAME: Record<LayoutType, string> = {
  "4-cuts": "4 CUTS",
  "6-cuts": "6 CUTS",
  meme: "MEME MODE",
};

function PhotoSelection({ photos, layout, onBack, onContinue }: PhotoSelectionProps) {
  // how many photos the strip needs
  const need = picksFor(layout);
  const wide = need > 4; // the 6-cut strip is a 2 x 3 sheet, the 4-cut one a single column

  // INDEX (in `photos`) of every picked photo, in the order they were picked
  const [picked, setPicked] = useState<number[]>([]);
  const full = picked.length === need;

  const toggle = (index: number) => {
    setPicked((current) => {
      if (current.includes(index)) return current.filter((i) => i !== index);
      if (current.length >= need) return current; // strip is full
      return [...current, index];
    });
  };

  const remaining = need - picked.length;

  return (
    <div className="ps-page">

      {/* ================= TOP BAR ================= */}
      <header className="ps-topbar">
        <div className="ps-brand">✦ PHOTOBOOTH.EXE</div>
        <div className="ps-title">PHOTO PICKER 2000</div>
        <div className="ps-status">
          <span className="ps-light">●</span>
          SELECTING
        </div>
      </header>

      <main className="ps-workspace">

        {/* ================= LEFT: info ================= */}
        <aside className="ps-panel ps-info">
          <div className="ps-heading">✦ PICK</div>

          <div className="ps-infobox">
            <span>MODE</span>
            <strong>{layout ? MODE_NAME[layout] : "4 CUTS"}</strong>
          </div>

          <div className="ps-infobox">
            <span>PICKED</span>
            <strong>
              {picked.length} / {need}
            </strong>
          </div>

          <ul className="ps-tips">
            <li>TAP A PHOTO TO PICK IT</li>
            <li>TAP AGAIN TO REMOVE IT</li>
            <li>THE ORDER YOU PICK IS THE ORDER ON YOUR STRIP</li>
          </ul>
        </aside>

        {/* ================= CENTRE: contact sheet ================= */}
        <section className="ps-sheet" aria-label="Your photos">
          <div className="ps-sheet-head">
            CHOOSE {need} OF YOUR {photos.length} PHOTOS
          </div>

          <div className="ps-grid">
            {photos.map((photo, index) => {
              const order = picked.indexOf(index);
              const isPicked = order !== -1;

              return (
                <button
                  key={index}
                  className={`ps-photo ${isPicked ? "picked" : ""} ${
                    full && !isPicked ? "dim" : ""
                  }`}
                  onClick={() => toggle(index)}
                  aria-pressed={isPicked}
                  aria-label={`Photo ${index + 1}${isPicked ? `, picked number ${order + 1}` : ""}`}
                >
                  <img src={photo} alt="" draggable={false} />
                  <span className="ps-num">{pad2(index + 1)}</span>
                  {isPicked && <span className="ps-order">{order + 1}</span>}
                </button>
              );
            })}
          </div>
        </section>

        {/* ================= RIGHT: live strip preview ================= */}
        <aside className="ps-panel ps-strip-panel">
          <div className="ps-heading">✦ YOUR STRIP</div>

          <div className="ps-strip-area">
            <div className={`ps-strip ${wide ? "six" : "four"}`}>
              {Array.from({ length: need }).map((_, slot) => {
                const index = picked[slot];
                const filled = index !== undefined;

                return (
                  <button
                    key={slot}
                    className={`ps-slot ${filled ? "filled" : ""}`}
                    onClick={() => filled && toggle(index)}
                    aria-label={
                      filled
                        ? `Strip place ${slot + 1}: photo ${index + 1}, tap to remove`
                        : `Strip place ${slot + 1}: empty`
                    }
                  >
                    {filled ? (
                      <img src={photos[index]} alt="" draggable={false} />
                    ) : (
                      <span>{slot + 1}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

      </main>

      {/* ================= FOOTER ================= */}
      <footer className="ps-footer">
        <button className="ps-back" onClick={onBack}>
          ◀ BACK
        </button>

        <div className="ps-hint" aria-live="polite">
          {full ? "✦ READY, LOOKS GOOD" : `PICK ${remaining} MORE`}
        </div>

        <div className="ps-footer-right">
          <button className="ps-clear" onClick={() => setPicked([])} disabled={picked.length === 0}>
            ↻ CLEAR
          </button>
          <button
            className="ps-continue"
            disabled={!full}
            onClick={() => onContinue(picked.map((i) => photos[i]))}
          >
            CONTINUE ▶
          </button>
        </div>
      </footer>

    </div>
  );
}

export default PhotoSelection;
