/**
 * One cancelable timer slot per native resident.
 *
 * The existing shared NativeResidentTimerQueue batches OS timeouts and pauses
 * deadlines. This class handles a different concern: a timer callback that
 * was already handed to the OS can still arrive AFTER it was canceled. A
 * stale callback must neither clear a newer timer nor wake an obsolete
 * route. It also prevents an old wake/retry from surviving a replacement.
 *
 * No React, game state, persistence, resident IDs or extra OS timers.
 */
export class NativeResidentOwnedTimer {
  private timerId: number | null = null;
  private generation = 0;

  constructor(
    private readonly scheduleTimeout: (callback: () => void, delayMs: number) => number,
    private readonly cancelTimeout: (id: number) => void
  ) {}

  get pending(): boolean {
    return this.timerId !== null;
  }

  /** Invalidate the old callback before invoking a possibly reentrant cancel. */
  cancel(): void {
    this.generation++;
    const oldId = this.timerId;
    this.timerId = null;
    if (oldId !== null) this.cancelTimeout(oldId);
  }

  /** Replaces the prior wake-up and runs only while this slot still owns it. */
  schedule(callback: () => void, delayMs: number): void {
    if (!Number.isFinite(delayMs) || delayMs < 0) {
      throw new Error("Invalid native resident timer delay");
    }
    this.cancel();
    const token = this.generation;
    // A scheduler normally calls asynchronously, but also guard unexpected
    // synchronous delivery/reentrant cancellation. No stale timer is adopted.
    const id = this.scheduleTimeout(() => {
      if (token !== this.generation) return;
      this.timerId = null;
      this.generation++; // mark consumed BEFORE executing user code
      callback();
    }, delayMs);
    if (token === this.generation) this.timerId = id;
    else this.cancelTimeout(id);
  }
}
