import { useState } from "react";
import "../Deco.css";

type LayoutType =
    | "4-cuts"
    | "6-cuts"
    | "meme";

type Decoration =
    | {
        id: string;
        type: "sticker";
        content: string;
        x: number;
        y: number;
        scale: number;
        rotation: number;
    }
    | {
        id: string;
        type: "text";
        content: string;
        x: number;
        y: number;
        scale: number;
        rotation: number;
    };

type Frame = {
    id: string;
    name: string;
    image: string;
};

type DecoProps = {
    photos: string[];
    layout: LayoutType | null;
    frame: Frame;
    onBack: () => void;
};

function Deco({
    photos,
    layout,
    frame,
    onBack,
}: DecoProps) {

    const [decorations, setDecorations] = useState<Decoration[]>([]);

    const [selectedId, setSelectedId] = useState<string | null>(null);

    return (
        <div className="deco-page">

            {/* ================= HEADER ================= */}

            <header className="deco-topbar">

                <div className="deco-brand">
                    ✦ PHOTOBOOTH.EXE
                </div>

                <div className="deco-title">
                    STICKER LAB 2000
                </div>

                <div className="deco-status">
                    <span className="status-light">●</span>
                    DECORATING
                </div>

            </header>


            {/* ================= MAIN ================= */}

            <main className="deco-workspace">


                {/* ========== LEFT PANEL ========== */}

                <aside className="deco-panel deco-left">

                    <div className="panel-heading">
                        ✦ DECORATE
                    </div>


                    {/* STICKERS */}

                    <section className="deco-group">

                        <div className="deco-heading">
                            STICKERS
                        </div>

                        <div className="sticker-grid">

                            <button>★</button>
                            <button>♡</button>
                            <button>✦</button>
                            <button>☆</button>
                            <button>☁</button>
                            <button>☾</button>
                            <button>✿</button>
                            <button>☺</button>

                        </div>

                    </section>


                    {/* TEXT */}

                    <section className="deco-group">

                        <div className="deco-heading">
                            TEXT
                        </div>

                        <button className="add-text-button">
                            ＋ ADD TEXT
                        </button>

                    </section>

                </aside>


                {/* ========== PREVIEW ========== */}

                <section className="deco-preview-area">

                    <div className="preview-label">
                        DECORATION PREVIEW
                    </div>


                    <div className="deco-canvas">

                        <div
                            className={`photo-print ${
                                layout === "6-cuts"
                                    ? "print-six"
                                    : "print-four"
                            }`}
                        >

                            {/* TOP */}

                            <div className="print-top-decoration">
                                ✦
                            </div>


                            {/* PHOTOS */}

                            <div
                                className={
                                    layout === "6-cuts"
                                        ? "photo-grid grid-six"
                                        : "photo-grid grid-four"
                                }
                            >

                                {photos.map((photo, index) => (

                                    <div
                                        className="strip-photo"
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


                            {/* BOTTOM */}

                            <div className="print-bottom">

                                <div className="print-date">
                                    PHOTOBOOTH 2000
                                </div>

                                <div className="print-stars">
                                    ✦ ♡ ✦
                                </div>

                            </div>


                            {/* FRAME */}

                            <img
                                src={frame.image}
                                className="frame-overlay"
                                alt=""
                            />


                            {/* DECORATIONS */}

                            {decorations.map((decoration) => (

                                <div
                                    key={decoration.id}
                                    className={`decoration decoration-${decoration.type} ${
                                        selectedId === decoration.id
                                            ? "selected"
                                            : ""
                                    }`}
                                    style={{
                                        left: `${decoration.x}%`,
                                        top: `${decoration.y}%`,
                                        transform: `
                                            translate(-50%, -50%)
                                            scale(${decoration.scale})
                                            rotate(${decoration.rotation}deg)
                                        `,
                                    }}
                                    onClick={() =>
                                        setSelectedId(decoration.id)
                                    }
                                >

                                    {decoration.content}

                                </div>

                            ))}

                        </div>

                    </div>

                </section>


                {/* ========== RIGHT PANEL ========== */}

                <aside className="deco-panel deco-right">

                    <div className="panel-heading">
                        ✦ OBJECT
                    </div>


                    {selectedId ? (

                        <>

                            <div className="info-box">
                                <span>
                                    SELECTED
                                </span>

                                <strong>
                                    DECORATION
                                </strong>
                            </div>


                            <button className="deco-action">
                                − SMALLER
                            </button>

                            <button className="deco-action">
                                ＋ BIGGER
                            </button>

                            <button className="deco-action">
                                ↻ ROTATE
                            </button>

                            <button className="deco-action">
                                🗑 DELETE
                            </button>

                        </>

                    ) : (

                        <div className="tiny-note">
                            ✦ SELECT A STICKER<br />
                            ✦ OR ADD TEXT<br />
                            ✦ THEN CUSTOMIZE
                        </div>

                    )}

                </aside>

            </main>


            {/* ================= FOOTER ================= */}

            <footer className="deco-footer">

                <button
                    className="deco-back-button"
                    onClick={onBack}
                >
                    ◀ BACK
                </button>


                <div className="deco-history">

                    <button>
                        ↶ UNDO
                    </button>

                    <button>
                        ↷ REDO
                    </button>

                    <button>
                        ↻ RESET
                    </button>

                </div>


                <button className="deco-save-button">
                    SAVE / PRINT ▶
                </button>

            </footer>

        </div>
    );
}

export default Deco;