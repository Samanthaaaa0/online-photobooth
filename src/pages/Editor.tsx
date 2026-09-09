import { useEffect, useRef, useState } from "react";
import * as htmlToImage from 'html-to-image';

import "../Editor.css";
import type { FilterName } from "../filters/presets";
import { filterImage } from "../utils/applyFilter";

import buttonFrame from "../assets/4cuts/button.png";
import polkadotsFrame from "../assets/4cuts/polkadots.png";


type LayoutType =
  | "4-cuts"
  | "6-cuts"
  | "meme";

type EditorProps = {
  photos: string[];
  layout: LayoutType | null;
  onBack: () => void;
  onContinue: (image: string) => void;
};

type Frame = {
  id: string;
  name: string;
  image: string;
};

const frames: Frame[] = [
  {
    id: "button",
    name: "BUTTON",
    image: buttonFrame,
  },
  {
    id: "polkadots",
    name: "POLKA DOTS",
    image: polkadotsFrame,
  },
];

function Editor({
  photos,
  layout,
  onBack,
  onContinue,
}: EditorProps) {

    const printRef = useRef<HTMLDivElement>(null);

    const [filter, setFilter] = useState<FilterName>("normal");
    const [filteredPhotos, setFilteredPhotos] = useState<string[]>(photos);

    // frame 
    const [frameIndex, setFrameIndex] = useState(0);

    const nextFrame = () => {
        setFrameIndex((current) => (current + 1) % frames.length);
    };

    const previousFrame = () => {
        setFrameIndex(
            (current) => (current - 1 + frames.length) % frames.length
        );
    };

    const layoutName =
        layout === "4-cuts"
        ? "4 CUTS"
        : layout === "6-cuts"
            ? "6 CUTS"
            : "MEME MODE";

    useEffect(() => {
        const updatePhotos = async () => {
            try {
            const result = await Promise.all(
                photos.map((photo) =>
                    filterImage(photo, filter)
                )
            );

            setFilteredPhotos(result);
            } catch (error) {
            console.error(
                "Failed to apply filter:",
                error
            );
            }
        };

        updatePhotos();
        }, [photos, filter]);

    // visible frames for carousel: previous, current, next
    const visibleFrames = [-1, 0, 1].map((offset) => {
        const index =
            (frameIndex + offset + frames.length) % frames.length;

        return {
            ...frames[index],
            offset,
        };
    });

    const handleContinue = async () => {
        if (!printRef.current) {
            console.error("printRef is NULL!");
            return;
        }

        try {
            // html-to-image generates the final base64 string directly
            const image = await htmlToImage.toPng(printRef.current);
            
            console.log("IMAGE:", image.substring(0, 100));

            const debugWindow = window.open();

            if (debugWindow) {
            debugWindow.document.write(`
                <html>
                <body style="
                    margin: 0;
                    background: #222;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                ">
                    <img src="${image}" style="max-width: 90vw; max-height: 90vh;" />
                </body>
                </html>
            `);
            }
            
            // Pass the valid image to your parent function
            onContinue(image);
            
        } catch (error) {
            console.error('Oops, something went wrong!', error);
        }
    }

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

                <div className="panel-heading">✦ DECORATE</div>

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
                        filter === "blackWhite" ? "active" : ""
                        }`}
                        onClick={() => setFilter("blackWhite")}
                    >
                        ○ B&W
                    </button>

                    <button
                        className={`editor-option ${
                        filter === "warmVintage" ? "active" : ""
                        }`}
                        onClick={() => setFilter("warmVintage")}
                    >
                        ○ WARM VINTAGE
                    </button>

                    <button
                        className={`editor-option ${
                        filter === "polaroid" ? "active" : ""
                        }`}
                        onClick={() => setFilter("polaroid")}
                    >
                        ○ POLAROID
                    </button>

                    <button
                        className={`editor-option ${
                        filter === "digicamSoftLight" ? "active" : ""
                        }`}
                        onClick={() => setFilter("digicamSoftLight")}
                    >
                        ○ DIGICAM
                    </button>

                    <button
                        className={`editor-option ${
                        filter === "coolTone" ? "active" : ""
                        }`}
                        onClick={() => setFilter("coolTone")}
                    >
                        ○ COOL TONE
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

                <div className="frame-carousel-wrapper">

                    <button
                        className="frame-arrow"
                        onClick={previousFrame}
                    >
                        ◀
                    </button>

                    <div className="frame-carousel-window">

                        <div className="frame-carousel-track">

                            {visibleFrames.map((item) => {

                                if (item.offset === 0) {
                                    return (
                                        <div
                                            key={`${item.id}-current`}
                                            className="frame-current"
                                        >
                                            <div
                                                ref={printRef}
                                                className={`photo-print ${
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
                                                    {filteredPhotos.map(
                                                        (photo, index) => (
                                                            <div
                                                                className="strip-photo"
                                                                key={index}
                                                            >
                                                                <img
                                                                    src={photo}
                                                                    alt={`Photo ${index + 1}`}
                                                                />

                                                                <span className="photo-number">
                                                                    {String(index + 1).padStart(
                                                                        2,
                                                                        "0"
                                                                    )}
                                                                </span>
                                                            </div>
                                                        )
                                                    )}
                                                </div>

                                                <div className="print-bottom">

                                                    <div className="print-date">
                                                        PHOTOBOOTH 2000
                                                    </div>

                                                    

                                                </div>

                                                <img
                                                    src={item.image}
                                                    className="frame-overlay"
                                                    alt=""
                                                />

                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div
                                        key={`${item.id}-${item.offset}`}
                                        className={`frame-neighbour offset-${item.offset}`}
                                    >
                                        <img
                                            src={item.image}
                                            alt=""
                                        />
                                    </div>
                                );
                            })}

                        </div>

                    </div>

                    <button
                        className="frame-arrow"
                        onClick={nextFrame}
                    >
                        ▶
                    </button>

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

                ✦ CHOOSE A FRAME YOU LIKE<br />
                ✦ PICK YOUR FILTER<br/>
                ✦ SAVE YOUR MEMORIES

            </div>

            </aside>

        </main>

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
                onClick={
                    handleContinue}
            >
                DECORATE ▶
            </button>

        </footer>

        </div>
    );
}

export default Editor;