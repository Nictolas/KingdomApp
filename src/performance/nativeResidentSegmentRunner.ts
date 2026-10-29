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
  /** Persistent movement holds segment data instead of allocating a new
   * RAF callback each tile. One function serves this runner's whole life. */
  private currentPersistentRequest: NativeResidentSegmentRequest | null = null;
  private inArrivalCallback = false;
  private readonly dispatchPersistentFrame: FrameCallback = (timestamp, resumed) => {
    const request = this.currentPersistentRequest;
    if (request !== null) this.runFrame(timestamp, resumed, this.generation, request);
  };
  /** Segment coefficients are computed once, not on every animation frame. */
  private fromX = 0;
  private fromY = 0;
  private deltaX = 0;
  private deltaY = 0;
  private segmentStarts = 0;
  private frameCallbackAllocations = 0;
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
    this.currentPersistentRequest = null;
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
    if (!Number.isFinite(request.from.x) || !Number.isFinite(request.from.y) ||
      !Number.isFinite(request.to.x) || !Number.isFinite(request.to.y) ||
      !Number.isFinite(request.startTimestamp) || !Number.isFinite(request.durationMs) ||
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
      this.currentPersistentRequest = null;
      this.lastWrittenX = null;
      this.lastWrittenY = null;
    } else {
      this.cancel();
    }
    const token = this.generation;
    this.segmentProgress.reset(request.startTimestamp, request.durationMs);
    this.fromX = request.from.x;
    this.fromY = request.from.y;
    this.deltaX = request.to.x - request.from.x;
    this.deltaY = request.to.y - request.from.y;
    this.segmentStarts++;
    this.active = true;
    try {
    this.deps.setWalking(true);
    if (token !== this.generation || !this.active) return;
    this.deps.advanceSprite(0);
    if (token !== this.generation || !this.active) return;

    if (this.deps.subscribeFrame) {
      // Native persistent path: no per-tile RAF closure or re-registration.
      this.currentPersistentRequest = request;
      if (this.frameId === null) {
        this.frameId = this.deps.subscribeFrame(this.dispatchPersistentFrame);
      }
    } else {
      // One-shot callbacks must capture their token: canceled OS callbacks
      // can arrive after a replacement route starts.
      const step: FrameCallback = (at, rebase) =>
        this.runFrame(at, rebase, token, request, step);
      this.frameCallbackAllocations++;
      this.frameId = this.deps.requestFrame(step);
    }
    } catch (error) {
      this.abortFailedSegment(token);
      throw error;
    }
  }

  /** One segment executor for both schedulers. Persistent dispatches hold
   * current segment data, while one-shot callbacks supply requestNext. */
  private runFrame(
    now: number, resumedAfterSuspension: boolean, token: number,
    request: NativeResidentSegmentRequest, requestNext?: FrameCallback
  ): void {
    try {
      if (token !== this.generation || !this.active) {
        this.ignoredStaleFrames++;
        return;
      }
      if (requestNext) this.frameId = null;
      this.deps.onFrame?.();
      if (token !== this.generation || !this.active) return;
      this.segmentProgress.sampleInto(now, this.deps.readTimeScale(), resumedAfterSuspension, this.frameSample);
      if (token !== this.generation || !this.active) return;
      const frame = this.frameSample;
      if (!frame.advance) {
        if (requestNext) this.frameId = this.deps.requestFrame(requestNext);
        return;
      }
      const t = frame.progress;
      const x = this.fromX + this.deltaX * t;
      const y = this.fromY + this.deltaY * t;
      if (this.lastWrittenX !== x || this.lastWrittenY !== y) {
        this.lastWrittenX = x;
        this.lastWrittenY = y;
        if (this.deps.writePositionXY) {
          this.deps.writePositionXY(x, y);
        } else {
          this.deps.writePosition!({ x, y });
        }
        this.positionWrites++;
        if (token !== this.generation || !this.active) return;
      }
      if (!frame.complete) {
        this.deps.advanceSprite(frame.elapsedMs);
        if (token !== this.generation || !this.active) return;
        if (requestNext) this.frameId = this.deps.requestFrame(requestNext);
        return;
      }
      this.active = false;
      this.completed++;
      // A chained onArrival/start retains the SAME persistent subscriber,
      // while the next segment waits for the NEXT platform frame.
      if (requestNext && this.frameId !== null) {
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
  }

  /** Aggregate in-memory diagnostics; never contains positions or resident IDs. */
  snapshot(): Readonly<{
    active: boolean;
    scheduled: boolean;
    completed: number;
    positionWrites: number;
    ignoredStaleFrames: number;
    segmentStarts: number;
    /** Legacy per-segment RAF callbacks; zero for persistent native mode. */
    frameCallbackAllocations: number;
  }> {
    return {
      active: this.active,
      scheduled: this.frameId !== null,
      completed: this.completed,
      positionWrites: this.positionWrites,
      ignoredStaleFrames: this.ignoredStaleFrames,
      segmentStarts: this.segmentStarts,
      frameCallbackAllocations: this.frameCallbackAllocations
    };
  }
}
