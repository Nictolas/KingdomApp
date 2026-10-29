import { NativeFrameWindow, type NativeFrameSnapshot } from "./nativeFrameMetrics";
import type { NativeResidentTimerRate } from "./nativeResidentTimerDiagnostics";
import type { NativeResidentRenderRate } from "./nativeResidentWorkCounters";
import type { NativeResidentFrameBusRate } from "./nativeResidentFrameBusDiagnostics";
import type { NativeResidentDispatchReport } from "./nativeResidentDispatchProfiler";
import type { NativeResidentEventLoopLag } from "./nativeResidentEventLoopProbe";

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
  private invalidated = false;
  /** Strict capture mode rejects unobserved RAF gaps. */
  private lastAcceptedTimestamp: number | null = null;

  /** True if a >=2s JS RAF gap made the 10-second window unreliable. */
  isInvalidated(): boolean { return this.invalidated; }
  constructor(
    private readonly startedAt: number,
    private readonly durationMs = 10_000,
    private readonly requireContinuousFrames = false
  ) {
    if (!Number.isFinite(startedAt) || !Number.isFinite(durationMs) || durationMs <= 0) {
      throw new Error("Invalid diagnostic measurement parameters");
    }
  }

  record(timestamp: number, frameDeltaMs: number): NativeMeasurementResult | null {
    if (this.finished || this.invalidated || !Number.isFinite(timestamp) ||
      timestamp < this.startedAt) return null;
    // NativeFrameWindow deliberately omits >=2s RAF intervals because they
    // can signal a suspended app. For an explicit 10-second A/B capture,
    // silently dropping them would bias the reported p95/mean downward.
    // Invalidate instead of treating an incomplete window as comparable.
    // The first RAF after a user presses "Measure" may include time spent
    // BEFORE the capture began. Ignore that partial interval; including it
    // could bias p95 and average when the HUD button triggers React work.
    // Full intervals after the start are measured as usual.
    if (Number.isFinite(frameDeltaMs) &&
      timestamp - frameDeltaMs < this.startedAt) return null;
    if (this.requireContinuousFrames &&
      (!Number.isFinite(frameDeltaMs) || frameDeltaMs <= 0 ||
        (this.lastAcceptedTimestamp !== null &&
          (timestamp <= this.lastAcceptedTimestamp ||
            timestamp - this.lastAcceptedTimestamp >= 2000)))) {
      // Reject a missing RAF interval even if the caller reports a small
      // delta for the last frame after a long suspension.
      this.invalidated = true;
      return null;
    }
    if (Number.isFinite(frameDeltaMs) && frameDeltaMs >= 2000) {
      this.invalidated = true;
      return null;
    }
    this.lastAcceptedTimestamp = timestamp;
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
  environment: { platform: string; label: string; residents: number; terrainCells?: number; timeScale?: number },
  timerStats?: NativeResidentTimerRate,
  renderStats?: NativeResidentRenderRate,
  frameBusStats?: NativeResidentFrameBusRate,
  dispatchStats?: NativeResidentDispatchReport,
  eventLoopStats?: NativeResidentEventLoopLag
): string {
  const { metrics } = result;
  return [
    "MyKingdom - diagnostica prestazioni JS (non GPU/UI FPS)",
    `Piattaforma: ${environment.platform}`,
    `Scena: ${environment.label}`,
    `Elementi: ${environment.residents}`,
    ...(environment.timeScale === undefined ? [] : [`Velocità simulazione: ${environment.timeScale}x`]),
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
      `Batch timer con buffer riciclato: ${timerStats.readyBufferUses}`,
      `Batch timer con buffer riciclato/s: ${timerStats.readyBufferUsesPerSecond.toFixed(1)}`,
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
      `Buffer RAF one-shot riciclati: ${frameBusStats.oneShotBufferSwaps}`,
      `Buffer RAF one-shot riciclati/s: ${frameBusStats.oneShotBufferSwapsPerSecond.toFixed(1)}`,
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
      `Gestore tocchi JS campioni: ${dispatchStats.touch.samples}`,
      `Gestore tocchi JS medio: ${dispatchStats.touch.meanMs.toFixed(2)} ms`,
      `Gestore tocchi JS p95: ${dispatchStats.touch.p95Ms.toFixed(2)} ms`,
      `Gestore tocchi JS massimo: ${dispatchStats.touch.maxMs.toFixed(2)} ms`,
      `Transizioni pausa/background JS: ${dispatchStats.lifecycle.samples}`,
      `Transizioni pausa/background JS p95: ${dispatchStats.lifecycle.p95Ms.toFixed(2)} ms`,
      `Transizioni pausa/background JS massimo: ${dispatchStats.lifecycle.maxMs.toFixed(2)} ms`,
      "Durate dei callback JavaScript; NON FPS GPU/UI, latenza touch o utilizzo CPU."
    ]),
    ...(eventLoopStats == null ? [] : [
      `Ritardo loop JS campioni: ${eventLoopStats.samples}`,
      `Ritardo loop JS medio: ${eventLoopStats.meanMs.toFixed(2)} ms`,
      `Ritardo loop JS p95: ${eventLoopStats.p95Ms.toFixed(2)} ms`,
      `Ritardo loop JS massimo: ${eventLoopStats.maxMs.toFixed(2)} ms`,
      `Ritardo loop JS >16/>50 ms: ${eventLoopStats.over16Ms}/${eventLoopStats.over50Ms}`,
      `Campioni loop JS sovrascritti (buffer): ${eventLoopStats.dropped}`,
      "Ritardo setTimeout del thread JS: NON latenza touch o frame UI/GPU."
    ]),
    "Nota: non equivale a FPS del rendering o misura IA completa."
  ].join("\n");
}
