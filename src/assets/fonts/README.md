# Fonts used by the text stickers

The Decorate page draws text as **plain letters in one solid colour** (no outline, no shadow, no gloss),
in one of these four fonts:

| font | file | what it has | licence |
|---|---|---|---|
| TikTok Sans (Bold) | `TikTokSans-Bold.ttf` | everything | SIL Open Font License, free for commercial use (`TikTokSans-OFL.txt`) |
| Gondens (DEMO) | `Gondens-DEMO.otf` | letters only, no digits or punctuation | **personal use only** (`Gondens-DEMO-LICENSE.txt`, `Gondens-DEMO-README.txt`) |
| Ammonite | `Ammonite.otf` | lowercase letters only | free personal and commercial use (`Ammonite-README.txt`) |
| Experimental BM | `ExperimentalBM-Regular.ttf` | letters, digits, `. , ! : ;` (no `? @ # & -`) | free personal and commercial use (`ExperimentalBM-README.txt`) |

Letters a font does not have are drawn in TikTok Sans in the same colour. Ammonite has no capitals,
so text typed in it is shown in lowercase.

## Important: Gondens is the DEMO of a paid font

The demo is free for **personal use only**. A website that is public or earns money needs the commercial
license (link in `Gondens-DEMO-README.txt`) or should not use it. To drop it, delete its entry from `FONTS` in
`src/utils/decoAssets.ts` and delete the files that start with `Gondens`. The other three fonts need nothing.

## Text colours

`#00FFEF`, `#FF1694`, `#272727`, `#F5F5F5`, `#C3CF3F` (the list `TEXT_COLOURS` in `src/utils/decoAssets.ts`).

## Add another font

1. Put the font file (and its licence text) in this folder.
2. In `src/utils/decoAssets.ts`: add an `import` for it, and one entry in `FONTS`
   (`id`, `label`, `family`, `url`, `weight`; set `lowercaseOnly: true` if it has no capitals, and a `note` if it has gaps).
3. Add the new `id` to the `FontId` type. Refresh the page: it appears in the font list by itself.
