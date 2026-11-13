import React, { useState, useRef } from "react";
import "../deco.css";

type Decoration = {
    id: string;
    type: "text" | "sticker";
    content: string;

    x: number;
    y: number;

    width: number;
    height: number;

    rotation: number;
};

type DecoProps = {
    image: string;
    onBack: () => void;
};

type Action = "move" | "resize" | "rotate";

function Deco({ image, onBack }: DecoProps) {

    const [decorations, setDecorations] = useState<Decoration[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    const canvasRef = useRef<HTMLDivElement>(null);


    // =====================================================
    // ADD TEXT
    // =====================================================

    const addText = () => {

        const newText: Decoration = {
            id: crypto.randomUUID(),

            type: "text",

            content: "Double tap to edit",

            x: 100,
            y: 100,

            width: 180,
            height: 60,

            rotation: 0,
        };

        setDecorations((prev) => [
            ...prev,
            newText,
        ]);

        setSelectedId(newText.id);
    };


    // =====================================================
    // ADD STICKER
    // =====================================================

    const addSticker = (sticker: string) => {

        const newSticker: Decoration = {
            id: crypto.randomUUID(),

            type: "sticker",

            content: sticker,

            x: 100,
            y: 100,

            width: 70,
            height: 70,

            rotation: 0,
        };

        setDecorations((prev) => [
            ...prev,
            newSticker,
        ]);

        setSelectedId(newSticker.id);
    };


    // =====================================================
    // POINTER INTERACTION
    // =====================================================

    const handlePointerDown = (
        e: React.PointerEvent,
        id: string,
        action: Action
    ) => {

        e.preventDefault();
        e.stopPropagation();

        setSelectedId(id);

        const decoration = decorations.find(
            (item) => item.id === id
        );

        if (!decoration) return;


        const startX = e.clientX;
        const startY = e.clientY;

        const startWidth = decoration.width;
        const startHeight = decoration.height;

        const startPosX = decoration.x;
        const startPosY = decoration.y;

        const startRotation = decoration.rotation;


        // -------------------------------------------------
        // Find object center
        // -------------------------------------------------

        const element = (
            e.currentTarget
                .parentElement
                ?.querySelector(".decoration-box")
        ) as HTMLElement | null;

        const rect =
            element?.getBoundingClientRect();


        const centerX = rect
            ? rect.left + rect.width / 2
            : startX;

        const centerY = rect
            ? rect.top + rect.height / 2
            : startY;


        const startAngle =
            Math.atan2(
                startY - centerY,
                startX - centerX
            ) *
            (180 / Math.PI);


        // -------------------------------------------------
        // POINTER MOVE
        // -------------------------------------------------

        const handlePointerMove = (
            moveEvent: PointerEvent
        ) => {

            const deltaX =
                moveEvent.clientX - startX;

            const deltaY =
                moveEvent.clientY - startY;


            setDecorations((prev) =>
                prev.map((item) => {

                    if (item.id !== id) {
                        return item;
                    }


                    // =====================================
                    // MOVE
                    // =====================================

                    if (action === "move") {

                        return {
                            ...item,

                            x:
                                startPosX +
                                deltaX,

                            y:
                                startPosY +
                                deltaY,
                        };
                    }


                    // =====================================
                    // RESIZE
                    // =====================================

                    if (action === "resize") {

                        const newWidth =
                            Math.max(
                                40,
                                startWidth +
                                    deltaX
                            );

                        const newHeight =
                            Math.max(
                                30,
                                startHeight +
                                    deltaY
                            );

                        return {
                            ...item,

                            width: newWidth,
                            height: newHeight,
                        };
                    }


                    // =====================================
                    // ROTATE
                    // =====================================

                    if (action === "rotate") {

                        const currentAngle =
                            Math.atan2(
                                moveEvent.clientY -
                                    centerY,

                                moveEvent.clientX -
                                    centerX
                            ) *
                            (180 / Math.PI);


                        const rotationChange =
                            currentAngle -
                            startAngle;


                        return {
                            ...item,

                            rotation:
                                startRotation +
                                rotationChange,
                        };
                    }


                    return item;
                })
            );
        };


        // -------------------------------------------------
        // POINTER UP
        // -------------------------------------------------

        const handlePointerUp = () => {

            document.removeEventListener(
                "pointermove",
                handlePointerMove
            );

            document.removeEventListener(
                "pointerup",
                handlePointerUp
            );
        };


        document.addEventListener(
            "pointermove",
            handlePointerMove
        );

        document.addEventListener(
            "pointerup",
            handlePointerUp
        );
    };


    // =====================================================
    // UPDATE TEXT
    // =====================================================

    const updateText = (
        id: string,
        text: string
    ) => {

        setDecorations((prev) =>
            prev.map((item) =>
                item.id === id
                    ? {
                        ...item,
                        content: text,
                    }
                    : item
            )
        );
    };


    // =====================================================
    // DELETE
    // =====================================================

    const deleteSelected = () => {

        if (!selectedId) return;

        setDecorations((prev) =>
            prev.filter(
                (item) =>
                    item.id !== selectedId
            )
        );

        setSelectedId(null);
        setEditingId(null);
    };


    // =====================================================
    // RESET
    // =====================================================

    const resetDecorations = () => {

        setDecorations([]);

        setSelectedId(null);

        setEditingId(null);
    };


    // =====================================================
    // RENDER
    // =====================================================

    return (

        <div className="deco-page">


            {/* =================================================
                HEADER
            ================================================= */}

            <header className="deco-topbar">

                <div className="deco-brand">
                    ✦ PHOTOBOOTH.EXE
                </div>

                <div className="deco-title">
                    PHOTO EDITOR 2000
                </div>

                <div className="deco-status">

                    <span className="status-light">
                        ●
                    </span>

                    DECORATING

                </div>

            </header>



            {/* =================================================
                MAIN
            ================================================= */}

            <main className="deco-workspace">


                {/* =================================================
                    LEFT PANEL
                ================================================= */}

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

                            {[
                                "★",
                                "♡",
                                "✦",
                                "☆",
                                "☁",
                                "☾",
                                "✿",
                                "☺",
                            ].map((sticker) => (

                                <button
                                    key={sticker}
                                    onClick={() =>
                                        addSticker(
                                            sticker
                                        )
                                    }
                                >
                                    {sticker}
                                </button>

                            ))}

                        </div>

                    </section>


                    {/* TEXT */}

                    <section className="deco-group">

                        <div className="deco-heading">
                            TEXT
                        </div>

                        <button
                            className="add-text-button"
                            onClick={addText}
                        >
                            ＋ ADD TEXT
                        </button>

                    </section>

                </aside>



                {/* =================================================
                    CANVAS
                ================================================= */}

                <section className="deco-preview-area">

                    <div
                        className="canvas-area"
                        ref={canvasRef}
                        onPointerDown={() =>
                            setSelectedId(null)
                        }
                    >

                        {/* PHOTO */}

                        <img
                            src={image}
                            className="final-photo"
                            alt="Finished photobooth"
                        />


                        {/* DECORATIONS */}

                        {decorations.map((item) => {

                            const isSelected =
                                selectedId ===
                                item.id;

                            const isEditing =
                                editingId ===
                                item.id;


                            return (

                                <div
                                    key={item.id}

                                    className={`textbox-wrapper ${
                                        isSelected
                                            ? "active"
                                            : ""
                                    }`}

                                    style={{
                                        transform:
                                            `translate(${item.x}px, ${item.y}px) rotate(${item.rotation}deg)`,

                                        width:
                                            `${item.width}px`,

                                        height:
                                            `${item.height}px`,
                                    }}

                                    onPointerDown={(e) =>
                                        e.stopPropagation()
                                    }

                                    onDoubleClick={() => {

                                        if (
                                            item.type ===
                                            "text"
                                        ) {
                                            setEditingId(
                                                item.id
                                            );
                                        }

                                    }}
                                >


                                    {/* =================================
                                        MOVE AREA
                                    ================================= */}

                                    <div
                                        className="drag-handle"
                                        onPointerDown={(e) =>
                                            handlePointerDown(
                                                e,
                                                item.id,
                                                "move"
                                            )
                                        }
                                    />


                                    {/* =================================
                                        CONTENT
                                    ================================= */}

                                    {item.type ===
                                    "text" ? (

                                        isEditing ? (

                                            <textarea
                                                className="text-content editing"
                                                value={
                                                    item.content
                                                }
                                                autoFocus

                                                onChange={(e) =>
                                                    updateText(
                                                        item.id,
                                                        e.target
                                                            .value
                                                    )
                                                }

                                                onBlur={() =>
                                                    setEditingId(
                                                        null
                                                    )
                                                }

                                                onKeyDown={(e) => {

                                                    if (
                                                        e.key ===
                                                            "Enter" &&
                                                        !e.shiftKey
                                                    ) {

                                                        e.preventDefault();

                                                        setEditingId(
                                                            null
                                                        );
                                                    }

                                                    if (
                                                        e.key ===
                                                        "Escape"
                                                    ) {

                                                        setEditingId(
                                                            null
                                                        );
                                                    }

                                                }}

                                                onPointerDown={(e) =>
                                                    e.stopPropagation()
                                                }
                                            />

                                        ) : (

                                            <div className="text-content">

                                                {
                                                    item.content
                                                }

                                            </div>

                                        )

                                    ) : (

                                        <div className="sticker-content">

                                            {
                                                item.content
                                            }

                                        </div>

                                    )}


                                    {/* =================================
                                        CONTROLS
                                    ================================= */}

                                    {isSelected &&
                                        !isEditing && (
                                            <>

                                                {/* ROTATE */}

                                                <div
                                                    className="control-rotate"
                                                    onPointerDown={(e) =>
                                                        handlePointerDown(
                                                            e,
                                                            item.id,
                                                            "rotate"
                                                        )
                                                    }
                                                >
                                                    ↻
                                                </div>


                                                {/* RESIZE */}

                                                <div
                                                    className="control-resize"
                                                    onPointerDown={(e) =>
                                                        handlePointerDown(
                                                            e,
                                                            item.id,
                                                            "resize"
                                                        )
                                                    }
                                                />

                                            </>
                                        )}

                                </div>
                            );
                        })}

                    </div>

                </section>



                {/* =================================================
                    RIGHT PANEL
                ================================================= */}

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

                                    {decorations.find(
                                        (item) =>
                                            item.id ===
                                            selectedId
                                    )?.type ===
                                    "text"
                                        ? "TEXT"
                                        : "STICKER"}

                                </strong>

                            </div>


                            <div className="object-help">

                                <div>
                                    ✦ DRAG TO MOVE
                                </div>

                                <div>
                                    ✦ CORNER TO RESIZE
                                </div>

                                <div>
                                    ✦ ↻ TO ROTATE
                                </div>

                                <div>
                                    ✦ DOUBLE CLICK TEXT
                                </div>

                            </div>


                            <button
                                className="deco-action delete-action"
                                onClick={
                                    deleteSelected
                                }
                            >
                                🗑 DELETE
                            </button>

                        </>

                    ) : (

                        <div className="tiny-note">

                            ✦ SELECT A STICKER
                            <br />

                            ✦ OR ADD TEXT
                            <br />

                            ✦ DRAG TO MOVE
                            <br />

                            ✦ DOUBLE CLICK TEXT

                        </div>

                    )}

                </aside>

            </main>



            {/* =================================================
                FOOTER
            ================================================= */}

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

                    <button
                        onClick={
                            resetDecorations
                        }
                    >
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