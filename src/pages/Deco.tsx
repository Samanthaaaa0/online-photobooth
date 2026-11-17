import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import "../deco.css";
import {
  DEFAULT_COLOUR,
  DEFAULT_FONT,
  FONTS,
  STICKER_CATEGORIES,
  TEXT_COLOURS,
  TEXT_PRESETS,
  ensureFonts,
  fontCss,
  loadImage,
  stickerArt,
  stickersIn,
  textArt,
} from "../utils/decoAssets";
import type { Art, FontId } from "../utils/decoAssets";

// =====================================================================
// MODEL
// Positions and sizes are FRACTIONS OF THE PICTURE (0..1), never pixels.
// That is why stickers stay put when the window resizes, and why the saved
// PNG is identical to what is on screen at any resolution.
//   cx, cy : centre of the item (fraction of picture width / height)
//   w      : item width (fraction of picture width). Height follows the art.
//   rot    : degrees
// =====================================================================

type Item = {
  id: string;
  kind: "sticker" | "text";
  sticker?: string;
  text?: string;
  font?: FontId;
  colour?: string;
  cx: number;
  cy: number;
  w: number;
  rot: number;
};

type DecoProps = {
  image: string;
  onBack: () => void;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const HISTORY_LIMIT = 60;

const artFor = (item: Item): Art =>
  item.kind === "sticker"
    ? stickerArt(item.sticker ?? "")
    : textArt(item.text ?? "", item.font ?? DEFAULT_FONT, item.colour ?? DEFAULT_COLOUR);

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());

/** font chips (each in its own face) + the five text colours */
function TextLook({
  font,
  colour,
  onFont,
  onColour,
}: {
  font: FontId;
  colour: string;
  onFont: (f: FontId) => void;
  onColour: (hex: string) => void;
}) {
  const current = FONTS.find((f) => f.id === font);

  return (
    <>
      <div className="deco-heading">FONT</div>
      <div className="font-row">
        {FONTS.map((f) => (
          <button
            key={f.id}
            className={`font-chip ${font === f.id ? "active" : ""}`}
            style={{ fontFamily: fontCss(f), fontWeight: f.weight, fontSize: f.chip.size }}
            onClick={() => onFont(f.id)}
            aria-pressed={font === f.id}
            aria-label={`Font: ${f.label}`}
            title={f.label}
          >
            {f.chip.label}
          </button>
        ))}
      </div>
      {current?.note && <div className="font-note">{current.note}</div>}

      <div className="deco-heading">COLOUR</div>
      <div className="colour-row">
        {TEXT_COLOURS.map((c) => (
          <button
            key={c.id}
            className={`colour-swatch ${
              colour.toLowerCase() === c.hex.toLowerCase() ? "active" : ""
            }`}
            style={{ background: c.hex }}
            onClick={() => onColour(c.hex)}
            aria-label={`${c.label} ${c.hex}`}
            aria-pressed={colour.toLowerCase() === c.hex.toLowerCase()}
            title={c.hex}
          />
        ))}
      </div>
    </>
  );
}

function Deco({ image, onBack }: DecoProps) {
  const [items, setItems] = useState<Item[]>([]);
  const itemsRef = useRef<Item[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"stickers" | "text">("stickers");
  const [category, setCategory] = useState(STICKER_CATEGORIES[0]?.id ?? "");
  const [textFont, setTextFont] = useState<FontId>(DEFAULT_FONT);
  const [textColour, setTextColour] = useState<string>(DEFAULT_COLOUR);

  // TikTok Sans loads asynchronously: redraw the word-art once it is ready
  const [, setFontTick] = useState(0);
  useEffect(() => {
    ensureFonts().then((loaded) => {
      if (loaded) setFontTick((t) => t + 1);
    });
  }, []);
  const [popId, setPopId] = useState<string | null>(null);

  // inline text editing: double-click (or double-tap) a word on the picture
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingRef = useRef<string | null>(null);
  const editBeforeRef = useRef<Item[] | null>(null);
  const lastTapRef = useRef<{ id: string; t: number } | null>(null);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const pastRef = useRef<Item[][]>([]);
  const futureRef = useRef<Item[][]>([]);

  // picture proportions (4-cut strips are tall and narrow, 6-cut ones are wider)
  const [imgAspect, setImgAspect] = useState(0.43);
  useEffect(() => {
    let alive = true;
    loadImage(image)
      .then((img) => {
        if (alive && img.naturalHeight > 0) {
          setImgAspect(img.naturalWidth / img.naturalHeight);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [image]);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const textTarget = selected && selected.kind === "text" ? selected : null;

  // ===================================================================
  // STATE + HISTORY
  // ===================================================================

  /** replace the items (keeps the ref the pointer handlers read in sync) */
  const setAll = (next: Item[]) => {
    itemsRef.current = next;
    setItems(next);
  };

  const syncFlags = () => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  };

  /** remember `before` so UNDO can return to it */
  const record = (before: Item[]) => {
    pastRef.current.push(before);
    if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift();
    futureRef.current = [];
    syncFlags();
  };

  /** a one-step change that is undoable (add, delete, restyle ...) */
  const change = (next: Item[]) => {
    record(itemsRef.current);
    setAll(next);
  };

  const undo = () => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current.push(itemsRef.current);
    setAll(prev);
    if (selectedId && !prev.some((i) => i.id === selectedId)) setSelectedId(null);
    syncFlags();
  };

  const redo = () => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(itemsRef.current);
    setAll(next);
    if (selectedId && !next.some((i) => i.id === selectedId)) setSelectedId(null);
    syncFlags();
  };

  // ===================================================================
  // ADD / EDIT / DELETE
  // ===================================================================

  const place = (item: Item) => {
    change([...itemsRef.current, item]);
    setSelectedId(item.id);
    setPopId(item.id);
    window.setTimeout(() => setPopId((p) => (p === item.id ? null : p)), 450);
  };

  // small random offset so repeated taps don't stack exactly
  const spread = () => (Math.random() - 0.5) * 0.14;

  const addSticker = (id: string) => {
    place({
      id: newId(),
      kind: "sticker",
      sticker: id,
      cx: 0.5 + spread(),
      cy: 0.45 + spread(),
      // ~15% of the strip's HEIGHT for a typical sticker (a third of the width on a
      // tall 4-cut strip), scaled by how big the artwork really is: keys come out
      // small, tape and glasses come out wide
      w: clamp((0.155 / imgAspect) * ((stickerArt(id).natW ?? 230) / 230), 0.1, 0.8),
      rot: Math.round((Math.random() - 0.5) * 24),
    });
  };

  const addText = (text: string): string => {
    const art = textArt(text, textFont, textColour);
    const id = newId();
    place({
      id,
      kind: "text",
      text,
      font: textFont,
      colour: textColour,
      cx: 0.5 + spread(),
      cy: 0.5 + spread(),
      // about the same visual height whatever the word length
      w: clamp(0.11 / art.aspect, 0.2, 0.9),
      rot: Math.round((Math.random() - 0.5) * 12),
    });
    return id;
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    change(itemsRef.current.filter((i) => i.id !== selectedId));
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    const src = itemsRef.current.find((i) => i.id === selectedId);
    if (!src) return;
    const copy: Item = {
      ...src,
      id: newId(),
      cx: clamp(src.cx + 0.05, 0, 1),
      cy: clamp(src.cy + 0.05, 0, 1),
    };
    place(copy);
  };

  const clearAll = () => {
    if (itemsRef.current.length === 0) return;
    change([]); // undoable, so it is safe to press by accident
    setSelectedId(null);
  };

  // ===================================================================
  // INLINE TEXT EDITING (double-click a word on the picture)
  // ===================================================================

  /** change a word's text / font / colour and keep its letters the same height */
  const withSameHeight = (item: Item, patch: Partial<Item>): Item => {
    const next = { ...item, ...patch };
    if ((next.text ?? "").trim() === "") return next; // nothing to measure: keep the width
    const before = artFor(item).aspect;
    const after = artFor(next).aspect;
    return { ...next, w: clamp((item.w * before) / after, 0.06, 1.2) };
  };

  /** font / colour from the left panel: applies to the selected word (undoable) */
  const restyleSelected = (patch: Partial<Item>) => {
    if (!selectedId) return;
    change(
      itemsRef.current.map((i) => (i.id === selectedId ? withSameHeight(i, patch) : i))
    );
  };

  const beginEdit = (id: string) => {
    const it = itemsRef.current.find((i) => i.id === id);
    if (!it || it.kind !== "text" || editingRef.current) return;
    editBeforeRef.current = itemsRef.current;
    editingRef.current = id;
    setSelectedId(id);
    setEditingId(id);
    setTab("text");
  };

  const onEditChange = (value: string) => {
    const id = editingRef.current;
    if (!id) return;
    setAll(
      itemsRef.current.map((i) => (i.id === id ? withSameHeight(i, { text: value }) : i))
    );
  };

  /** Enter / click away = keep. Esc = put the old text back. An empty word is removed. */
  const endEdit = (cancel = false) => {
    const id = editingRef.current;
    if (!id) return;
    editingRef.current = null;
    setEditingId(null);

    const before = editBeforeRef.current;
    editBeforeRef.current = null;
    if (!before) return;

    if (cancel) {
      setAll(before);
      return;
    }
    const it = itemsRef.current.find((i) => i.id === id);
    if (it && (it.text ?? "").trim() === "") {
      record(before);
      setAll(itemsRef.current.filter((i) => i.id !== id));
      setSelectedId(null);
    } else if (before !== itemsRef.current) {
      record(before); // the whole edit = one undo step
    }
  };

  // ===================================================================
  // DRAG: move anywhere on the item, or scale + rotate from the corner
  // ===================================================================

  const startDrag = (
    e: ReactPointerEvent<HTMLElement>,
    item: Item,
    mode: "move" | "transform"
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const stage = stageRef.current;
    if (!stage) return;

    // finish any text edit first so it becomes its own undo step
    endEdit();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

    const rect = stage.getBoundingClientRect();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    setSelectedId(item.id);
    if (item.kind === "text") setTab("text");

    const before = itemsRef.current;
    const start = { x: e.clientX, y: e.clientY, ...item };

    // item centre on screen (for scale / rotate)
    const cxPx = rect.left + item.cx * rect.width;
    const cyPx = rect.top + item.cy * rect.height;
    const startDist = Math.hypot(e.clientX - cxPx, e.clientY - cyPx) || 1;
    const startAngle = Math.atan2(e.clientY - cyPx, e.clientX - cxPx);

    let moved = false;

    const onMove = (ev: PointerEvent) => {
      moved = true;
      let patch: Partial<Item>;

      if (mode === "move") {
        patch = {
          cx: clamp(start.cx + (ev.clientX - start.x) / rect.width, 0, 1),
          cy: clamp(start.cy + (ev.clientY - start.y) / rect.height, 0, 1),
        };
      } else {
        const dist = Math.hypot(ev.clientX - cxPx, ev.clientY - cyPx);
        const angle = Math.atan2(ev.clientY - cyPx, ev.clientX - cxPx);
        patch = {
          w: clamp((start.w * dist) / startDist, 0.06, 1.2),
          rot: start.rot + ((angle - startAngle) * 180) / Math.PI,
        };
      }

      setAll(
        itemsRef.current.map((i) => (i.id === item.id ? { ...i, ...patch } : i))
      );
    };

    const onUp = () => {
      el.removeEventListener("pointermove", onMove as EventListener);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      if (moved) {
        record(before); // the whole drag = one undo step
        lastTapRef.current = null;
      } else if (mode === "move" && item.kind === "text") {
        // two quick taps on the same word (mouse or finger) = edit it
        const now = performance.now();
        const last = lastTapRef.current;
        if (last && last.id === item.id && now - last.t < 380) {
          lastTapRef.current = null;
          beginEdit(item.id);
        } else {
          lastTapRef.current = { id: item.id, t: now };
        }
      }
    };

    el.addEventListener("pointermove", onMove as EventListener);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  };

  // ===================================================================
  // KEYBOARD: Delete, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z / Ctrl+Y, Esc
  // ===================================================================

  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e) => {
    const typing =
      e.target instanceof HTMLElement &&
      (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key.toLowerCase() === "z") {
      if (typing) return; // let the text box undo its own typing
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && e.key.toLowerCase() === "y") {
      if (typing) return;
      e.preventDefault();
      redo();
    } else if (!typing && (e.key === "Delete" || e.key === "Backspace")) {
      e.preventDefault();
      deleteSelected();
    } else if (e.key === "Escape") {
      if (editingRef.current) return; // the edit box handles it
      setSelectedId(null);
    }
  };

  useEffect(() => {
    const fn = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  // ===================================================================
  // SAVE: draw the picture + every sticker onto a canvas, download a PNG
  // ===================================================================

  const save = async () => {
    if (saving) return;
    setSaving(true);

    try {
      const base = await loadImage(image);

      // export at least ~1800px on the long side: stickers are vector, so
      // they stay crisp even if the photo itself has to be scaled up
      const longSide = Math.max(base.naturalWidth, base.naturalHeight);
      const scale = Math.max(1, 1800 / longSide);
      const W = Math.round(base.naturalWidth * scale);
      const H = Math.round(base.naturalHeight * scale);

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(base, 0, 0, W, H);

      for (const item of itemsRef.current) {
        const art = artFor(item);
        const img = await loadImage(art.src);
        const w = item.w * W;
        const h = w * art.aspect;

        ctx.save();
        ctx.translate(item.cx * W, item.cy * H);
        ctx.rotate((item.rot * Math.PI) / 180);
        ctx.imageSmoothingEnabled = !art.pixel; // pixel art stays crisp
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("could not create the image");

      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const name = `photobooth-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(
        d.getDate()
      )}-${pad(d.getHours())}${pad(d.getMinutes())}.png`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);

      setToast("✦ SAVED TO YOUR DEVICE");
    } catch (err) {
      console.error("Save failed:", err);
      setToast("COULD NOT SAVE, TRY AGAIN");
    } finally {
      setSaving(false);
      window.setTimeout(() => setToast(null), 2600);
    }
  };

  // position / size / rotation of an item as CSS (all relative to the picture)
  const boxStyle = (item: Item) => ({
    left: `${item.cx * 100}%`,
    top: `${item.cy * 100}%`,
    width: `${item.w * 100}%`,
    aspectRatio: `${1 / artFor(item).aspect}`,
    transform: `translate(-50%, -50%) rotate(${item.rot}deg)`,
  });

  // ===================================================================
  // RENDER
  // ===================================================================

  return (
    <div className="deco-page">
      <header className="deco-topbar">
        <div className="deco-brand">✦ PHOTOBOOTH.EXE</div>
        <div className="deco-title">PHOTO EDITOR 2000</div>
        <div className="deco-status">
          <span className="status-light">●</span>
          DECORATING
        </div>
      </header>

      <main className="deco-workspace">
        {/* ================= LEFT: pick something ================= */}
        <aside className="deco-panel deco-left">
          <div className="panel-heading">✦ DECORATE</div>

          <div className="deco-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={tab === "stickers"}
              className={tab === "stickers" ? "active" : ""}
              onClick={() => setTab("stickers")}
            >
              STICKERS
            </button>
            <button
              role="tab"
              aria-selected={tab === "text"}
              className={tab === "text" ? "active" : ""}
              onClick={() => setTab("text")}
            >
              TEXT
            </button>
          </div>

          {tab === "stickers" ? (
            <>
              <div className="cat-row" role="tablist" aria-label="Sticker categories">
                {STICKER_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    role="tab"
                    aria-selected={category === c.id}
                    className={`cat-chip ${category === c.id ? "active" : ""}`}
                    onClick={() => setCategory(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div
                className={`sticker-grid ${category === "keys" ? "cols-4" : ""}`}
              >
                {stickersIn(category).map((s) => (
                  <button
                    key={s.id}
                    title={s.label}
                    aria-label={`Add ${s.label}`}
                    onClick={() => addSticker(s.id)}
                  >
                    <img
                      src={s.src}
                      alt=""
                      draggable={false}
                      loading="lazy"
                      style={s.pixel ? { imageRendering: "pixelated" } : undefined}
                    />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="font-note edit-hint">
                {textTarget
                  ? "Font and colour change the selected word. Double-click it to edit the letters."
                  : "Pick a font and colour, then tap a word to add it. Double-click a word on the picture to edit it."}
              </div>

              <TextLook
                font={textTarget?.font ?? textFont}
                colour={textTarget?.colour ?? textColour}
                onFont={(f) => {
                  setTextFont(f);
                  if (textTarget) restyleSelected({ font: f });
                }}
                onColour={(hex) => {
                  setTextColour(hex);
                  if (textTarget) restyleSelected({ colour: hex });
                }}
              />

              <div className="deco-heading">TAP TO ADD</div>
              <div className="text-preset-grid">
                {TEXT_PRESETS.map((t) => (
                  <button key={t} onClick={() => addText(t)}>
                    {t}
                  </button>
                ))}
              </div>

              <button
                className="add-text-button"
                onClick={() => {
                  const id = addText("your text");
                  window.setTimeout(() => beginEdit(id), 80); // type straight onto the picture
                }}
              >
                ＋ CUSTOM TEXT
              </button>
            </>
          )}
        </aside>

        {/* ================= CENTER: the picture ================= */}
        {/* tapping empty space (around OR on the picture) deselects */}
        <section
          className="deco-preview-area"
          onPointerDown={() => {
            endEdit();
            setSelectedId(null);
          }}
        >
          <div className="deco-stage" ref={stageRef}>
            <img
              src={image}
              className="final-photo"
              alt="Your photobooth strip"
              draggable={false}
            />

            {/* stickers are clipped to the picture, exactly like the saved PNG */}
            <div
              className="deco-layer"
              onScroll={(e) => {
                // never allow the sticker layer to drift (see deco.css)
                e.currentTarget.scrollLeft = 0;
                e.currentTarget.scrollTop = 0;
              }}
            >
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`deco-item ${item.id === selectedId ? "active" : ""} ${
                    popId === item.id ? "pop" : ""
                  } ${item.id === editingId ? "editing" : ""}`}
                  style={boxStyle(item)}
                  onPointerDown={(e) => startDrag(e, item, "move")}
                >
                  {(() => {
                    const art = artFor(item);
                    return (
                      <img
                        src={art.src}
                        alt=""
                        draggable={false}
                        style={art.pixel ? { imageRendering: "pixelated" } : undefined}
                      />
                    );
                  })()}
                </div>
              ))}
            </div>

            {/* selection outline + handles live OUTSIDE the clip, so a sticker
                near the edge can always be grabbed, resized or deleted */}
            {selected && (
              <div
                className="deco-chrome"
                style={boxStyle(selected)}
                onPointerDown={(e) => {
                  if (editingId === selected.id) e.stopPropagation(); // the edit box needs the click
                  else startDrag(e, selected, "move");
                }}
              >
                {editingId === selected.id ? (
                  <input
                    className="deco-inline-input"
                    autoFocus
                    value={selected.text ?? ""}
                    maxLength={24}
                    spellCheck={false}
                    aria-label="Edit text"
                    style={{
                      fontFamily: fontCss(FONTS.find((f) => f.id === selected.font) ?? FONTS[0]),
                      fontWeight: FONTS.find((f) => f.id === selected.font)?.weight,
                      textTransform: FONTS.find((f) => f.id === selected.font)?.lowercaseOnly
                        ? "lowercase"
                        : "none",
                      color: selected.colour ?? DEFAULT_COLOUR,
                      // letters as big as the picture of them
                      fontSize: `${
                        (artFor(selected).em ?? 0.8) *
                        (stageRef.current?.clientWidth ?? 300) *
                        selected.w *
                        artFor(selected).aspect
                      }px`,
                    }}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => onEditChange(e.target.value)}
                    onBlur={() => endEdit()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") endEdit();
                      else if (e.key === "Escape") {
                        e.stopPropagation();
                        endEdit(true);
                      }
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <button
                      className="deco-handle handle-delete"
                      aria-label="Delete"
                      title="Delete"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={deleteSelected}
                    >
                      ✕
                    </button>
                    <button
                      className="deco-handle handle-copy"
                      aria-label="Copy"
                      title="Copy"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={duplicateSelected}
                    >
                      ⧉
                    </button>
                    <div
                      className="deco-handle handle-transform"
                      aria-label="Drag to resize and rotate"
                      onPointerDown={(e) => startDrag(e, selected, "transform")}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </section>

      </main>

      <footer className="deco-footer">
        <button className="deco-back-button" onClick={onBack}>
          ◀ BACK
        </button>

        <div className="deco-history">
          <button onClick={undo} disabled={!canUndo}>
            ↶ UNDO
          </button>
          <button onClick={redo} disabled={!canRedo}>
            ↷ REDO
          </button>
          <button onClick={clearAll} disabled={items.length === 0}>
            ↻ CLEAR
          </button>
        </div>

        <button className="deco-save-button" onClick={save} disabled={saving}>
          {saving ? "SAVING..." : "SAVE PNG ▶"}
        </button>
      </footer>

      {toast && <div className="deco-toast">{toast}</div>}
    </div>
  );
}

export default Deco;
