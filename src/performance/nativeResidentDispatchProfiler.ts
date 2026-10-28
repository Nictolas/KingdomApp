/**
 * Opt-in, development-only timing of the *JavaScript* resident schedulers.
 *
 * A capture is started explicitly from the native diagnostic HUD. The hot
 * path does no clock reads, allocations or writes when no capture is active.
 * No resident identifiers, coordinates, paths, taps or saved game data.
 *
 * Values are JS callback-batch durations, NOT GPU/UI-thread FPS, touch input
 * latency, device CPU utilization, or proof of a performance improvement.
 */
export type NativeResidentDispatchKind = "frame" | "timer";
export type NativeResidentDispatchTicket = Readonly<{ token: number; startedAt: number }>;
export type NativeResidentDispatchDuration = Readonly<{
  samples: number;
  observed: number;
  dropped: number;
  totalMs: number;
  meanMs: number;
  p95Ms: number;
  maxMs: number;
  over8Ms: number;
  over16Ms: number;
}>;
export type NativeResidentDispatchReport = Readonly<{
  frame: NativeResidentDispatchDuration;
  timer: NativeResidentDispatchDuration;
}>;

class BoundedDurations {
  private readonly values: Float64Array;
  private next = 0;
  private size = 0;
  private observed = 0;

  constructor(capacity: number) {
    this.values = new Float64Array(capacity);
  }

  reset(): void {
    this.next = 0;
    this.size = 0;
    this.observed = 0;
  }

  record(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    this.values[this.next] = ms;
    this.next = (this.next + 1) % this.values.length;
    this.size = Math.min(this.size + 1, this.values.length);
    this.observed++;
  }

  summary(): NativeResidentDispatchDuration {
    if (!this.size) {
      return {
        samples: 0, observed: 0, dropped: 0, totalMs: 0,
        meanMs: 0, p95Ms: 0, maxMs: 0, over8Ms: 0, over16Ms: 0
      };
    }
    const values = Array.from(this.values.slice(0, this.size));
    const totalMs = values.reduce((sum, ms) => sum + ms, 0);
    const over8Ms = values.filter(ms => ms > 8).length;
    const over16Ms = values.filter(ms => ms > 16).length;
    values.sort((a, b) => a - b);
    return {
      samples: this.size,
      observed: this.observed,
      dropped: this.observed - this.size,
      totalMs,
      meanMs: totalMs / this.size,
      p95Ms: values[Math.ceil(this.size * 0.95) - 1]!,
      maxMs: values[this.size - 1]!,
      over8Ms,
      over16Ms
    };
  }
}

/**
 * Tokenized captures ensure a late callback from an earlier capture cannot
 * contaminate a new one. Each batch produces at most one sample.
 */
export class NativeResidentDispatchProfiler {
  private token = 0;
  private active = false;
  private readonly frames: BoundedDurations;
  private readonly timers: BoundedDurations;

  constructor(
    private readonly now: () => number = () => performance.now(),
    capacity = 4096
  ) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new Error("Invalid native resident dispatch profile capacity");
    }
    this.frames = new BoundedDurations(capacity);
    this.timers = new BoundedDurations(capacity);
  }

  start(): number {
    this.token++;
    this.active = true;
    this.frames.reset();
    this.timers.reset();
    return this.token;
  }

  begin(_kind: NativeResidentDispatchKind): NativeResidentDispatchTicket | null {
    if (!this.active) return null;
    const startedAt = this.now();
    if (!Number.isFinite(startedAt)) return null;
    return { token: this.token, startedAt };
  }

  end(kind: NativeResidentDispatchKind, ticket: NativeResidentDispatchTicket | null): void {
    if (!this.active || ticket === null || ticket.token !== this.token) return;
    const endedAt = this.now();
    if (!Number.isFinite(endedAt) || endedAt < ticket.startedAt) return;
    (kind === "frame" ? this.frames : this.timers).record(endedAt - ticket.startedAt);
  }

  cancel(token: number): void {
    if (this.active && token === this.token) this.active = false;
  }

  finish(token: number): NativeResidentDispatchReport | null {
    if (!this.active || token !== this.token) return null;
    this.active = false;
    return { frame: this.frames.summary(), timer: this.timers.summary() };
  }
}

const sharedProfiler = new NativeResidentDispatchProfiler();

/** HUD controls capture lifetime; no automatic background profiling. */
export const startNativeResidentDispatchCapture = (): number => sharedProfiler.start();
export const cancelNativeResidentDispatchCapture = (token: number): void => sharedProfiler.cancel(token);
export const finishNativeResidentDispatchCapture = (token: number): NativeResidentDispatchReport | null =>
  sharedProfiler.finish(token);
export const beginNativeResidentDispatch = (kind: NativeResidentDispatchKind): NativeResidentDispatchTicket | null =>
  sharedProfiler.begin(kind);
export const endNativeResidentDispatch = (
  kind: NativeResidentDispatchKind, ticket: NativeResidentDispatchTicket | null
): void => sharedProfiler.end(kind, ticket);
