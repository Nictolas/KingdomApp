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
  /**
   * The hot 200-resident persistent path uses Map.forEach with a stable
   * visitor. A for..of Map iterator materializes [id, callback] entries on
   * every RAF; this path creates neither an iterator nor a new visitor closure
   * per frame. No change to the one-shot Map-buffer semantics.
   */
  private continuousTimestamp = 0;
  private continuousRebase = false;
  private continuousEpoch = 0;
  private continuousMaxId = 0;
  private continuousFirstError: unknown = undefined;
  private continuousHasError = false;
  private readonly visitContinuous = (callback: ResidentFrameCallback, id: number): void => {
    // Map.forEach may visit subscribers added while iterating. They are
    // deliberately ineligible until the next platform frame.
    if (!this.active || this.activityEpoch !== this.continuousEpoch ||
        id > this.continuousMaxId) return;
    try {
      callback(this.continuousTimestamp, this.continuousRebase);
    } catch (error) {
      // A broken resident must not starve its 199 healthy siblings. Preserve
      // even falsy thrown values (null, undefined, 0, false).
      if (!this.continuousHasError) {
        this.continuousFirstError = error;
        this.continuousHasError = true;
      }
    }
  };

  constructor(
    private readonly requestPlatformFrame: RequestFrame = (fn) => requestAnimationFrame(fn),
    private readonly cancelPlatformFrame: CancelFrame = (id) => cancelAnimationFrame(id)
  ) {}

  request(callback: ResidentFrameCallback): number {
    const id = this.nextId++;
    this.pending.set(id, callback);
    this.oneShotRequests++;
    try {
      this.ensureScheduled();
    } catch (error) {
      // Native requestAnimationFrame may throw before returning an ID.
      // Never strand an unowned one-shot that could run on a later frame.
      this.pending.delete(id);
      this.oneShotRequests--;
      throw error;
    }
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
    try {
      this.ensureScheduled();
    } catch (error) {
      // If platform RAF registration failed, the resident never received
      // its subscription handle. Roll back before another sprite schedules.
      this.continuous.delete(id);
      this.subscriptionAdds--;
      throw error;
    }
    return id;
  }

  cancel(id: number): void {
    this.pending.delete(id);
    this.due?.delete(id);
    this.continuous.delete(id);
    if (!this.flushing && this.pending.size === 0 && this.continuous.size === 0 && this.platformFrame !== null) {
      const frame = this.platformFrame;
      this.platformFrame = null;
      this.platformGeneration++; // invalidate stale OS callbacks BEFORE cancel
      this.cancelPlatformFrame(frame);
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
    if (this.active === active) {
      // Recover a missing platform RAF after a transient bridge failure.
      // No duplicate scheduling when the existing frame is healthy.
      if (active) this.ensureScheduled();
      return;
    }
    const timing = beginNativeResidentDispatch("lifecycle");
    try {
    this.active = active;
    const transitionEpoch = ++this.activityEpoch;
    // Notify lifecycle listeners even if the native bridge fails to cancel
    // a frame. The gate has already published its new state; letting one
    // thrown cancellation skip 200 listeners would desynchronise residents.
    let firstError: unknown = undefined;
    let hasError = false;
    if (!active) {
      if (this.platformFrame !== null) {
        const frame = this.platformFrame;
        this.platformFrame = null;
        this.platformGeneration++; // stale OS RAF cannot revive a paused world
        try {
          this.cancelPlatformFrame(frame);
        } catch (error) {
          firstError = error;
          hasError = true;
        }
      }
    } else {
      this.firstFrameAfterResume = true;
    }
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
        if (!hasError) {
          firstError = error;
          hasError = true;
        }
      }
    }
    if (active) {
      try {
        this.ensureScheduled();
      } catch (error) {
        if (!hasError) {
          firstError = error;
          hasError = true;
        }
      }
    }
    if (hasError) throw firstError;
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
    try {
      this.platformFrame = this.requestPlatformFrame((timestamp) => this.flush(timestamp, generation));
    } catch (error) {
      // A bridge can schedule then throw before returning its handle.
      // Invalidate that inaccessible callback and permit a future retry.
      this.platformFrame = null;
      this.platformGeneration++;
      throw error;
    }
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
    this.continuousTimestamp = timestamp;
    this.continuousRebase = rebase;
    this.continuousEpoch = dispatchEpoch;
    this.continuousMaxId = this.nextId - 1;
    this.continuousHasError = false;
    this.continuousFirstError = undefined;
    let firstError: unknown = undefined;
    let hasError = false;
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
          if (!hasError) {
            firstError = error;
            hasError = true;
          }
        }
      }
      if (this.active && this.activityEpoch === dispatchEpoch) {
        // Stable callback: no Map entries iterator / [id, callback] tuples
        // in the hot path. Deletions, additions and lifecycle transitions
        // retain the same eligibility boundary as the previous loop.
        this.continuous.forEach(this.visitContinuous);
        if (this.continuousHasError && !hasError) {
          firstError = this.continuousFirstError;
          hasError = true;
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
      // Never retain an exception (and its captured objects) between frames.
      this.continuousFirstError = undefined;
      this.continuousHasError = false;
      try {
        this.ensureScheduled();
      } finally {
        endNativeResidentDispatch("frame", timing);
      }
    }
    if (hasError) throw firstError;
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
