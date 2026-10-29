import { MOTION_BACKGROUND_GAP_MS } from "../game/pauseAwareMotionClock";

/** A pure, side-effect-free sample for one in-progress native tile segment. */
export type NativeResidentSegmentSample = Readonly<{
  elapsedMs: number;
  progress: number;
  advance: boolean;
  complete: boolean;
}>;

/** Caller-owned scratch output for the native RAF hot path. */
export type NativeResidentSegmentSampleBuffer = {
  elapsedMs: number;
  progress: number;
  advance: boolean;
  complete: boolean;
};

/**
 * Native-only reusable segment clock. Matches PauseAwareMotionClock's exact
 * timestamp/scale semantics but owns its primitive state directly, allowing
 * a single instance per resident across thousands of successive tiles.
 *
 * The shared game clock and web renderer are NOT modified. Differential
 * tests compare this implementation against the canonical game clock.
 */
export class NativeResidentSegmentProgress {
  private lastTimestamp: number;
  private elapsedMs = 0;
  private durationMs: number;
  private lastProgress = 0;

  constructor(startTimestamp: number, durationMs: number) {
    if (!Number.isFinite(startTimestamp) || !Number.isFinite(durationMs) || durationMs <= 0) {
      throw new Error("Invalid native resident segment progress");
    }
    this.lastTimestamp = startTimestamp;
    this.durationMs = durationMs;
  }

  /**
   * Restart after route replacement or synchronous arrival chaining.
   * Validation precedes mutation so a malformed route cannot destroy the
   * previous valid clock. The runner separately invalidates stale RAF tokens.
   */
  reset(startTimestamp: number, durationMs: number): void {
    if (!Number.isFinite(startTimestamp) || !Number.isFinite(durationMs) || durationMs <= 0) {
      throw new Error("Invalid native resident segment progress");
    }
    this.lastTimestamp = startTimestamp;
    this.elapsedMs = 0;
    this.durationMs = durationMs;
    this.lastProgress = 0;
  }

  /** Independent snapshot for callers retaining previous samples. */
  sample(now: number, timeScale: number, resumedAfterSuspension = false): NativeResidentSegmentSample {
    const value: NativeResidentSegmentSampleBuffer = {
      elapsedMs: 0, progress: 0, advance: false, complete: false
    };
    this.sampleInto(now, timeScale, resumedAfterSuspension, value);
    return value;
  }

  /** No allocations on each resident RAF; caller owns the mutable buffer. */
  sampleInto(
    now: number,
    timeScale: number,
    resumedAfterSuspension: boolean,
    output: NativeResidentSegmentSampleBuffer
  ): void {
    // Same monotonic/regression/long-background-gap semantics as
    // PauseAwareMotionClock.advanceScaled; a resumed frame always rebases.
    if (Number.isFinite(now)) {
      const delta = Math.max(0, now - this.lastTimestamp);
      if (now > this.lastTimestamp) this.lastTimestamp = now;
      const effectiveScale = resumedAfterSuspension ? 0 : timeScale;
      if (delta < MOTION_BACKGROUND_GAP_MS &&
          Number.isFinite(effectiveScale) && effectiveScale > 0) {
        this.elapsedMs += delta * effectiveScale;
      }
    }
    const advance = !resumedAfterSuspension && Number.isFinite(timeScale) && timeScale > 0;
    if (advance) this.lastProgress = Math.min(1, this.elapsedMs / this.durationMs);
    output.elapsedMs = this.elapsedMs;
    output.progress = this.lastProgress;
    output.advance = advance;
    output.complete = advance && this.lastProgress >= 1;
  }
}
