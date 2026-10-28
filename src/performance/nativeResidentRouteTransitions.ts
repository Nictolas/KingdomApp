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

/**
 * Native-only occupancy repair for a segment interrupted after its destination
 * was reserved but before the arrival callback updated the logical cell.
 * The real map's tryClaimCell atomically moves the resident's reservation.
 * If the origin was claimed by another resident in the meantime, never
 * evict that owner: release our stale destination instead.
 *
 * No new path, collision policy, game state, or persistence is introduced.
 */
export type NativeResidentClaimHandoff = "reclaimed" | "released" | "unmanaged";

export function nativeResidentReconcileInterruptedClaim(
  settledCell: number | null | undefined,
  claim: ((cell: number) => boolean) | null | undefined,
  release: (() => void) | null | undefined
): NativeResidentClaimHandoff {
  if (settledCell != null && claim?.(settledCell)) return "reclaimed";
  if (release) {
    release();
    return "released";
  }
  return "unmanaged";
}

/**
 * When the parent supplies a replacement path starting somewhere else, the
 * old reservation must not survive a snap to the new start. Do not force an
 * exclusive claim at the new origin: houses and entrances can be shared.
 */
export function nativeResidentReleaseMismatchedRouteOrigin(
  previousCell: number | null | undefined,
  nextStart: number,
  release: (() => void) | null | undefined
): boolean {
  if (previousCell == null || previousCell === nextStart || !release) return false;
  release();
  return true;
}

/**
 * A completed last step into a shared home must never keep an exclusive
 * street or doorway reservation. The soft-home entry may have failed to
 * claim the shared destination; in that case the old road cell is still
 * reserved until this arrival callback. Release BEFORE notifying the parent
 * that the resident settled, so synchronous route updates cannot observe a
 * ghost road occupant. Non-home arrivals keep their ordinary claim.
 */
export function nativeResidentReleaseSharedHomeArrival(
  isLastSegment: boolean,
  purpose: string | null | undefined,
  release: (() => void) | null | undefined
): boolean {
  if (!isLastSegment || purpose !== "home" || !release) return false;
  release();
  return true;
}
