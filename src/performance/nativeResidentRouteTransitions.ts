/**
 * Native-only arbitration for route changes. Commute has priority over the
 * night/home anchor; the latter must never cancel an active commute effect.
 * No game-state writes, storage, clocks, React or platform APIs.
 */
export type NativeResidentRouteMode = "commute" | "fixed" | "free";

export function nativeResidentRouteMode(
  commutePath: readonly number[] | null | undefined,
  fixedCell: number | null | undefined
): NativeResidentRouteMode {
  if (commutePath != null && commutePath.length >= 2) return "commute";
  return fixedCell != null ? "fixed" : "free";
}

/**
 * A remembered home exit is consumed exactly once. A commute invalidates the
 * remembered exit: otherwise clearing its path later teleports the resident
 * back home even after a successful commute.
 */
export function nativeResidentHomeTransition(
  previousHome: number | null | undefined,
  mode: NativeResidentRouteMode,
  fixedCell: number | null | undefined
): Readonly<{ nextHome: number | null; wakeCell: number | null }> {
  if (mode === "commute") return { nextHome: null, wakeCell: null };
  if (mode === "fixed") return { nextHome: fixedCell ?? null, wakeCell: null };
  return { nextHome: null, wakeCell: previousHome ?? null };
}

/** React's commute cleanup cancels its idle timeout. Re-arm it after a
 * completed route is removed, or when free roaming is enabled again. The
 * caller additionally checks the active clock, movement and pending timer.
 */
export function nativeResidentShouldRearmIdle(
  previousMode: NativeResidentRouteMode,
  nextMode: NativeResidentRouteMode,
  previouslyDisabled: boolean,
  disabled: boolean
): boolean {
  return nextMode === "free" && !disabled &&
    (previousMode === "commute" || previouslyDisabled);
}
