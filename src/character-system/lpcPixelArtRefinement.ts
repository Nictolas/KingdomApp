/**
 * LPC HD experimental art pass. Keeps the exact outline and 64x64 frame layout
 * but paints subpixel highlights into a 128x128-per-frame texture.
 * Each 2x2 block has the original opaque color underneath: no CORS/image changes
 * can silently shift animation frames or layer positions.
 */
export type LpcArtLayer = "body" | "raceFeatures";

const FRAME_PX = 64;
const DETAIL_SCALE = 2;

export function refineLpcPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  layer: LpcArtLayer
): { pixels: Uint8ClampedArray; width: number; height: number } {
  if (width < FRAME_PX || height !== FRAME_PX * 4 || width % FRAME_PX !== 0 ||
      pixels.length !== width * height * 4) {
    throw new Error("LPC artwork must contain 64px frames in four direction rows");
  }
  const doubledWidth = width * DETAIL_SCALE;
  const doubledHeight = height * DETAIL_SCALE;
  const result = new Uint8ClampedArray(doubledWidth * doubledHeight * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const a = pixels[index + 3];
      for (let yy = 0; yy < DETAIL_SCALE; yy++) {
        for (let xx = 0; xx < DETAIL_SCALE; xx++) {
          const at = ((y * 2 + yy) * doubledWidth + x * 2 + xx) * 4;
          result[at] = pixels[index];
          result[at + 1] = pixels[index + 1];
          result[at + 2] = pixels[index + 2];
          result[at + 3] = a;
        }
      }

      const fx = x % FRAME_PX, fy = y % FRAME_PX;
      const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2];
      if (a < 240 || Math.min(r, g, b) < 32 ||
          fx === 0 || fx === FRAME_PX - 1 || fy === 0 || fy === FRAME_PX - 1 ||
          (fx + fy) % (layer === "raceFeatures" ? 4 : 5) !== 0) continue;
      let isInterior = true;
      for (const neighbor of [index - 4, index + 4, index - width * 4, index + width * 4]) {
        if (pixels[neighbor + 3] < 240 ||
            Math.abs(pixels[neighbor] - r) > 35 ||
            Math.abs(pixels[neighbor + 1] - g) > 35 ||
            Math.abs(pixels[neighbor + 2] - b) > 35) {
          isInterior = false;
          break;
        }
      }
      if (!isInterior) continue;

      const strength = layer === "raceFeatures" ? 0.12 : 0.09;
      const highlight = ((y * 2) * doubledWidth + x * 2) * 4;
      const shadow = (((y * 2 + 1) * doubledWidth) + x * 2 + 1) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const value = pixels[index + channel];
        result[highlight + channel] = Math.min(255, Math.round(value + (255 - value) * strength));
        result[shadow + channel] = Math.max(0, Math.round(value * (1 - strength * 0.65)));
      }
    }
  }
  return { pixels: result, width: doubledWidth, height: doubledHeight };
}

export const LPC_HD_FRAME_PX = FRAME_PX * DETAIL_SCALE;
