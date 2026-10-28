import { NativeResidentSegmentProgress } from "./nativeResidentSegmentProgress";

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
export type NativeResidentSegmentDependencies = Readonly<{
  requestFrame: (callback: FrameCallback) => number;
  cancelFrame: (id: number) => void;
  readTimeScale: () => number;
  writePosition: (point: NativeResidentPoint) => void;
  advanceSprite: (elapsedMs: number) => void;
  setWalking: (moving: boolean) => void;
  onFrame?: () => void;
}>;

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
  private lastWritten: NativeResidentPoint | null = null;
  private active = false;
  private completed = 0;
  private positionWrites = 0;
  private ignoredStaleFrames = 0;

  constructor(private readonly deps: NativeResidentSegmentDependencies) {}

  cancel(): void {
    this.generation++;
    this.active = false;
    this.lastWritten = null;
    if (this.frameId !== null) {
      this.deps.cancelFrame(this.frameId);
      this.frameId = null;
    }
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
      // The pending ID has already been dispatched. The next registration
      // belongs to this segment unless onArrival starts another one.
      this.frameId = null;
      this.deps.onFrame?.();
      if (token !== this.generation || !this.active) return;
      const frame = segment.sample(now, this.deps.readTimeScale(), resumedAfterSuspension);
      if (!frame.advance) {
        this.frameId = this.deps.requestFrame(step);
        return;
      }
      const t = frame.progress;
      const point = {
        x: request.from.x + (request.to.x - request.from.x) * t,
        y: request.from.y + (request.to.y - request.from.y) * t
      };
      // Avoid duplicate bridge writes, including the duplicate final snap
      // that both old movement loops performed at progress=1.
      if (!this.lastWritten ||
        point.x !== this.lastWritten.x || point.y !== this.lastWritten.y) {
        this.lastWritten = point;
        this.deps.writePosition(point);
        this.positionWrites++;
        // Animated.Value listeners can synchronously replace a route.
        if (token !== this.generation || !this.active) return;
      }
      if (!frame.complete) {
        this.deps.advanceSprite(frame.elapsedMs);
        if (token !== this.generation || !this.active) return;
        this.frameId = this.deps.requestFrame(step);
        return;
      }
      this.active = false;
      this.completed++;
      if (request.keepWalkingOnArrival) {
        this.deps.advanceSprite(0);
      } else {
        this.deps.setWalking(false);
      }
      if (token === this.generation) request.onArrival();
    };
    this.frameId = this.deps.requestFrame(step);
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
