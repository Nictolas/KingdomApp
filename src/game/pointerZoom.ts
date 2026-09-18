export type Point2D = { x: number; y: number };

/**
 * Calcola lo scroll necessario affinché `worldUnderPointer` resti esattamente
 * sotto il puntatore dopo un cambio di zoom centrato nella viewport.
 */
export function scrollKeepingPointerAnchor(
  worldUnderPointer: Point2D,
  pointerInCamera: Point2D,
  viewport: { width: number; height: number },
  nextZoom: number
): Point2D {
  const halfWidth = viewport.width / 2;
  const halfHeight = viewport.height / 2;
  return {
    x: worldUnderPointer.x - halfWidth - (pointerInCamera.x - halfWidth) / nextZoom,
    y: worldUnderPointer.y - halfHeight - (pointerInCamera.y - halfHeight) / nextZoom
  };
}
