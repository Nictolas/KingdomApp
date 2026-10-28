import { PauseAwareMotionClock } from "../game/pauseAwareMotionClock";

/** A pure, side-effect-free sample for one in-progress native tile segment. */
export type NativeResidentSegmentSample = Readonly<{
  elapsedMs: number;
  progress: number;
  advance: boolean;
  complete: boolean;
}>;

/**
 * Caller-owned scratch output for the native RAF hot path.
 * The public sample() method still returns an independent immutable value.
 */
export type NativeResidentSegmentSampleBuffer = {
  elapsedMs: number;
  progress: number;
  advance: boolean;
  complete: boolean;
};

/**
 * One segment owns its clock. Both wandering and commute paths use exactly the
 * same pause/background/speed rules, while the caller retains ownership of
 * sprite updates, occupancy callbacks and individual RAF cancellation.
 *
 * No React, native modules, persistence, timers or global gameplay mutations.
 */
export class NativeResidentSegmentProgress {
  private readonly clock: PauseAwareMotionClock;
  private readonly durationMs: number;
  private lastProgress = 0;

  constructor(startTimestamp: number, durationMs: number) {
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      throw new Error("Invalid resident segment duration");
    }
    this.clock = new PauseAwareMotionClock(startTimestamp);
    this.durationMs = durationMs;
  }

  /**
   * Original value-returning API: callers may safely retain these snapshots.
   * The native RAF runner uses sampleInto() instead to reuse one scratch value
   * for thousands of frames without altering snapshot ownership elsewhere.
   */
  sample(now: number, timeScale: number, resumedAfterSuspension = false): NativeResidentSegmentSample {
    const value: NativeResidentSegmentSampleBuffer = {
      elapsedMs: 0, progress: 0, advance: false, complete: false
    };
    this.sampleInto(now, timeScale, resumedAfterSuspension, value);
    return value;
  }

  /**
   * Allocation-free form for a caller that owns 'output'. Its contents are
   * overwritten at each call, including the pause/rebase path. Do not retain
   * the output as an immutable history entry.
   */
  sampleInto(
    now: number,
    timeScale: number,
    resumedAfterSuspension: boolean,
    output: NativeResidentSegmentSampleBuffer
  ): void {
    // First RAF after app/game resume only rebases; never catches up background
    // time or advances a sprite even for a short (<2s) suspension.
    const elapsedMs = this.clock.advanceScaled(
      now,
      resumedAfterSuspension ? 0 : timeScale
    );
    const advance = !resumedAfterSuspension && Number.isFinite(timeScale) && timeScale > 0;
    if (advance) this.lastProgress = Math.min(1, elapsedMs / this.durationMs);
    output.elapsedMs = elapsedMs;
    output.progress = this.lastProgress;
    output.advance = advance;
    output.complete = advance && this.lastProgress >= 1;
  }
}
