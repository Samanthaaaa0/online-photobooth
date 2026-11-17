// frames.ts
// The frame carousel in the Editor shows every PNG found in
//
//     src/assets/4cuts/*.png     (frames for the 4-cut strip)
//     src/assets/6cuts/*.png     (frames for the 6-cut strip)
//
// So adding a frame = drop a PNG in the right folder (see tools/frames/README.md for
// the exact size and where the photo windows must be). No code to edit.
//
//   * the name shown in the Editor comes from the file name:  "pink-hearts.png" -> PINK HEARTS
//   * frames are listed alphabetically
//   * a file whose name starts with "_" is hidden (handy for work-in-progress)

export interface Frame {
  id: string;
  name: string;
  image: string;
}

// nicer names for frames whose file name is one word
const NAME_OVERRIDES: Record<string, string> = {
  polkadots: "POLKA DOTS",
};

function build(modules: Record<string, string>): Frame[] {
  const frames = Object.entries(modules)
    .map(([path, image]) => {
      const file = path.split("/").pop() ?? path;
      const id = file.replace(/\.png$/i, "");
      return { id, image, name: NAME_OVERRIDES[id] ?? id.replace(/[-_]+/g, " ").toUpperCase() };
    })
    .filter((f) => !f.id.startsWith("_"))
    .sort((a, b) => a.id.localeCompare(b.id));

  // never leave the carousel empty (it would crash): a transparent 1x1 stands in
  return frames.length > 0
    ? frames
    : [
        {
          id: "none",
          name: "NONE",
          image:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        },
      ];
}

export const frames4: Frame[] = build(
  import.meta.glob("../assets/4cuts/*.png", {
    eager: true,
    query: "?url",
    import: "default",
  }) as Record<string, string>
);

export const frames6: Frame[] = build(
  import.meta.glob("../assets/6cuts/*.png", {
    eager: true,
    query: "?url",
    import: "default",
  }) as Record<string, string>
);
