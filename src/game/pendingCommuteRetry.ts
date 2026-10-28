/**
 * The next collision retry must survive the game being paused, but must be
 * consumed at most once and discarded when its commute path is replaced.
 *
 * Holds only a callback in memory. No background timers or persisted state.
 */
export class PendingCommuteRetry {
  private resume: (() => void) | null = null;

  hold(callback: () => void): void {
    this.resume = callback;
  }

  take(): (() => void) | null {
    const callback = this.resume;
    this.resume = null;
    return callback;
  }

  clear(): void {
    this.resume = null;
  }
}
