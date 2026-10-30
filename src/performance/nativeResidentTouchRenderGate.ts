/**
 * Native-only React commit gate for a resident's touch target.
 *
 * Animated.ValueXY already moves the sprite and hit target. A React render
 * is needed only on first mount or when a cell transition changes whether
 * the resident intercepts taps vs. passes them through to the map.
 * Callback changes still render normally through React.memo props.
 *
 * This helper is pure; it does not change claims, routes, time or saves.
 */
export function nativeResidentNeedsTouchRender(
  previousCell: number | null,
  nextCell: number,
  passTouchesToMapOnCell?: ((cell: number) => boolean) | null
): boolean {
  if (previousCell === null) return true;
  if (previousCell === nextCell || passTouchesToMapOnCell == null) return false;
  return passTouchesToMapOnCell(previousCell) === true !==
    (passTouchesToMapOnCell(nextCell) === true);
}
