import { markNativeResidentBusCycle } from "./nativeResidentWorkCounters";

type ResidentFrameCallback = (timestamp: number) => void;
type RequestFrame = (callback: ResidentFrameCallback) => number;
type CancelFrame = (id: number) => void;

/**
 * Shared one-shot RAF dispatcher for resident sprite updates on Android/iOS.
 *
 * With 200 walking residents, React Native still computes 200 independent
 * positions, but registers ONE platform requestAnimationFrame per screen frame
 * instead of 200. An ID is only valid inside this dispatcher, never in the
 * platform RAF namespace. No timer, React state, simulation data or persistence.
 */
export class NativeResidentFrameBus {
  private pending = new Map<number, ResidentFrameCallback>();
  private due: Map<number, ResidentFrameCallback> | null = null;
  private platformFrame: number | null = null;
  private nextId = 1;
  private flushing = false;
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
    // A sibling may cancel another callback while the current batch executes.
    this.due?.delete(id);
    if (!this.flushing && this.pending.size === 0 && this.platformFrame !== null) {
      this.cancelPlatformFrame(this.platformFrame);
      this.platformFrame = null;
    }
  }

  /** Snapshot only: useful for deterministic diagnostic tests. */
  snapshot(): { queued: number; scheduled: boolean; dispatchCount: number } {
    return {
      queued: this.pending.size + (this.due?.size ?? 0),
      scheduled: this.platformFrame !== null,
      dispatchCount: this.dispatchCount
    };
  }

  private ensureScheduled(): void {
    if (this.flushing || this.platformFrame !== null || this.pending.size === 0) return;
    this.platformFrame = this.requestPlatformFrame((timestamp) => this.flush(timestamp));
  }

  private flush(timestamp: number): void {
    this.platformFrame = null;
    this.flushing = true;
    this.dispatchCount++;
    if (typeof __DEV__ !== "undefined" && __DEV__) markNativeResidentBusCycle();
    this.due = this.pending;
    this.pending = new Map();
    let firstError: unknown = null;
    try {
      for (const [id, callback] of this.due) {
        if (!this.due.has(id)) continue;
        this.due.delete(id);
        try {
          callback(timestamp);
        } catch (error) {
          // One bad resident must not starve the rest of the population.
          if (firstError === null) firstError = error;
        }
      }
    } finally {
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
