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
  /** Native frame bus: reuse one subscription across synchronous commute segments. */
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
  /** Dispatcher stays stable across synchronous onArrival -> start chains. */
  private currentPersistentStep: FrameCallback | null = null;
  private inArrivalCallback = false;
  private readonly dispatchPersistentFrame: FrameCallback = (timestamp, resumed) => {
    this.currentPersistentStep?.(timestamp, resumed);
  };
  private lastWrittenX: number | null = null;
  private lastWrittenY: number | null = null;
  /** One sample buffer per resident runner, not a new object every RAF. */
  /** Reuse one native-only motion clock across tile segments; no per-tile clock allocation. */
  private readonly segmentProgress = new NativeResidentSegmentProgress(0, 1);
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
    this.currentPersistentStep = null;
    this.lastWrittenX = null;
    this.lastWrittenY = null;
    if (this.frameId !== null) {
      const frameId = this.frameId;
      this.frameId = null; // invalidate ownership even if platform cancel throws
      this.deps.cancelFrame(frameId);
    }
  }

  /**
   * A bad native bridge or user callback must not leave a walking resident
   * subscribed forever and throwing on every 4x frame. The generation check
   * protects a replacement route started reentrantly by that same callback.
   * This is an error-only path; successful RAF samples do no extra work.
   */
  private abortFailedSegment(token: number): void {
    if (token !== this.generation) return;
    try {
      this.cancel();
    } catch {
      // Keep the originating callback exception as the diagnostic error.
      // cancel() invalidates ownership before calling the platform.
    }
    // A terminal segment sets active=false *before* setWalking(false) and
    // advanceSprite(0). If either notification throws, its visual walking
    // flag still needs a best-effort reset, even though the RAF is complete.
    try {
      this.deps.setWalking(false);
    } catch {
      // A second listener failure cannot obscure the first one.
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
    // A chained segment begins synchronously inside its predecessor's
    // onArrival, after that subscriber already ran this frame. Keep its
    // native registration: the new segment is first sampled NEXT RAF.
    // External reroutes, collision stops and one-shot callers retain the
    // original cancellation behavior.
    const reuseSubscription = !!this.deps.subscribeFrame &&
      this.inArrivalCallback && this.frameId !== null;
    if (reuseSubscription) {
      this.generation++;
      this.active = false;
      this.currentPersistentStep = null;
      this.lastWrittenX = null;
      this.lastWrittenY = null;
    } else {
      this.cancel();
    }
    const token = this.generation;
    this.segmentProgress.reset(request.startTimestamp, request.durationMs);
    this.active = true;
    try {
    this.deps.setWalking(true);
    if (token !== this.generation || !this.active) return;
    this.deps.advanceSprite(0);
    if (token !== this.generation || !this.active) return;

    const step: FrameCallback = (now, resumedAfterSuspension) => {
      try {
      if (token !== this.generation || !this.active) {
        this.ignoredStaleFrames++;
        return;
      }
      // One-shot RAF registrations are consumed on dispatch. A persistent
      // subscription remains owned until cancel/arrival/route replacement.
      if (!this.deps.subscribeFrame) this.frameId = null;
      this.deps.onFrame?.();
      if (token !== this.generation || !this.active) return;
      this.segmentProgress.sampleInto(now, this.deps.readTimeScale(), resumedAfterSuspension, this.frameSample);
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
      // One-shot callbacks are consumed. Keep a persistent subscriber
      // until onArrival has had the opportunity to chain the next segment.
      // An unsuccessful chain, exception or terminal arrival still releases
      // the subscriber in finally, so no idle resident holds a live RAF.
      if (!this.deps.subscribeFrame && this.frameId !== null) {
        this.deps.cancelFrame(this.frameId);
        this.frameId = null;
      }
      if (request.keepWalkingOnArrival) {
        this.deps.advanceSprite(0);
      } else {
        this.deps.setWalking(false);
      }
      if (token !== this.generation) return;
      this.inArrivalCallback = true;
      try {
        request.onArrival();
      } finally {
        this.inArrivalCallback = false;
        if (token === this.generation && !this.active) this.cancel();
      }
      } catch (error) {
        this.abortFailedSegment(token);
        throw error;
      }
    };
    if (this.deps.subscribeFrame) {
      this.currentPersistentStep = step;
      if (this.frameId === null) {
        this.frameId = this.deps.subscribeFrame(this.dispatchPersistentFrame);
      }
    } else {
      this.frameId = this.deps.requestFrame(step);
    }
    } catch (error) {
      this.abortFailedSegment(token);
      throw error;
    }
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
