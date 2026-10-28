/**
 * Elapsed animation time excluding paused intervals.
 * Uses the RAF timestamp domain (same as performance.now()) and never advances
 * while game time is paused. The game clock/save state is not changed.
 */
export class PauseAwareMotionClock {
  private lastTimestamp: number;
  private elapsedMs = 0;

  constructor(startTimestamp: number) {
    if (!Number.isFinite(startTimestamp)) throw new Error("Invalid motion start timestamp");
    this.lastTimestamp = startTimestamp;
  }

  advance(timestamp: number, paused: boolean): number {
    if (!Number.isFinite(timestamp)) return this.elapsedMs;
    const delta = Math.max(0, timestamp - this.lastTimestamp);
    if (timestamp > this.lastTimestamp) this.lastTimestamp = timestamp;
    if (!paused) this.elapsedMs += delta;
    return this.elapsedMs;
  }
}
