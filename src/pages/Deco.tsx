import { useState } from "react";
import "../Deco.css";

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

type DecoProps = {
    image: string;
    onBack: () => void;
};

function Deco({
    image,
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
                    PHOTO EDITOR 2000
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

                    <div className="deco-image-wrapper">
                        <img
                            src={image}
                            className="final-photo"
                            alt="Finished photobooth"
                        />
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