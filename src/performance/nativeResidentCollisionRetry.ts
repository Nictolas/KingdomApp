/**
 * Native-only collision retry policy for a resident's commute.
 * Preserves the existing retry count and 900 ms deadline; the caller owns
 * occupancy, timers, pause state, callbacks and gameplay decisions.
 *
 * Once a repath has been requested, a stale callback must not ask again or
 * restart the old route. If the parent cannot provide an alternative, a
 * single delayed fallback resumes ordinary collision retries (without
 * requesting another expensive repath). reset() is called on a new route
 * or successful claim.
 */
export type NativeResidentCollisionDecision = "retry" | "request-repath" | "awaiting-repath";

export class NativeResidentCollisionRetry {
  private failures = 0;
  private awaitingRepath = false;
  private fallbackRetry = false;
  /** Changes whenever an awaited reroute is superseded by a new route. */
  private generation = 0;

  constructor(private readonly maxFailures: number) {
    if (!Number.isSafeInteger(maxFailures) || maxFailures < 1) {
      throw new Error("Invalid native collision retry threshold");
    }
  }

  fail(canRepath: boolean): NativeResidentCollisionDecision {
    if (this.awaitingRepath) return "awaiting-repath";
    // If the parent cannot supply a replacement route, continue timed retries
    // without repeatedly invoking potentially expensive pathfinding.
    if (this.fallbackRetry) return "retry";
    this.failures++;
    if (canRepath && this.failures >= this.maxFailures) {
      this.failures = 0;
      this.awaitingRepath = true;
      this.generation++;
      return "request-repath";
    }
    return "retry";
  }

  /** Capture immediately after request-repath, before notifying the parent. */
  repathGeneration(): number {
    return this.generation;
  }

  /**
   * A delayed fallback may resume only when its captured generation matches
   * the current pending request. An older route cannot revive a newer one;
   * once resumed, retries continue without a second expensive repath.
   */
  resumeWithoutRepath(expectedGeneration: number): boolean {
    if (!this.awaitingRepath || expectedGeneration !== this.generation) return false;
    this.awaitingRepath = false;
    this.fallbackRetry = true;
    return true;
  }

  reset(): void {
    this.generation++;
    this.failures = 0;
    this.awaitingRepath = false;
    this.fallbackRetry = false;
  }

  /** In-memory diagnostic only; never includes resident identifiers. */
  snapshot(): Readonly<{ failures: number; awaitingRepath: boolean }> {
    return { failures: this.failures, awaitingRepath: this.awaitingRepath };
  }
}
