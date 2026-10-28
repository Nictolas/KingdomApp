import { NativeResidentSegmentProgress, type NativeResidentSegmentSampleBuffer } from "./nativeResidentSegmentProgress";

export type NativeResidentPoint = Readonly<{ x: number; y: number }>;
export type NativeResidentSegmentRequest = Readonly<{
  from: NativeResidentPoint;
  to: NativeResidentPoint;
  durationMs: number;
  startTimestamp: number;
  /** Commute segments keep walking continuously; final segments stop. */
  keepWalkingOnArrival?: boolean;
  onArrival: () => void;
}>;

type FrameCallback = (timestamp: number, resumedAfterSuspension: boolean) => void;
type ResidentPositionWriter =
  | { writePosition: (point: NativeResidentPoint) => void; writePositionXY?: never }
  | { writePosition?: never; writePositionXY: (x: number, y: number) => void };

export type NativeResidentSegmentDependencies = Readonly<{
  requestFrame: (callback: FrameCallback) => number;
  /** Native frame bus: one subscription per segment instead of one per frame. */
  subscribeFrame?: (callback: FrameCallback) => number;
  cancelFrame: (id: number) => void;
  readTimeScale: () => number;
  /** Coordinate callback is native-only and avoids a point allocation per frame. */
  advanceSprite: (elapsedMs: number) => void;
  setWalking: (moving: boolean) => void;
  onFrame?: () => void;
} & ResidentPositionWriter>;

/**
 * Native-only segment executor shared by wandering and commute paths.
 *
 * Owns only RAF registration, pause-aware progress and Animated.Value writes.
 * It does NOT claim/release map cells, choose paths, mutate GameContext,
 * change gameplay rules or persist state. The caller still controls arrival
 * notifications and route transitions.
 *
 * A generation token makes cancellation safe even if an already-canceled
 * native callback is delivered late. The frame bus remains the only RAF
 * scheduler for all residents.
 */
export class NativeResidentSegmentRunner {
  private generation = 0;
  private frameId: number | null = null;
  private lastWrittenX: number | null = null;
  private lastWrittenY: number | null = null;
  /** One sample buffer per resident runner, not a new object every RAF. */
  private readonly frameSample: NativeResidentSegmentSampleBuffer = {
    elapsedMs: 0, progress: 0, advance: false, complete: false
  };
  private active = false;
  private completed = 0;
  private positionWrites = 0;
  private ignoredStaleFrames = 0;

  constructor(private readonly deps: NativeResidentSegmentDependencies) {}

  cancel(): void {
    this.generation++;
    this.active = false;
    this.lastWrittenX = null;
    this.lastWrittenY = null;
    if (this.frameId !== null) {
      this.deps.cancelFrame(this.frameId);
      this.frameId = null;
    }
  }

  /**
   * End an interrupted route, unlike cancel() used for seamless segment
   * replacement. Clear the shared RAF subscription and reset the walking
   * state so the free-roam rearm effect does not see a phantom moving sprite.
   * setWalking can synchronously notify listeners; cancel first to invalidate
   * stale frames before notifying them.
   */
  stop(): void {
    this.cancel();
    this.deps.setWalking(false);
  }

  start(request: NativeResidentSegmentRequest): void {
    // Validate before canceling a previously valid segment.
    if (![request.from.x, request.from.y, request.to.x, request.to.y,
      request.startTimestamp, request.durationMs].every(Number.isFinite) ||
      request.durationMs <= 0) {
      throw new Error("Invalid native resident segment");
    }
    this.cancel();
    const token = this.generation;
    const segment = new NativeResidentSegmentProgress(request.startTimestamp, request.durationMs);
    this.active = true;
    this.deps.setWalking(true);
    if (token !== this.generation || !this.active) return;
    this.deps.advanceSprite(0);
    if (token !== this.generation || !this.active) return;

    const step: FrameCallback = (now, resumedAfterSuspension) => {
      if (token !== this.generation || !this.active) {
        this.ignoredStaleFrames++;
        return;
      }
      // One-shot RAF registrations are consumed on dispatch. A persistent
      // subscription remains owned until cancel/arrival/route replacement.
      if (!this.deps.subscribeFrame) this.frameId = null;
      this.deps.onFrame?.();
      if (token !== this.generation || !this.active) return;
      segment.sampleInto(now, this.deps.readTimeScale(), resumedAfterSuspension, this.frameSample);
      if (token !== this.generation || !this.active) return;
      const frame = this.frameSample;
      if (!frame.advance) {
        if (!this.deps.subscribeFrame) this.frameId = this.deps.requestFrame(step);
        return;
      }
      const t = frame.progress;
      const x = request.from.x + (request.to.x - request.from.x) * t;
      const y = request.from.y + (request.to.y - request.from.y) * t;
      // Avoid duplicate bridge writes. Native XY writer avoids allocating a
      // new point object while retaining the original value API for tests.
      if (this.lastWrittenX !== x || this.lastWrittenY !== y) {
        this.lastWrittenX = x;
        this.lastWrittenY = y;
        if (this.deps.writePositionXY) {
          this.deps.writePositionXY(x, y);
        } else {
          this.deps.writePosition!({ x, y });
        }
        this.positionWrites++;
        // Animated.Value listeners can synchronously replace a route.
        if (token !== this.generation || !this.active) return;
      }
      if (!frame.complete) {
        this.deps.advanceSprite(frame.elapsedMs);
        if (token !== this.generation || !this.active) return;
        if (!this.deps.subscribeFrame) this.frameId = this.deps.requestFrame(step);
        return;
      }
      this.active = false;
      this.completed++;
      // Remove the persistent subscriber *before* onArrival can synchronously
      // start a new segment; never leave an obsolete walker on the frame bus.
      if (this.frameId !== null) {
        this.deps.cancelFrame(this.frameId);
        this.frameId = null;
      }
      if (request.keepWalkingOnArrival) {
        this.deps.advanceSprite(0);
      } else {
        this.deps.setWalking(false);
      }
      if (token === this.generation) request.onArrival();
    };
    this.frameId = this.deps.subscribeFrame
      ? this.deps.subscribeFrame(step)
      : this.deps.requestFrame(step);
  }

  /** Aggregate in-memory diagnostics; never contains positions or resident IDs. */
  snapshot(): Readonly<{
    active: boolean;
    scheduled: boolean;
    completed: number;
    positionWrites: number;
    ignoredStaleFrames: number;
  }> {
    return {
      active: this.active,
      scheduled: this.frameId !== null,
      completed: this.completed,
      positionWrites: this.positionWrites,
      ignoredStaleFrames: this.ignoredStaleFrames
    };
  }
}
