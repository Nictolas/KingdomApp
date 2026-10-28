import { PauseAwareMotionClock } from "../game/pauseAwareMotionClock";

/** A pure, side-effect-free sample for one in-progress native tile segment. */
export type NativeResidentSegmentSample = Readonly<{
  elapsedMs: number;
  progress: number;
  advance: boolean;
  complete: boolean;
}>;

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

  sample(now: number, timeScale: number, resumedAfterSuspension = false): NativeResidentSegmentSample {
    // The first RAF after app/game resume must only rebase the timestamp. The
    // previous progress stays visible even for a short (<2s) background gap.
    const elapsedMs = this.clock.advanceScaled(
      now,
      resumedAfterSuspension ? 0 : timeScale
    );
    const advance = !resumedAfterSuspension && Number.isFinite(timeScale) && timeScale > 0;
    if (advance) {
      this.lastProgress = Math.min(1, elapsedMs / this.durationMs);
    }
    return {
      elapsedMs,
      progress: this.lastProgress,
      advance,
      complete: advance && this.lastProgress >= 1
    };
  }
}
