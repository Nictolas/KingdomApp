/** Coordinate conventions used by React Native's actual viewport. */
export type NativeMapTransform = { positionX: number; positionY: number; scale: number };
export type NativeViewportSize = { width: number; height: number };
export type NativeMapPoint = { x: number; y: number };

export function clampNativeMapScale(scale: number, min: number, max: number): number {
  if (!Number.isFinite(scale)) return min;
  return Math.max(min, Math.min(max, scale));
}

/** Place content in the viewport center before the user starts interacting. */
export function centerNativeMap(
  viewport: NativeViewportSize,
  content: NativeViewportSize,
  scale = 1
): NativeMapTransform {
  return {
    positionX: (viewport.width - content.width * scale) / 2,
    positionY: (viewport.height - content.height * scale) / 2,
    scale
  };
}

/** Keep the same world coordinate under the fingers during pinch/zoom. */
export function pinchNativeMap(
  before: NativeMapTransform,
  initialFocal: NativeMapPoint,
  currentFocal: NativeMapPoint,
  requestedScale: number,
  minScale: number,
  maxScale: number
): NativeMapTransform {
  const scale = clampNativeMapScale(requestedScale, minScale, maxScale);
  const factor = scale / before.scale;
  return {
    positionX: currentFocal.x - (initialFocal.x - before.positionX) * factor,
    positionY: currentFocal.y - (initialFocal.y - before.positionY) * factor,
    scale
  };
}

/**
 * RN scales about the view center, whereas camera/culling coordinates
 * describe the world top-left. Compensate without relying on transformOrigin.
 */
export function nativeMapAnimatedTranslation(
  state: NativeMapTransform,
  content: NativeViewportSize
): NativeMapPoint {
  return {
    x: state.positionX + (state.scale - 1) * content.width / 2,
    y: state.positionY + (state.scale - 1) * content.height / 2
  };
}
