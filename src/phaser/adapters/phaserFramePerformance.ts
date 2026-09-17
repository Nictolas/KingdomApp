export type PhaserFramePerformanceMetrics = {
  sampleCount: number;
  meanFrameMs: number;
  p95FrameMs: number;
  meanFps: number;
  framesOver33Ms: number;
  framesOver50Ms: number;
};

export class PhaserFramePerformanceSampler {
  private readonly samples: number[] = [];

  constructor(private readonly maxSamples = 600) {}

  push(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
    this.samples.push(deltaMs);
    if (this.samples.length > this.maxSamples) {
      this.samples.splice(0, this.samples.length - this.maxSamples);
    }
  }

  reset(): void {
    this.samples.length = 0;
  }

  snapshot(): PhaserFramePerformanceMetrics {
    if (this.samples.length === 0) {
      return {
        sampleCount: 0,
        meanFrameMs: 0,
        p95FrameMs: 0,
        meanFps: 0,
        framesOver33Ms: 0,
        framesOver50Ms: 0
      };
    }

    const sorted = [...this.samples].sort((a, b) => a - b);
    const total = this.samples.reduce((sum, value) => sum + value, 0);
    const meanFrameMs = total / this.samples.length;
    const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);

    return {
      sampleCount: this.samples.length,
      meanFrameMs,
      p95FrameMs: sorted[p95Index],
      meanFps: meanFrameMs > 0 ? 1000 / meanFrameMs : 0,
      framesOver33Ms: this.samples.filter((value) => value > 33.333).length,
      framesOver50Ms: this.samples.filter((value) => value > 50).length
    };
  }
}

export function formatPhaserFramePerformance(metrics: PhaserFramePerformanceMetrics): string {
  return [
    `FPS ${metrics.meanFps.toFixed(1)}`,
    `avg ${metrics.meanFrameMs.toFixed(1)} ms`,
    `p95 ${metrics.p95FrameMs.toFixed(1)} ms`,
    `>33 ${metrics.framesOver33Ms}`,
    `>50 ${metrics.framesOver50Ms}`,
    `n=${metrics.sampleCount}`
  ].join(" | ");
}
