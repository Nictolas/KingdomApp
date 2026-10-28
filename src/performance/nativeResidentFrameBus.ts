import { markNativeResidentBusCycle } from "./nativeResidentWorkCounters";

/** The second argument is true on the first frame after suspension.
 * Residents use it to rebase their movement clock without a teleport.
 */
type ResidentFrameCallback = (timestamp: number, resumedAfterSuspension: boolean) => void;
type RequestFrame = (callback: (timestamp: number) => void) => number;
type CancelFrame = (id: number) => void;

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
  private due: Map<number, ResidentFrameCallback> | null = null;
  private platformFrame: number | null = null;
  private nextId = 1;
  /** Distinguishes an obsolete native callback after cancel/reschedule. */
  private platformGeneration = 0;
  private flushing = false;
  private active = true;
  private firstFrameAfterResume = false;
  private dispatchCount = 0;

  constructor(
    private readonly requestPlatformFrame: RequestFrame = (fn) => requestAnimationFrame(fn),
    private readonly cancelPlatformFrame: CancelFrame = (id) => cancelAnimationFrame(id)
  ) {}

  request(callback: ResidentFrameCallback): number {
    const id = this.nextId++;
    this.pending.set(id, callback);
    this.ensureScheduled();
    return id;
  }

  cancel(id: number): void {
    this.pending.delete(id);
    this.due?.delete(id);
    if (!this.flushing && this.pending.size === 0 && this.platformFrame !== null) {
      this.cancelPlatformFrame(this.platformFrame);
      this.platformFrame = null;
      this.platformGeneration++;
    }
  }

  /** Idempotent lifecycle gate for game pauses and app backgrounding. */
  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    if (!active) {
      if (this.platformFrame !== null) {
        this.cancelPlatformFrame(this.platformFrame);
        this.platformFrame = null;
      }
      // Even if a stale OS RAF fires after cancellation, its callbacks must
      // remain queued until the game becomes active again.
    } else {
      this.firstFrameAfterResume = true;
      this.ensureScheduled();
    }
  }

  snapshot(): { queued: number; scheduled: boolean; active: boolean; dispatchCount: number } {
    return {
      queued: this.pending.size + (this.due?.size ?? 0),
      scheduled: this.platformFrame !== null,
      active: this.active,
      dispatchCount: this.dispatchCount
    };
  }

  private ensureScheduled(): void {
    if (!this.active || this.flushing || this.platformFrame !== null || this.pending.size === 0) return;
    const generation = ++this.platformGeneration;
    this.platformFrame = this.requestPlatformFrame((timestamp) => this.flush(timestamp, generation));
  }

  private flush(timestamp: number, generation: number): void {
    // A canceled OS RAF may still execute. Never flush the next live frame
    // using a stale callback from a previous generation.
    if (!this.active || this.platformFrame === null || generation !== this.platformGeneration) return;
    this.platformFrame = null;
    this.flushing = true;
    this.dispatchCount++;
    if (typeof __DEV__ !== "undefined" && __DEV__) markNativeResidentBusCycle();
    const rebase = this.firstFrameAfterResume;
    this.firstFrameAfterResume = false;
    this.due = this.pending;
    this.pending = new Map();
    let firstError: unknown = null;
    try {
      for (const [id, callback] of this.due) {
        // A callback can synchronously pause the world in mid-batch. Hold the
        // remaining residents, rather than updating them while paused.
        if (!this.active) break;
        if (!this.due.has(id)) continue;
        this.due.delete(id);
        try {
          callback(timestamp, rebase);
        } catch (error) {
          // Preserve healthy residents even if one animation fails.
          if (firstError === null) firstError = error;
        }
      }
    } finally {
      if (this.due.size > 0) {
        // Only happens if processing was interrupted by a pause. Preserve
        // order; callbacks registered during this frame remain after these.
        this.pending = new Map([...this.due, ...this.pending]);
      }
      this.due = null;
      this.flushing = false;
      this.ensureScheduled();
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
