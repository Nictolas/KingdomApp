/** Dimensions in world pixels, shared by every LPC layer of a single character.
 * This does NOT change the grid/collision box and avoids independent stretching of
 * accessories, body, headwear and clothes when switching animation sheets.
 */
export const LPC_FRAME_WIDTH = 64;
export const LPC_VISUAL_WIDTH_FACTOR = 1.08;
export const LPC_ADULT_HEIGHT_FACTOR = 1.10;
export const LPC_CHILD_HEIGHT_FACTOR = 1.03;

export type LpcVisualGeometry = Readonly<{
  width: number;
  height: number;
  offsetY: number;
  pixelsToDisplayY: number;
}>;

export function getLpcVisualGeometry(cellSize: number, bodyType: string): LpcVisualGeometry {
  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    throw new Error("Invalid LPC cell size");
  }
  const width = cellSize * LPC_VISUAL_WIDTH_FACTOR;
  const height = width * (bodyType === "child" ? LPC_CHILD_HEIGHT_FACTOR : LPC_ADULT_HEIGHT_FACTOR);
  // Keep character feet visually anchored while making the body a little taller.
  const offsetY = -cellSize * 0.2 - (height - width) / 2;
  return { width, height, offsetY, pixelsToDisplayY: height / LPC_FRAME_WIDTH };
}
