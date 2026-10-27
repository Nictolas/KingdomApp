/**
 * Diagnostic for the React Native JS requestAnimationFrame loop.
 * These timings do NOT represent GPU frame render time or UI-thread FPS.
 * No telemetry, disk writes, or uploads.
 */
export type NativeFrameSnapshot = {
  samples: number;
  jsFps: number;
  meanFrameMs: number;
  p95FrameMs: number;
  framesOver33Ms: number;
  framesOver50Ms: number;
};

export class NativeFrameWindow {
  private readonly intervals: number[] = [];
  constructor(private readonly capacity = 120) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error("Frame window capacity must be a positive integer");
    }
  }

  record(deltaMs: number): void {
    // Ignore app suspension / background intervals; count ordinary stalls.
    if (!Number.isFinite(deltaMs) || deltaMs <= 0 || deltaMs >= 2000) return;
    if (this.intervals.length >= this.capacity) this.intervals.shift();
    this.intervals.push(deltaMs);
  }

  reset(): void {
    this.intervals.length = 0;
  }

  snapshot(): NativeFrameSnapshot {
    if (!this.intervals.length) {
      return { samples: 0, jsFps: 0, meanFrameMs: 0, p95FrameMs: 0, framesOver33Ms: 0, framesOver50Ms: 0 };
    }
    const samples = this.intervals.length;
    const meanFrameMs = this.intervals.reduce((sum, ms) => sum + ms, 0) / samples;
    const sorted = [...this.intervals].sort((a, b) => a - b);
    return {
      samples,
      jsFps: 1000 / meanFrameMs,
      meanFrameMs,
      p95FrameMs: sorted[Math.ceil(samples * 0.95) - 1]!,
      framesOver33Ms: this.intervals.filter((ms) => ms > 33.333).length,
      framesOver50Ms: this.intervals.filter((ms) => ms > 50).length
    };
  }
}
