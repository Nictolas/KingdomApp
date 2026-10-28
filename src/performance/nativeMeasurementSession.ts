import { NativeFrameWindow, type NativeFrameSnapshot } from "./nativeFrameMetrics";
import type { NativeResidentTimerRate } from "./nativeResidentTimerDiagnostics";
import type { NativeResidentRenderRate } from "./nativeResidentWorkCounters";

export type NativeMeasurementResult = {
  durationMs: number;
  metrics: NativeFrameSnapshot;
};

/**
 * Bounded, 10-second JS RAF diagnostic. No storage or network.
 * The caller must cancel when the app backgrounds or route loses focus.
 */
export class NativeMeasurementSession {
  private readonly frames = new NativeFrameWindow(4096);
  private finished = false;
  constructor(
    private readonly startedAt: number,
    private readonly durationMs = 10_000
  ) {
    if (!Number.isFinite(startedAt) || !Number.isFinite(durationMs) || durationMs <= 0) {
      throw new Error("Invalid diagnostic measurement parameters");
    }
  }

  record(timestamp: number, frameDeltaMs: number): NativeMeasurementResult | null {
    if (this.finished || !Number.isFinite(timestamp) || timestamp < this.startedAt) return null;
    // Never include the first post-deadline interval in the measured window.
    if (timestamp >= this.startedAt + this.durationMs) {
      this.finished = true;
      return { durationMs: this.durationMs, metrics: this.frames.snapshot() };
    }
    this.frames.record(frameDeltaMs);
    return null;
  }
}

/** Only user-initiated sharing; report contains diagnostic counts, no game data. */
export function formatNativeMeasurement(
  result: NativeMeasurementResult,
  environment: { platform: string; label: string; residents: number; terrainCells?: number },
  timerStats?: NativeResidentTimerRate,
  renderStats?: NativeResidentRenderRate
): string {
  const { metrics } = result;
  return [
    "MyKingdom - diagnostica prestazioni JS (non GPU/UI FPS)",
    `Piattaforma: ${environment.platform}`,
    `Scena: ${environment.label}`,
    `Elementi: ${environment.residents}`,
    ...(environment.terrainCells == null ? [] : [`Celle terreno: ${environment.terrainCells}`]),
    `Durata: ${result.durationMs / 1000} s`,
    `Campioni: ${metrics.samples}`,
    `FPS JS medio: ${metrics.jsFps.toFixed(1)}`,
    `Frame medio: ${metrics.meanFrameMs.toFixed(1)} ms`,
    `p95: ${metrics.p95FrameMs.toFixed(1)} ms`,
    `Frame oltre 33 ms: ${metrics.framesOver33Ms}`,
    `Frame oltre 50 ms: ${metrics.framesOver50Ms}`,
    ...(renderStats == null ? [] : [
      `Wrapper abitanti: ${renderStats.wrappers}`,
      `Render sprite React: ${renderStats.bodies}`,
      `Wrapper abitanti/s: ${renderStats.wrappersPerSecond.toFixed(1)}`,
      `Render sprite React/s: ${renderStats.bodiesPerSecond.toFixed(1)}`
    ]),
    ...(timerStats == null ? [] : [
      `Wakeup timeout nativo: ${timerStats.platformWakeups}`,
      `Callback timer residenti: ${timerStats.logicalCallbacks}`,
      `Timeout nativi programmati: ${timerStats.platformSchedules}`,
      `Timeout nativi annullati: ${timerStats.platformCancellations}`,
      `Wakeup timeout nativo/s: ${timerStats.platformWakeupsPerSecond.toFixed(1)}`,
      `Callback timer residenti/s: ${timerStats.logicalCallbacksPerSecond.toFixed(1)}`
    ]),
    "Nota: non equivale a FPS del rendering o misura IA completa."
  ].join("\n");
}
