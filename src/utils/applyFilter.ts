import { filters } from "../filters/presets";
import type { FilterName } from "../filters/presets";


// Keep values between 0 and 255
function clamp(value: number): number {
  return Math.max(0, Math.min(255, value));
}


// =========================
// APPLY FILTER TO CANVAS
// =========================

export function applyFilter(
  canvas: HTMLCanvasElement,
  filterName: FilterName
) {
  const ctx = canvas.getContext("2d");

  if (!ctx) return;

  const settings = filters[filterName];

  const imageData = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const pixels = imageData.data;


  for (let i = 0; i < pixels.length; i += 4) {

    let r = pixels[i];
    let g = pixels[i + 1];
    let b = pixels[i + 2];


    // =========================
    // 1. EXPOSURE
    // =========================

    // Exposure works multiplicatively.
    // Positive = brighter
    // Negative = darker

    const exposureMultiplier =
      Math.pow(2, settings.exposure / 100);

    r *= exposureMultiplier;
    g *= exposureMultiplier;
    b *= exposureMultiplier;


    // =========================
    // 2. BRIGHTNESS
    // =========================

    r += settings.brightness;
    g += settings.brightness;
    b += settings.brightness;


    // =========================
    // 3. HIGHLIGHTS / SHADOWS
    // =========================

    // Calculate perceived brightness
    const luminance =
      0.299 * r +
      0.587 * g +
      0.114 * b;


    // Highlights
    if (luminance > 128) {

      const highlightAmount =
        (luminance - 128) / 127;

      const adjustment =
        settings.highlights *
        highlightAmount;

      r += adjustment;
      g += adjustment;
      b += adjustment;
    }


    // Shadows
    if (luminance < 128) {

      const shadowAmount =
        (128 - luminance) / 128;

      const adjustment =
        settings.shadows *
        shadowAmount;

      r += adjustment;
      g += adjustment;
      b += adjustment;
    }


    // =========================
    // 4. CONTRAST
    // =========================

    // Convert -100 → +100
    // into a useful multiplier

    const contrast =
      1 + settings.contrast / 100;

    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;


    // =========================
    // 5. VIBRANCE
    // =========================

    // Vibrance affects weaker colours
    // more than already-saturated colours.

    const maxChannel =
      Math.max(r, g, b);

    const minChannel =
      Math.min(r, g, b);

    const currentSaturation =
      maxChannel - minChannel;

    const vibranceStrength =
      settings.vibrance / 100;

    const vibranceAmount =
      (1 - currentSaturation / 255) *
      vibranceStrength;


    const gray =
      0.299 * r +
      0.587 * g +
      0.114 * b;


    r += (r - gray) * vibranceAmount;
    g += (g - gray) * vibranceAmount;
    b += (b - gray) * vibranceAmount;


    // =========================
    // 6. SATURATION
    // =========================

    const saturation =
      1 + settings.saturation / 100;

    r = gray + (r - gray) * saturation;
    g = gray + (g - gray) * saturation;
    b = gray + (b - gray) * saturation;


    // =========================
    // 7. TEMPERATURE
    // =========================

    // Positive = warmer
    // Negative = cooler

    const temperature =
      settings.temperature;

    r += temperature;
    b -= temperature;


    // =========================
    // 8. TINT
    // =========================

    // Positive = magenta
    // Negative = green

    const tint =
      settings.tint;

    r += tint;
    b += tint;
    g -= tint;


    // =========================
    // 9. FILM GRAIN
    // =========================

    if (settings.grain > 0) {

      const noise =
        (Math.random() - 0.5) *
        settings.grain;

      r += noise;
      g += noise;
      b += noise;
    }


    // =========================
    // 10. CLAMP
    // =========================

    pixels[i] = clamp(r);
    pixels[i + 1] = clamp(g);
    pixels[i + 2] = clamp(b);
  }


  ctx.putImageData(
    imageData,
    0,
    0
  );
}


// =========================
// FILTER IMAGE
// =========================

export function filterImage(
  imageUrl: string,
  filterName: FilterName
): Promise<string> {

  return new Promise(
    (resolve, reject) => {

      const image = new Image();


      image.onload = () => {

        // NORMAL = don't touch
        // the original image

        if (filterName === "normal") {
          resolve(imageUrl);
          return;
        }


        const canvas =
          document.createElement("canvas");


        canvas.width =
          image.naturalWidth;

        canvas.height =
          image.naturalHeight;


        const ctx =
          canvas.getContext("2d");


        if (!ctx) {
          reject(
            new Error(
              "Could not get canvas context"
            )
          );

          return;
        }


        // Draw original image
        ctx.drawImage(
          image,
          0,
          0,
          canvas.width,
          canvas.height
        );


        // Apply filter
        applyFilter(
          canvas,
          filterName
        );


        // Convert back to image
        const filteredImage =
          canvas.toDataURL(
            "image/jpeg",
            0.92
          );


        resolve(
          filteredImage
        );
      };


      image.onerror = () => {
        reject(
          new Error(
            "Could not load image"
          )
        );
      };


      image.src = imageUrl;
    }
  );
}