# Sticker tools

`make_stickers.py` cuts stickers out of sticker-sheet pictures and puts them in the app.

```bash
pip install numpy scipy pillow
# put the sheet pictures in tools/sheets/  (the original six are already there)
python tools/stickers/make_stickers.py
```

It writes `src/assets/stickers/<category>/<name>.webp` and regenerates `src/utils/stickerManifest.ts`
(do not edit that file by hand). Refresh the page and the stickers are in the Decoration page.

## Add a new sheet

1. Put the picture in `tools/sheets/` (white or near-white background works best).
2. In `make_stickers.py` copy a `sheet_*` function that looks like your sheet and add it to `SHEETS`.
   The important settings, in the order they matter:
   - **grouping** (`group(obj, N)`): how close pieces must be to count as ONE sticker. Too small splits a sticker
     into pieces, too big glues neighbours together. Check the count is what you expect.
   - **threshold** (`thr`): how white counts as "background". Lower = cleaner edges but can eat into
     white stickers. Dark stickers are handled automatically.
   - **border**: width of the white sticker outline in px (0 = none).
   - **holes**: make enclosed background see-through (button holes, glasses lenses, frames).
3. Add a new category to `CATEGORIES` at the top if you need a new tab.

Pixel art is cut with hard edges (`"pixel"`) and shown with crisp scaling. Anything on the sheet with a
watermark or a name tag should be left out of the config.

Sheets that are low resolution (these ones are about 250 px per sticker) look slightly soft when stickers are made big.
