/**
 * Opt-in JS event-loop scheduling-delay probe for native diagnostics.
 *
 * This is NOT input latency, UI-thread/GPU frame timing or CPU utilization.
 * A single 50ms setTimeout heartbeat measures how late a JS task runs while
 * a user-initiated capture is active. No timers or clock reads when idle.
 *
 * Bounded in-memory samples only: no identifiers, paths, taps, storage or IO.
 */
export type NativeResidentEventLoopLag = Readonly<{
  samples: number;
  observed: number;
  dropped: number;
  meanMs: number;
  p95Ms: number;
  maxMs: number;
  over16Ms: number;
  over50Ms: number;
}>;

export class NativeResidentEventLoopProbe {
  private readonly values: Float64Array;
  private size = 0;
  private cursor = 0;
  private observed = 0;
  private token = 0;
  private active = false;
  private timer: number | null = null;

  constructor(
    private readonly now: () => number = () => performance.now(),
    private readonly schedule: (fn: () => void, delay: number) => number =
      (fn, delay) => setTimeout(fn, delay) as unknown as number,
    private readonly cancelTimer: (id: number) => void = id => clearTimeout(id),
    private readonly intervalMs = 50,
    capacity = 256
  ) {
    if (!Number.isFinite(intervalMs) || intervalMs <= 0 ||
      !Number.isSafeInteger(capacity) || capacity < 1) {
      throw new Error("Invalid native event loop probe parameters");
    }
    this.values = new Float64Array(capacity);
  }

  start(): number {
    this.stopTimer();
    this.token++;
    this.size = 0;
    this.cursor = 0;
    this.observed = 0;
    this.active = true;
    const at = this.now();
    if (!Number.isFinite(at)) {
      this.active = false;
      throw new Error("Invalid native event loop probe clock");
    }
    this.arm(this.token, at + this.intervalMs);
    return this.token;
  }

  private stopTimer(): void {
    if (this.timer !== null) this.cancelTimer(this.timer);
    this.timer = null;
  }

  private arm(token: number, due: number): void {
    this.timer = this.schedule(() => {
      // The platform may deliver a callback even after cancelTimer().
      if (!this.active || token !== this.token) return;
      this.timer = null;
      const observedAt = this.now();
      if (Number.isFinite(observedAt)) {
        if (observedAt >= due) {
          this.values[this.cursor] = observedAt - due;
          this.cursor = (this.cursor + 1) % this.values.length;
          this.size = Math.min(this.size + 1, this.values.length);
          this.observed++;
        }
        // Rebase after each sample; never enqueue a catch-up storm after
        // a long JS stall or a device clock regression.
        this.arm(token, observedAt + this.intervalMs);
      } else {
        // Avoid a busy loop if the injected/host clock becomes invalid.
        this.active = false;
      }
    }, this.intervalMs);
  }

  cancel(token: number): void {
    if (!this.active || token !== this.token) return;
    this.active = false;
    this.stopTimer();
  }

  finish(token: number): NativeResidentEventLoopLag | null {
    if (!this.active || token !== this.token) return null;
    this.active = false;
    this.stopTimer();
    if (this.size === 0) {
      return {
        samples: 0, observed: 0, dropped: 0, meanMs: 0, p95Ms: 0,
        maxMs: 0, over16Ms: 0, over50Ms: 0
      };
    }
    const values = Array.from(this.values.slice(0, this.size));
    const sum = values.reduce((total, ms) => total + ms, 0);
    const over16Ms = values.filter(ms => ms > 16).length;
    const over50Ms = values.filter(ms => ms > 50).length;
    values.sort((a, b) => a - b);
    return {
      samples: this.size,
      observed: this.observed,
      dropped: this.observed - this.size,
      meanMs: sum / this.size,
      p95Ms: values[Math.ceil(this.size * 0.95) - 1]!,
      maxMs: values[this.size - 1]!,
      over16Ms,
      over50Ms
    };
  }
}

const sharedProbe = new NativeResidentEventLoopProbe();
export const startNativeResidentEventLoopProbe = (): number => sharedProbe.start();
export const cancelNativeResidentEventLoopProbe = (token: number): void => sharedProbe.cancel(token);
export const finishNativeResidentEventLoopProbe = (token: number): NativeResidentEventLoopLag | null =>
  sharedProbe.finish(token);
