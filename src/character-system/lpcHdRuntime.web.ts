import { LPC_HD_FRAME_PX, refineLpcPixels, type LpcArtLayer } from "./lpcPixelArtRefinement";

/**
 * Optional browser-side art pass on existing generated PNGs.
 * No source sprite pack / build step required; failures use original 64px sheet.
 */
export async function refineLpcSpriteUrl(url: string, layer: LpcArtLayer): Promise<string> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Unable to load LPC sheet for refinement"));
    image.src = url;
  });

  const source = document.createElement("canvas");
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("LPC source canvas unavailable");
  sourceContext.imageSmoothingEnabled = false;
  sourceContext.drawImage(image, 0, 0);

  const original = sourceContext.getImageData(0, 0, source.width, source.height);
  const enhanced = refineLpcPixels(original.data, source.width, source.height, layer);
  const dest = document.createElement("canvas");
  dest.width = enhanced.width;
  dest.height = enhanced.height;
  const destContext = dest.getContext("2d");
  if (!destContext) throw new Error("LPC output canvas unavailable");
  destContext.putImageData(new ImageData(enhanced.pixels, enhanced.width, enhanced.height), 0, 0);

  const result = dest.toDataURL("image/png");
  if (!result.startsWith("data:image/png;base64,")) {
    throw new Error("LPC enhanced sprite not encoded");
  }
  return result;
}

export { LPC_HD_FRAME_PX };
