/**
 * Native-only collision retry policy for a resident's commute.
 * Preserves the existing retry count and 900 ms deadline; the caller owns
 * occupancy, timers, pause state, callbacks and gameplay decisions.
 *
 * Once a repath has been requested, a stale callback must not ask again or
 * restart the old route. reset() is called on a new route or successful claim.
 */
export type NativeResidentCollisionDecision = "retry" | "request-repath" | "awaiting-repath";

export class NativeResidentCollisionRetry {
  private failures = 0;
  private awaitingRepath = false;

  constructor(private readonly maxFailures: number) {
    if (!Number.isSafeInteger(maxFailures) || maxFailures < 1) {
      throw new Error("Invalid native collision retry threshold");
    }
  }

  fail(canRepath: boolean): NativeResidentCollisionDecision {
    if (this.awaitingRepath) return "awaiting-repath";
    this.failures++;
    if (canRepath && this.failures >= this.maxFailures) {
      this.failures = 0;
      this.awaitingRepath = true;
      return "request-repath";
    }
    return "retry";
  }

  reset(): void {
    this.failures = 0;
    this.awaitingRepath = false;
  }

  /** In-memory diagnostic only; never includes resident identifiers. */
  snapshot(): Readonly<{ failures: number; awaitingRepath: boolean }> {
    return { failures: this.failures, awaitingRepath: this.awaitingRepath };
  }
}
