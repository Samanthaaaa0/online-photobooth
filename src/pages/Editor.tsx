import { useEffect, useRef, useState } from "react";
import * as htmlToImage from 'html-to-image';

import "../Editor.css";
import { filterList } from "../filters/presets";
import type { FilterName } from "../filters/presets";
import { filterImage } from "../utils/applyFilter";
import { frames4, frames6 } from "../utils/frames";



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

function Editor({
  photos,
  layout,
  onBack,
  onContinue,
}: EditorProps) {

    const printRef = useRef<HTMLDivElement>(null);

    // The strip is built at a fixed design size (the frame art has its windows at exact pixels).
    // To fit ANY screen, a wrapper around it is scaled: the saved picture is captured from the inner
    // .photo-print node, which is never scaled, so the file always comes out at full size.
    const PRINT = layout === "6-cuts" ? { w: 420, h: 598 } : { w: 280, h: 650 };
    const areaRef = useRef<HTMLElement>(null);
    const [fit, setFit] = useState(1);

    useEffect(() => {
        const area = areaRef.current;
        if (!area) return;

        const compute = () => {
            const wrapper = area.querySelector<HTMLElement>(".frame-carousel-wrapper");
            if (!wrapper) return;

            const gap = parseFloat(getComputedStyle(wrapper).columnGap) || 0;
            let availW = wrapper.clientWidth;
            wrapper.querySelectorAll<HTMLElement>(".frame-arrow").forEach((a) => {
                availW -= a.offsetWidth + gap;
            });

            // the side previews only take room when they are shown
            const track = wrapper.querySelector<HTMLElement>(".frame-carousel-track");
            const trackGap = track ? parseFloat(getComputedStyle(track).columnGap) || 0 : 0;
            wrapper.querySelectorAll<HTMLElement>(".frame-neighbour").forEach((n) => {
                if (n.offsetWidth > 0) availW -= n.offsetWidth + trackGap;
            });

            const availH = area.clientHeight - 14;
            const next = Math.max(
                0.2,
                Math.min(1.35, availW / PRINT.w, availH / PRINT.h)
            );
            setFit((prev) => (Math.abs(prev - next) < 0.004 ? prev : next));
        };

        compute();
        const ro = new ResizeObserver(compute);
        ro.observe(area);
        return () => ro.disconnect();
    }, [PRINT.w, PRINT.h]);

    // each layout has its own frame art (different size and window positions)
    const frames = layout === "6-cuts" ? frames6 : frames4;

    const [filter, setFilter] = useState<FilterName>("normal");
    const [filteredPhotos, setFilteredPhotos] = useState<string[]>(photos);

    // small live previews of every look, made from your first photo
    const [thumbs, setThumbs] = useState<Partial<Record<FilterName, string>>>({});

    useEffect(() => {
        if (photos.length === 0) return;
        let cancelled = false;

        (async () => {
            const entries = await Promise.all(
                filterList.map(async (f) => {
                    try {
                        return [f.id, await filterImage(photos[0], f.id, 140)] as const;
                    } catch {
                        return [f.id, ""] as const;
                    }
                })
            );
            if (!cancelled) setThumbs(Object.fromEntries(entries));
        })();

        return () => {
            cancelled = true;
        };
    }, [photos]);

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
            // pixelRatio 3: the strip is only ~280x650 CSS px, so without this the
            // saved picture would be tiny and look soft once it is saved or printed
            const image = await htmlToImage.toPng(printRef.current, {
                pixelRatio: 3,
            });
            
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

                    <div className="filter-grid">
                        {filterList.map((f) => (
                            <button
                                key={f.id}
                                className={`filter-tile ${
                                    filter === f.id ? "active" : ""
                                }`}
                                onClick={() => setFilter(f.id)}
                                aria-pressed={filter === f.id}
                            >
                                <span className="filter-thumb">
                                    {thumbs[f.id] ? (
                                        <img src={thumbs[f.id]} alt="" />
                                    ) : null}
                                </span>
                                <span className="filter-name">{f.label}</span>
                            </button>
                        ))}
                    </div>

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

            <section className="editor-preview-area" ref={areaRef}>

                <div
                    className={`frame-carousel-wrapper ${
                        layout === "6-cuts" ? "is-six" : ""
                    }`}
                >

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
                                            style={{
                                                width: PRINT.w * fit,
                                                height: PRINT.h * fit,
                                            }}
                                        >
                                          <div
                                            className="print-scale"
                                            style={{
                                                width: PRINT.w,
                                                height: PRINT.h,
                                                transform: `scale(${fit})`,
                                            }}
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