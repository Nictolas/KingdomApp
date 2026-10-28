/**
 * Elapsed movement time in simulation milliseconds, excluding pauses and
 * respecting the clock's live 1x/2x/4x rate.
 *
 * Uses the RAF/performance.now() timestamp domain; never reads/writes a save.
 * A rate change affects the next sampled RAF interval without teleporting.
 */
export class PauseAwareMotionClock {
  private lastTimestamp: number;
  private elapsedMs = 0;

  constructor(startTimestamp: number) {
    if (!Number.isFinite(startTimestamp)) throw new Error("Invalid motion start timestamp");
    this.lastTimestamp = startTimestamp;
  }

  /** Compatibility for existing callers at 1x, including paused intervals. */
  advance(timestamp: number, paused: boolean): number {
    return this.advanceScaled(timestamp, paused ? 0 : 1);
  }

  /** timeScale=0 for pause; valid game speeds are 1, 2 and 4. */
  advanceScaled(timestamp: number, timeScale: number): number {
    if (!Number.isFinite(timestamp)) return this.elapsedMs;
    const delta = Math.max(0, timestamp - this.lastTimestamp);
    if (timestamp > this.lastTimestamp) this.lastTimestamp = timestamp;
    if (Number.isFinite(timeScale) && timeScale > 0) {
      this.elapsedMs += delta * timeScale;
    }
    return this.elapsedMs;
  }
}
