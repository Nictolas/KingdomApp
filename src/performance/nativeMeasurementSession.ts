import { NativeFrameWindow, type NativeFrameSnapshot } from "./nativeFrameMetrics";
import type { NativeResidentTimerRate } from "./nativeResidentTimerDiagnostics";
import type { NativeResidentRenderRate } from "./nativeResidentWorkCounters";
import type { NativeResidentFrameBusRate } from "./nativeResidentFrameBusDiagnostics";
import type { NativeResidentDispatchReport } from "./nativeResidentDispatchProfiler";

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
  renderStats?: NativeResidentRenderRate,
  frameBusStats?: NativeResidentFrameBusRate,
  dispatchStats?: NativeResidentDispatchReport
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
      `Yield backlog timer: ${timerStats.budgetYields}`,
      `Yield backlog timer/s: ${timerStats.budgetYieldsPerSecond.toFixed(1)}`,
      `Yield per budget temporale JS: ${timerStats.timeBudgetYields}`,
      `Yield per budget temporale JS/s: ${timerStats.timeBudgetYieldsPerSecond.toFixed(1)}`,
      `Wakeup timeout nativo/s: ${timerStats.platformWakeupsPerSecond.toFixed(1)}`,
      `Callback timer residenti/s: ${timerStats.logicalCallbacksPerSecond.toFixed(1)}`
    ]),
    ...(frameBusStats == null ? [] : [
      `Sottoscrizioni RAF persistenti nuove: ${frameBusStats.persistentRegistrations}`,
      `Registrazioni RAF one-shot nuove: ${frameBusStats.oneShotRegistrations}`,
      `Frame dispatch bus: ${frameBusStats.platformFrameDispatches}`,
      `Sottoscrizioni RAF persistenti/s: ${frameBusStats.persistentRegistrationsPerSecond.toFixed(1)}`,
      `Registrazioni RAF one-shot/s: ${frameBusStats.oneShotRegistrationsPerSecond.toFixed(1)}`,
      `Sottoscrizioni RAF persistenti attive: ${frameBusStats.continuousSubscribersAtEnd}`
    ]),
    ...(dispatchStats == null ? [] : [
      `Batch RAF JS campionati: ${dispatchStats.frame.samples}`,
      `Batch RAF JS medio: ${dispatchStats.frame.meanMs.toFixed(2)} ms`,
      `Batch RAF JS p95: ${dispatchStats.frame.p95Ms.toFixed(2)} ms`,
      `Batch RAF JS massimo: ${dispatchStats.frame.maxMs.toFixed(2)} ms`,
      `Batch RAF JS >8/>16 ms: ${dispatchStats.frame.over8Ms}/${dispatchStats.frame.over16Ms}`,
      `Batch timer JS campionati: ${dispatchStats.timer.samples}`,
      `Batch timer JS medio: ${dispatchStats.timer.meanMs.toFixed(2)} ms`,
      `Batch timer JS p95: ${dispatchStats.timer.p95Ms.toFixed(2)} ms`,
      `Batch timer JS massimo: ${dispatchStats.timer.maxMs.toFixed(2)} ms`,
      `Batch timer JS >8/>16 ms: ${dispatchStats.timer.over8Ms}/${dispatchStats.timer.over16Ms}`,
      `Campioni RAF/timer sovrascritti (buffer): ${dispatchStats.frame.dropped}/${dispatchStats.timer.dropped}`,
      "Durate dei callback JavaScript; NON FPS GPU/UI, latenza touch o utilizzo CPU."
    ]),
    "Nota: non equivale a FPS del rendering o misura IA completa."
  ].join("\n");
}
