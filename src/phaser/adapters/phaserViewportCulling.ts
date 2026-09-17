export type PhaserWorldView = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * True se un punto mondo è dentro (o poco oltre) il viewport della camera.
 * Il padding evita pop-in di sprite/label ai bordi durante pan, zoom e tween.
 */
export function isPointNearPhaserWorldView(
  x: number,
  y: number,
  worldView: PhaserWorldView,
  padding = 0
): boolean {
  const safePadding = Math.max(0, padding);
  return (
    x >= worldView.x - safePadding &&
    x <= worldView.x + worldView.width + safePadding &&
    y >= worldView.y - safePadding &&
    y <= worldView.y + worldView.height + safePadding
  );
}
