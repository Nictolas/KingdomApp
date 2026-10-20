/**
 * Render pixel art a risoluzione Retina senza moltiplicare illimitatamente
 * il carico WebGL. La risoluzione riguarda il canvas, non la mappa logica.
 */
export const MAX_PIXEL_ART_RENDER_RESOLUTION = 3;
export const MAX_PIXEL_ART_RENDER_PIXELS = 5_000_000;

export function pixelArtCanvasResolution(
  devicePixelRatio: number,
  viewportWidth: number,
  viewportHeight: number
): number {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? Math.max(1, Math.min(MAX_PIXEL_ART_RENDER_RESOLUTION, Math.round(devicePixelRatio)))
    : 1;

  if (!Number.isFinite(viewportWidth) || !Number.isFinite(viewportHeight) || viewportWidth <= 0 || viewportHeight <= 0) {
    return ratio;
  }

  const maximumForViewport = Math.floor(
    Math.sqrt(MAX_PIXEL_ART_RENDER_PIXELS / (viewportWidth * viewportHeight))
  );

  return Math.max(1, Math.min(ratio, maximumForViewport));
}
