import { markNativeResidentBusCycle } from "./nativeResidentWorkCounters";
import { beginNativeResidentDispatch, endNativeResidentDispatch } from "./nativeResidentDispatchProfiler";

/** The second argument is true on the first frame after suspension.
 * Residents use it to rebase their movement clock without a teleport.
 */
type ResidentFrameCallback = (timestamp: number, resumedAfterSuspension: boolean) => void;
type RequestFrame = (callback: (timestamp: number) => void) => number;
type CancelFrame = (id: number) => void;

/** Aggregate JS scheduler counts only; no resident IDs or positions. */
export type NativeResidentFrameBusSnapshot = Readonly<{
  queued: number;
  scheduled: boolean;
  active: boolean;
  dispatchCount: number;
  activityListeners: number;
  continuousSubscribers: number;
  subscriptionAdds: number;
  oneShotRequests: number;
  /** Count of one-shot dispatches using the two recycled Map buffers. */
  oneShotBufferSwaps: number;
}>;

/**
 * A single frame dispatcher for all moving native residents.
 *
 * A paused/background game has zero pending platform RAF callbacks. The
 * residents' one-shot callbacks are retained in memory and are delivered on
 * the first frame after activation, with the rebase signal set to true.
 *
 * All operations are in-memory. No persistence, polling or gameplay writes.
 */
export class NativeResidentFrameBus {
  private pending = new Map<number, ResidentFrameCallback>();
  /** Recycle the previous one-shot Map instead of allocating on every RAF. */
  private sparePending = new Map<number, ResidentFrameCallback>();
  private oneShotBufferSwaps = 0;
  /** Persistent movement subscribers avoid 200 re-registrations every frame. */
  private continuous = new Map<number, ResidentFrameCallback>();
  private subscriptionAdds = 0;
  private oneShotRequests = 0;
  private activityListeners = new Set<(active: boolean) => void>();
  private due: Map<number, ResidentFrameCallback> | null = null;
  private platformFrame: number | null = null;
  private nextId = 1;
  /** Distinguishes an obsolete native callback after cancel/reschedule. */
  private platformGeneration = 0;
  private flushing = false;
  private active = true;
  private firstFrameAfterResume = false;
  /** Any pause/resume transition invalidates the current dispatch batch. */
  private activityEpoch = 0;
  private dispatchCount = 0;

  constructor(
    private readonly requestPlatformFrame: RequestFrame = (fn) => requestAnimationFrame(fn),
    private readonly cancelPlatformFrame: CancelFrame = (id) => cancelAnimationFrame(id)
  ) {}

  request(callback: ResidentFrameCallback): number {
    const id = this.nextId++;
    this.pending.set(id, callback);
    this.oneShotRequests++;
    this.ensureScheduled();
    return id;
  }

  /**
   * Keep one callback registered across frames. New subscriptions created
   * during a flush start on the next frame, never in the current batch.
   * The same cancel(id) API removes one-shot and persistent registrations.
   */
  subscribeFrame(callback: ResidentFrameCallback): number {
    const id = this.nextId++;
    this.continuous.set(id, callback);
    this.subscriptionAdds++;
    this.ensureScheduled();
    return id;
  }

  cancel(id: number): void {
    this.pending.delete(id);
    this.due?.delete(id);
    this.continuous.delete(id);
    if (!this.flushing && this.pending.size === 0 && this.continuous.size === 0 && this.platformFrame !== null) {
      this.cancelPlatformFrame(this.platformFrame);
      this.platformFrame = null;
      this.platformGeneration++;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  /** Listeners only run on lifecycle transitions, never on animation frames. */
  subscribeActivity(listener: (active: boolean) => void): () => void {
    this.activityListeners.add(listener);
    // Idempotent cleanup: unmount during a lifecycle dispatch must not
    // receive a later callback from the dispatch's listener snapshot.
    return () => { this.activityListeners.delete(listener); };
  }

  /** Idempotent lifecycle gate for game pauses and app backgrounding. */
  setActive(active: boolean): void {
    if (this.active === active) return;
    const timing = beginNativeResidentDispatch("lifecycle");
    try {
    this.active = active;
    const transitionEpoch = ++this.activityEpoch;
    if (!active) {
      if (this.platformFrame !== null) {
        this.cancelPlatformFrame(this.platformFrame);
        this.platformFrame = null;
        this.platformGeneration++;
      }
      // Even if a stale OS RAF fires after cancellation, its callbacks must
      // remain queued until the game becomes active again.
    } else {
      this.firstFrameAfterResume = true;
    }
    // Notify idle/retry timers as well as walking residents. An app returning
    // to foreground must restart deferred work without a React rerender.
    let firstError: unknown = null;
    for (const listener of [...this.activityListeners]) {
      // A listener can pause and resume synchronously. Never deliver an
      // obsolete transition after a newer state has been published.
      if (this.activityEpoch !== transitionEpoch) break;
      // A previous listener may synchronously unmount a sibling. Do not
      // dispatch into a resident that has already unsubscribed.
      if (!this.activityListeners.has(listener)) continue;
      try {
        listener(active);
      } catch (error) {
        if (firstError === null) firstError = error;
      }
    }
    if (active) this.ensureScheduled();
    if (firstError !== null) throw firstError;
    } finally {
      endNativeResidentDispatch("lifecycle", timing);
    }
  }

  snapshot(): NativeResidentFrameBusSnapshot {
    return {
      queued: this.pending.size + (this.due?.size ?? 0) + this.continuous.size,
      scheduled: this.platformFrame !== null,
      active: this.active,
      dispatchCount: this.dispatchCount,
      activityListeners: this.activityListeners.size,
      continuousSubscribers: this.continuous.size,
      subscriptionAdds: this.subscriptionAdds,
      oneShotRequests: this.oneShotRequests,
      oneShotBufferSwaps: this.oneShotBufferSwaps
    };
  }

  private ensureScheduled(): void {
    if (!this.active || this.flushing || this.platformFrame !== null || (this.pending.size === 0 && this.continuous.size === 0)) return;
    const generation = ++this.platformGeneration;
    this.platformFrame = this.requestPlatformFrame((timestamp) => this.flush(timestamp, generation));
  }

  private flush(timestamp: number, generation: number): void {
    // A canceled OS RAF may still execute. Never flush the next live frame
    // using a stale callback from a previous generation.
    if (!this.active || this.platformFrame === null || generation !== this.platformGeneration) return;
    const timing = beginNativeResidentDispatch("frame");
    this.platformFrame = null;
    this.flushing = true;
    this.dispatchCount++;
    if (typeof __DEV__ !== "undefined" && __DEV__) markNativeResidentBusCycle();
    const rebase = this.firstFrameAfterResume;
    const dispatchEpoch = this.activityEpoch;
    this.firstFrameAfterResume = false;
    // Continuous-only animation frames never need an additional Map. When
    // one-shot callbacks are present, two buffers alternate so requests made
    // during a frame cannot run until the next frame. Neither case allocates
    // a Map at frame frequency (including the 200-one-shot fallback path).
    if (this.pending.size > 0) {
      this.due = this.pending;
      this.pending = this.sparePending;
      this.oneShotBufferSwaps++;
    } else {
      this.due = null;
    }
    // An ID boundary, not a copied Map/array: no O(residents) allocation
    // just to dispatch the same 200 subscribers on every animation frame.
    const maxContinuousIdAtFrameStart = this.nextId - 1;
    let firstError: unknown = null;
    try {
      // Continuous-only frames are the common 200-resident case. Avoid
      // allocating a fresh [] on every RAF when there are no one-shots.
      if (this.due !== null) for (const [id, callback] of this.due) {
        // A callback can synchronously pause the world in mid-batch. Hold the
        // remaining residents, rather than updating them while paused.
        if (!this.active || this.activityEpoch !== dispatchEpoch) break;
        if (!this.due?.has(id)) continue;
        this.due.delete(id);
        try {
          callback(timestamp, rebase);
        } catch (error) {
          // Preserve healthy residents even if one animation fails.
          if (firstError === null) firstError = error;
        }
      }
      if (this.active && this.activityEpoch === dispatchEpoch) {
        // Map iteration skips removed subscribers. New subscriptions receive
        // higher IDs and cannot execute during the same frame. If a callback
        // pauses the game, remaining subscribers are held until resume.
        for (const [id, callback] of this.continuous) {
          if (!this.active || this.activityEpoch !== dispatchEpoch) break;
          if (id > maxContinuousIdAtFrameStart) break;
          try {
            callback(timestamp, rebase);
          } catch (error) {
            if (firstError === null) firstError = error;
          }
        }
      }
    } finally {
      if (this.due !== null) {
        if (this.due.size > 0) {
          // A pause/reentrant lifecycle left unprocessed one-shots: prepend
          // them to the requests made during this frame, preserving FIFO.
          // Reuse both Maps rather than creating a third buffer.
          const newlyRequested = this.pending;
          for (const [id, callback] of newlyRequested) this.due.set(id, callback);
          newlyRequested.clear();
          this.pending = this.due;
          this.sparePending = newlyRequested;
        } else {
          // No pending leftovers: the consumed Map becomes the next spare.
          this.due.clear();
          this.sparePending = this.due;
        }
      }
      this.due = null;
      this.flushing = false;
      try {
        this.ensureScheduled();
      } finally {
        endNativeResidentDispatch("frame", timing);
      }
    }
    if (firstError !== null) throw firstError;
  }
}

const residentFrameBus = new NativeResidentFrameBus();

export function requestResidentAnimationFrame(callback: ResidentFrameCallback): number {
  return residentFrameBus.request(callback);
}

export function cancelResidentAnimationFrame(id: number): void {
  residentFrameBus.cancel(id);
}

export function setNativeResidentFrameBusActive(active: boolean): void {
  residentFrameBus.setActive(active);
}

/** Foreground + gameplay-pause state, shared with native idle/commute timers. */
export function isNativeResidentFrameBusActive(): boolean {
  return residentFrameBus.isActive();
}

export function subscribeNativeResidentFrameBusActivity(
  listener: (active: boolean) => void
): () => void {
  return residentFrameBus.subscribeActivity(listener);
}

/**
 * Native movement can subscribe once per segment instead of re-registering
 * every RAF. The default one-shot request API remains available and unchanged.
 */
export function subscribeResidentAnimationFrames(callback: ResidentFrameCallback): number {
  return residentFrameBus.subscribeFrame(callback);
}

/** Local diagnostic snapshot; no storage, network or game state. */
export function getNativeResidentFrameBusSnapshot(): NativeResidentFrameBusSnapshot {
  return residentFrameBus.snapshot();
}
