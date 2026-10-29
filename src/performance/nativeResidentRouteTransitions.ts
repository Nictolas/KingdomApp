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

/**
 * Fail-safe terminal cleanup for native residents. Execute ALL actions even
 * if a canceled native RAF, timeout, or callback throws. First fault wins,
 * including falsy throw values. Used only on route/lifecycle transitions,
 * never in the hot animation or timer dispatch path.
 */
export function nativeResidentRunCleanup(...steps: ReadonlyArray<() => void>): void {
  let hasError = false;
  let firstError: unknown = undefined;
  for (const step of steps) {
    try { step(); }
    catch (error) {
      if (!hasError) { hasError = true; firstError = error; }
    }
  }
  if (hasError) throw firstError;
}

/**
 * Recovery ONLY if starting a native segment fails after the caller has
 * reserved its destination. The settled origin is reclaimed if available;
 * if another resident took it, release the obsolete destination instead.
 *
 * Never hide the ORIGINAL platform/sprite error, even if the rollback itself
 * throws a second (possibly falsy) error. Reentrant route replacement must
 * not be disturbed by an obsolete start; the caller owns that epoch check.
 *
 * This path executes on failures only; it adds no work to the RAF hot path,
 * gameplay logic, persistence, or the web renderer.
 */
export function nativeResidentRethrowAfterClaimedStartFault(
  originalError: unknown,
  settledCell: number | null | undefined,
  claim: ((cell: number) => boolean) | null | undefined,
  release: (() => void) | null | undefined,
  stillOwnsRoute: boolean
): never {
  if (stillOwnsRoute) {
    try {
      nativeResidentReconcileInterruptedClaim(settledCell, claim, release);
    } catch {
      // The platform start error remains the diagnostic root cause.
    }
  }
  throw originalError;
}

/**
 * Error-only reconciliation for a destination reserved during a segment
 * whose native arrival callback fails BEFORE publishing its settled cell.
 *
 * A successfully published destination must NEVER be undone just because a
 * later parent callback throws. The caller owns that distinction and (for
 * commutes) also checks its current route epoch. Preserve the original
 * exception, even if occupancy recovery itself fails.
 */
export function nativeResidentRethrowAfterUnsettledArrivalFault(
  originalError: unknown,
  previousCell: number | null | undefined,
  claim: ((cell: number) => boolean) | null | undefined,
  release: (() => void) | null | undefined,
  unsettledAndOwned: boolean
): never {
  return nativeResidentRethrowAfterClaimedStartFault(
    originalError, previousCell, claim, release, unsettledAndOwned
  );
}
