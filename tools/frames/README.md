# How to add a frame

**The short version:** make a PNG of the right size with transparent photo windows, drop it in
`src/assets/4cuts/` (4-photo strip) or `src/assets/6cuts/` (6-photo strip). It appears in the
Editor's frame carousel by itself. Name = file name (`pink-hearts.png` becomes **PINK HEARTS**).
A file starting with `_` is hidden (good for unfinished frames).

## The numbers

The Editor places the photos at fixed positions, so your frame's windows must sit exactly on them.

| layout | strip size (CSS px) | best file size (3x) | photo windows |
|---|---|---|---|
| **4 photos** (1 column) | 280 x 650 | **840 x 1950** | 4 windows, each **756 x 406**, at x = 42; y = 96, 517, 938, 1358 |
| **6 photos** (2 x 3) | 420 x 598 | **1260 x 1794** | 6 windows, each **579 x 492**, at x = 42 or 639; y = 96, 606, 1116 |

- The same numbers at 1x (what the CSS uses): 4 photos: windows 252 x 135 at x = 14, y = 32 / 172 / 313 / 453.
  6 photos: windows 193 x 164 at x = 14 or 213, y = 32 / 202 / 372.
- **Why 3x:** the finished strip is saved at 3x, so a 3x frame stays sharp. Any size with the SAME
  proportions works (an 840 x 1950 frame is just a 280 x 650 frame at 3x), but a smaller one will look soft.
- **Wrong proportions = stretched frame.** Keep 280:650 (4 photos) and 420:598 (6 photos) exactly.

## Three ways to make one

### A) The generator (fastest, no design tool)

```bash
pip install numpy pillow
python tools/frames/make_frame.py --layout 6 --name pink-hearts --pattern hearts --bg "#ffc9e3" --fg "#ffffff" --border 3
python tools/frames/make_frame.py --layout 4 --name pink-hearts --pattern hearts --bg "#ffc9e3" --fg "#ffffff" --border 3
```

`--pattern` solid, dots, stripes, checker, grid, gingham, hearts, stars   `--size` pattern size (try 20 to 40)
`--border 3` adds a rim around every photo   `--border-color` its colour. Run with `-h` for everything.
Make the **4** and **6** version with the same name so the look matches in both layouts.

### B) Design it yourself (Figma, Canva, Photoshop, Procreate ...)

1. Create a canvas of the size in the table (e.g. 840 x 1950).
   Run `python tools/frames/make_frame.py --template` for guide pictures in `tools/frames/templates/`:
   the magenta boxes are the photo windows, labelled with their pixel positions.
2. Draw your frame **around** those boxes: background, patterns, stickers, tape, text ...
3. Make the boxes **fully transparent** (delete them / subtract / erase). Remove the guide layer.
4. Export as **PNG with transparency** at the full canvas size.
5. Save it into `src/assets/4cuts/` or `src/assets/6cuts/`. Done.

### C) Mix: generate a base, then decorate it
Generate a pattern frame (A), open it in your design tool, add stickers / bows / tape on top, export PNG.

## Rules that avoid problems

- Window pixels must be **100% transparent** (not "mostly"): otherwise a faint haze shows over the photo.
- Do not move or resize the windows: the photos will not line up.
- Art may overlap the windows on purpose (the BUTTON frame has buttons sitting over photo corners).
  Keep faces safe: stickers belong in corners and edges, not in the middle of a window.
- Keep each file under about 500 KB (patterns compress very well, photos of textures do not).
- Name with letters, numbers, `-` or `_`. Frames are listed alphabetically.

## Check your frame

Open the Editor, pick the layout, and flip through the frames with the arrows.
If a photo has a thin white line on one side, the frame is slightly off in size or the window is not transparent enough.

## If a frame does not show up

- Is it in the right folder (`4cuts` or `6cuts`) and ending in `.png`?
- Does the name start with `_`? That hides it.
- Refresh the page (the dev server normally reloads by itself when you add a file).

## Y2K design ideas

Gingham, hearts, stars, checker, polka dots, pink + turquoise + silver, white photo rims,
chrome bows, glitter, film-strip edges, notebook paper with tape.
