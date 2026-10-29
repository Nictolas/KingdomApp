import React, { useCallback, useRef, useState } from "react";
import { getOrologioSimTimeScaleSnapshot, subscribeOrologioGiocoInPausa, subscribeOrologioGiocoVelocita } from "../game/orologioGiocoSession";
import { nativeCaptureContextChanged, type NativeCaptureContext } from "./nativeCaptureIntegrity";
import { NativeHudFrameLoop } from "./nativeHudFrameLoop";
import { useFocusEffect } from "expo-router";
import { AppState, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { NativeFrameWindow, type NativeFrameSnapshot } from "./nativeFrameMetrics";
import { takeNativeResidentFrameCallbacks, takeNativeResidentRenderInvocations, takeNativeResidentWrapperInvocations, takeNativeResidentBusCycles, getNativeResidentRenderTotals, diffNativeResidentRenderTotals, type NativeResidentRenderTotals } from "./nativeResidentWorkCounters";
import { NativeMeasurementSession, formatNativeMeasurement } from "./nativeMeasurementSession";
import { getNativeResidentTimerSnapshot, type NativeResidentTimerSnapshot } from "./nativeResidentTimerQueue";
import { diffNativeResidentTimerCounters } from "./nativeResidentTimerDiagnostics";
import { getNativeResidentFrameBusSnapshot, type NativeResidentFrameBusSnapshot } from "./nativeResidentFrameBus";
import { diffNativeResidentFrameBusSnapshots } from "./nativeResidentFrameBusDiagnostics";
import { startNativeResidentDispatchCapture, cancelNativeResidentDispatchCapture, finishNativeResidentDispatchCapture } from "./nativeResidentDispatchProfiler";
import { startNativeResidentEventLoopProbe, cancelNativeResidentEventLoopProbe, finishNativeResidentEventLoopProbe } from "./nativeResidentEventLoopProbe";

const INITIAL_METRICS: NativeFrameSnapshot = {
  samples: 0, jsFps: 0, meanFrameMs: 0, p95FrameMs: 0, framesOver33Ms: 0, framesOver50Ms: 0
};

/**
 * Device-local diagnostic only. Measures JS RAF pacing, NOT GPU/UI-thread FPS.
 * Runs only when developer opens details on a focused screen, stops on
 * collapse/background/blur/unmount; never saves/transmits data.
 */
export function NativePerformanceHud({
  residents,
  terrainCells,
  label,
  onOpenTest,
  captureBlockedReason = null,
  captureContextKey = ""
}: {
  residents: number;
  terrainCells?: number;
  label: string;
  onOpenTest?: () => void;
  captureBlockedReason?: string | null;
  captureContextKey?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState<NativeFrameSnapshot>(INITIAL_METRICS);
  const [residentCallbacks, setResidentCallbacks] = useState(0);
  const [residentRenders, setResidentRenders] = useState(0);
  const [residentWrapperRenders, setResidentWrapperRenders] = useState(0);
  const [residentBusCycles, setResidentBusCycles] = useState(0);
  const [timerMetrics, setTimerMetrics] = useState({
    pending: 0, platformWakeupsPerSecond: 0, logicalCallbacksPerSecond: 0, readyBufferUsesPerSecond: 0, budgetYieldsPerSecond: 0, timeBudgetYieldsPerSecond: 0, callbackBudget: 32, timeBudgetMs: 6, backlogDue: false, scheduled: false
  });
  const lastTimerSample = useRef<{ timestamp: number; counters: NativeResidentTimerSnapshot } | null>(null);
  const lastFrameBusSample = useRef<{ timestamp: number; counters: NativeResidentFrameBusSnapshot } | null>(null);
  const [frameBusMetrics, setFrameBusMetrics] = useState({
    continuousSubscribers: 0, persistentAddsPerSecond: 0, oneShotAddsPerSecond: 0, oneShotBufferSwapsPerSecond: 0
  });
  const frameWindow = useRef(new NativeFrameWindow(120));
  const [measuring, setMeasuring] = useState(false);
  const [latestReport, setLatestReport] = useState<string | null>(null);
  const [captureWarning, setCaptureWarning] = useState<string | null>(null);
  const currentScene = useRef({ label, residents, terrainCells });
  const capture = useRef<{
    session: NativeMeasurementSession;
    dispatchToken: number;
    lagToken: number;
    timerStart: NativeResidentTimerSnapshot;
    frameBusStart: NativeResidentFrameBusSnapshot;
    renderStart: NativeResidentRenderTotals;
    environment: NativeCaptureContext;
    contextKey: string;
  } | null>(null);

  /**
   * A mixed population/speed capture cannot be compared with another run.
   * Always close both optional probes before discarding its report.
   */
  const abortCapture = useCallback((reason?: string) => {
    const active = capture.current;
    if (!active) return;
    cancelNativeResidentDispatchCapture(active.dispatchToken);
    cancelNativeResidentEventLoopProbe(active.lagToken);
    capture.current = null;
    setMeasuring(false);
    if (reason) setCaptureWarning(reason);
  }, []);

  const previousCaptureContextKey = useRef(captureContextKey);
  React.useLayoutEffect(() => {
    if (previousCaptureContextKey.current !== captureContextKey) {
      previousCaptureContextKey.current = captureContextKey;
      setLatestReport(null);
    }
    if (capture.current && (captureBlockedReason || capture.current.contextKey !== captureContextKey))
      abortCapture("Misura interrotta: " + (captureBlockedReason ?? "contesto A/B cambiato."));
  }, [captureBlockedReason, captureContextKey, abortCapture]);

  React.useLayoutEffect(() => {
    // Commit-time metadata: a concurrent/aborted render must never change
    // the environment of an ongoing diagnostic measurement.
    currentScene.current = { label, residents, terrainCells };
    const active = capture.current;
    if (active && nativeCaptureContextChanged(active.environment, {
      platform: Platform.OS, label, residents, terrainCells,
      timeScale: getOrologioSimTimeScaleSnapshot()
    })) abortCapture("Misura interrotta: scena o numero di abitanti cambiati.");
  }, [label, residents, terrainCells, abortCapture]);

  const startMeasurement = useCallback(() => {
    if (captureBlockedReason) { setCaptureWarning(captureBlockedReason); return; }
    if (capture.current) {
      cancelNativeResidentDispatchCapture(capture.current.dispatchToken);
      cancelNativeResidentEventLoopProbe(capture.current.lagToken);
    }
    setLatestReport(null);
    setCaptureWarning(null);
    capture.current = {
      session: new NativeMeasurementSession(performance.now(), 10_000, true),
      dispatchToken: startNativeResidentDispatchCapture(),
      lagToken: startNativeResidentEventLoopProbe(),
      timerStart: getNativeResidentTimerSnapshot(),
      frameBusStart: getNativeResidentFrameBusSnapshot(),
      renderStart: getNativeResidentRenderTotals(),
      environment: { platform: Platform.OS, label, residents, terrainCells,
        timeScale: getOrologioSimTimeScaleSnapshot() },
      contextKey: captureContextKey
    };
    setMeasuring(true);
  }, [label, residents, terrainCells, captureBlockedReason, captureContextKey]);

  useFocusEffect(useCallback(() => {
    // Closed by default: absolutely no diagnostic RAF, AppState listener,
    // clock subscription or once-per-second React state publication while
    // the developer is simply playing the game.
    if (!expanded) {
      if (capture.current) abortCapture();
      return;
    }
    setStats(INITIAL_METRICS);
    setResidentCallbacks(0);
    setResidentRenders(0);
    setResidentWrapperRenders(0);
    setResidentBusCycles(0);
    setTimerMetrics({ pending: 0, platformWakeupsPerSecond: 0, logicalCallbacksPerSecond: 0, readyBufferUsesPerSecond: 0, budgetYieldsPerSecond: 0, timeBudgetYieldsPerSecond: 0, callbackBudget: 32, timeBudgetMs: 6, backlogDue: false, scheduled: false });
    lastTimerSample.current = { timestamp: performance.now(), counters: getNativeResidentTimerSnapshot() };
    lastFrameBusSample.current = { timestamp: performance.now(), counters: getNativeResidentFrameBusSnapshot() };
    setFrameBusMetrics({ continuousSubscribers: 0, persistentAddsPerSecond: 0, oneShotAddsPerSecond: 0, oneShotBufferSwapsPerSecond: 0 });
    takeNativeResidentBusCycles();
    takeNativeResidentFrameCallbacks();
    takeNativeResidentRenderInvocations();
    takeNativeResidentWrapperInvocations();
    frameWindow.current.reset();
    if (capture.current) {
      cancelNativeResidentDispatchCapture(capture.current.dispatchToken);
      cancelNativeResidentEventLoopProbe(capture.current.lagToken);
    }
    capture.current = null;
    setMeasuring(false);
    let frameLoop: NativeHudFrameLoop | null = null;
    let previous: number | null = null;
    let lastPublished = 0;
    // Clock changes during an opt-in capture invalidate the window even if
    // the simulation is paused and resumed between two animation frames.
    const onClockChange = () => {
      const active = capture.current;
      if (active && nativeCaptureContextChanged(active.environment, {
        ...active.environment, timeScale: getOrologioSimTimeScaleSnapshot()
      })) abortCapture("Misura interrotta: velocità o pausa di gioco cambiate.");
    };
    const unsubscribePause = subscribeOrologioGiocoInPausa(onClockChange);
    const unsubscribeSpeed = subscribeOrologioGiocoVelocita(onClockChange);
    const onStateChange = AppState.addEventListener("change", nextState => {
      frameLoop?.setForeground(nextState === "active");
      previous = null;
      frameWindow.current.reset();
      lastTimerSample.current = null;
      lastFrameBusSample.current = null;
      // A background/foreground interval must never appear in a valid
      // 10-second sample. The screen can be remeasured after return.
      abortCapture("Misura interrotta: applicazione in background.");
    });
    const onFrame = (timestamp: number) => {
      if (AppState.currentState === "active") {
        if (previous != null) {
          const delta = timestamp - previous;
          frameWindow.current.record(delta);
          const active = capture.current;
          if (active) {
            const context: NativeCaptureContext = {
              platform: Platform.OS, ...currentScene.current,
              timeScale: getOrologioSimTimeScaleSnapshot()
            };
            if (nativeCaptureContextChanged(active.environment, context)) {
              abortCapture("Misura interrotta: scena o velocità cambiate.");
            } else {
            const complete = active.session.record(timestamp, delta);
            if (active.session.isInvalidated()) {
              abortCapture("Misura interrotta: blocco JS o intervallo RAF di almeno 2 secondi.");
            } else if (complete) {
              capture.current = null;
              setMeasuring(false);
              const dispatch = finishNativeResidentDispatchCapture(active.dispatchToken);
              const lag = finishNativeResidentEventLoopProbe(active.lagToken);
              const delta = diffNativeResidentTimerCounters(
                active.timerStart, getNativeResidentTimerSnapshot(), complete.durationMs
              );
              const renders = diffNativeResidentRenderTotals(
                active.renderStart, getNativeResidentRenderTotals(), complete.durationMs
              );
              const frameBus = diffNativeResidentFrameBusSnapshots(
                active.frameBusStart, getNativeResidentFrameBusSnapshot(), complete.durationMs
              );
              setLatestReport(formatNativeMeasurement(complete, active.environment, delta, renders, frameBus, dispatch ?? undefined, lag ?? undefined));
            }
            }
          }
        }
        previous = timestamp;
        if (timestamp - lastPublished >= 1000) {
          setStats(frameWindow.current.snapshot());
          setResidentCallbacks(takeNativeResidentFrameCallbacks());
          setResidentRenders(takeNativeResidentRenderInvocations());
          setResidentWrapperRenders(takeNativeResidentWrapperInvocations());
          setResidentBusCycles(takeNativeResidentBusCycles());
          const next = getNativeResidentTimerSnapshot();
          const prev = lastTimerSample.current;
          const interval = prev ? timestamp - prev.timestamp : 0;
          const rates = prev ? diffNativeResidentTimerCounters(prev.counters, next, interval) : null;
          setTimerMetrics({
            pending: next.pending,
            scheduled: next.scheduled,
            callbackBudget: next.callbackBudget,
            timeBudgetMs: next.timeBudgetMs,
            timeBudgetYieldsPerSecond: rates?.timeBudgetYieldsPerSecond ?? 0,
            backlogDue: next.backlogDue,
            budgetYieldsPerSecond: rates?.budgetYieldsPerSecond ?? 0,
            platformWakeupsPerSecond: rates?.platformWakeupsPerSecond ?? 0,
            logicalCallbacksPerSecond: rates?.logicalCallbacksPerSecond ?? 0,
            readyBufferUsesPerSecond: rates?.readyBufferUsesPerSecond ?? 0
          });
          lastTimerSample.current = { timestamp, counters: next };
          const nextBus = getNativeResidentFrameBusSnapshot();
          const prevBus = lastFrameBusSample.current;
          const busInterval = prevBus ? timestamp - prevBus.timestamp : 0;
          const busRate = prevBus
            ? diffNativeResidentFrameBusSnapshots(prevBus.counters, nextBus, busInterval) : null;
          setFrameBusMetrics({
            continuousSubscribers: nextBus.continuousSubscribers,
            persistentAddsPerSecond: busRate?.persistentRegistrationsPerSecond ?? 0,
            oneShotAddsPerSecond: busRate?.oneShotRegistrationsPerSecond ?? 0,
            oneShotBufferSwapsPerSecond: busRate?.oneShotBufferSwapsPerSecond ?? 0
          });
          lastFrameBusSample.current = { timestamp, counters: nextBus };
          lastPublished = timestamp;
        }
      } else {
        previous = null;
      }
    };
    frameLoop = new NativeHudFrameLoop(requestAnimationFrame, cancelAnimationFrame, onFrame);
    frameLoop.start(AppState.currentState === "active");
    return () => {
      frameLoop?.stop();
      if (capture.current) {
        cancelNativeResidentDispatchCapture(capture.current.dispatchToken);
        cancelNativeResidentEventLoopProbe(capture.current.lagToken);
      }
      capture.current = null;
      unsubscribePause();
      unsubscribeSpeed();
      onStateChange.remove();
    };
  }, [abortCapture, expanded]));

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityLabel="Mostra o nascondi diagnostica prestazioni native" onPress={() => setExpanded((was) => !was)} style={styles.toggle}>
        <Text style={styles.title}>{expanded ? `JS ${stats.samples ? stats.jsFps.toFixed(0) : "—"} FPS · Chiudi` : "Diagnostica JS · Dettagli"}</Text>
      </Pressable>
      {expanded && (
        <View style={styles.panel}>
          <Text style={styles.text}>{label} · {residents} elementi</Text>
          {terrainCells != null && <Text style={styles.text}>Celle terreno visibili: {terrainCells}</Text>}
          <Text style={styles.text}>Media frame JS: {stats.samples ? stats.meanFrameMs.toFixed(1) : "—"} ms</Text>
          <Text style={styles.text}>p95 frame JS: {stats.samples ? stats.p95FrameMs.toFixed(1) : "—"} ms</Text>
          <Text style={styles.text}>Frame oltre 33/50 ms: {stats.framesOver33Ms}/{stats.framesOver50Ms}</Text>
          <Text style={styles.text}>Callback animazione abitanti/s: {residentCallbacks}</Text>
          <Text style={styles.text}>Wrapper abitanti/s: {residentWrapperRenders}</Text>
          <Text style={styles.text}>Render sprite React/s: {residentRenders}</Text>
          <Text style={styles.text}>Frame bus nativo/s: {residentBusCycles}</Text>
          <Text style={styles.text}>Abitanti iscritti a RAF persistente: {frameBusMetrics.continuousSubscribers}</Text>
          <Text style={styles.text}>Nuove iscrizioni RAF persistenti/s: {frameBusMetrics.persistentAddsPerSecond.toFixed(1)}</Text>
          <Text style={styles.text}>Registrazioni RAF one-shot/s: {frameBusMetrics.oneShotAddsPerSecond.toFixed(1)}</Text>
          <Text style={styles.text}>Buffer RAF one-shot riciclati/s: {frameBusMetrics.oneShotBufferSwapsPerSecond.toFixed(1)}</Text>
          <Text style={styles.text}>Timer residenti in attesa: {timerMetrics.pending}</Text>
          <Text style={styles.text}>Timeout nativi attivi: {timerMetrics.scheduled ? 1 : 0}</Text>
          <Text style={styles.text}>Wakeup timer nativo/s: {timerMetrics.platformWakeupsPerSecond.toFixed(1)}</Text>
          <Text style={styles.text}>Callback timer residenti/s: {timerMetrics.logicalCallbacksPerSecond.toFixed(1)}</Text>
          <Text style={styles.text}>Buffer timeout riciclati/s: {timerMetrics.readyBufferUsesPerSecond.toFixed(1)}</Text>
          <Text style={styles.text}>Max callback per wakeup: {timerMetrics.callbackBudget}</Text>
          <Text style={styles.text}>Budget JS timer: {timerMetrics.timeBudgetMs.toFixed(1)} ms (soft)</Text>
          <Text style={styles.text}>Yield per budget temporale/s: {timerMetrics.timeBudgetYieldsPerSecond.toFixed(1)}</Text>
          <Text style={styles.text}>Backlog già scaduto: {timerMetrics.backlogDue ? "sì" : "no"}</Text>
          <Text style={styles.text}>Yield backlog/s: {timerMetrics.budgetYieldsPerSecond.toFixed(1)}</Text>
          <Text style={styles.note}>Wrapper e render sprite sono invocazioni di funzione React, non commit. RAF persistenti e one-shot misurano registrazioni JS. La misura di 10 s include i batch RAF/timer JS, i gestori dei tocchi e il ritardo del loop JS; non misura FPS UI/GPU né la latenza fisica del touch. Nessun dato salvato.</Text>
          <Pressable
            style={[styles.testButton, (measuring || captureBlockedReason) && styles.disabledButton]}
            disabled={measuring || !!captureBlockedReason}
            accessibilityRole="button"
            onPress={startMeasurement}
          >
            <Text style={styles.buttonText}>{measuring ? "Campionamento in corso (10 s)" : "Misura 10 secondi"}</Text>
          </Pressable>
          {captureWarning && <Text style={styles.note}>{captureWarning}</Text>}
          {captureBlockedReason && <Text style={styles.note}>{captureBlockedReason}</Text>}
          {captureWarning && <Text style={styles.note}>{captureWarning}</Text>}
          {latestReport && (
            <>
              <Text style={styles.text}>{latestReport.split("\n").filter((line) => /FPS JS medio:|p95:|Campioni:|Batch RAF JS p95:|Batch timer JS p95:|Ritardo loop JS p95:|Gestore tocchi JS p95:/.test(line)).join(" · ")}</Text>
              <Pressable
                style={styles.testButton}
                accessibilityRole="button"
                onPress={() => { void Share.share({ message: latestReport }); }}
              >
                <Text style={styles.buttonText}>Condividi risultati</Text>
              </Pressable>
            </>
          )}
          {onOpenTest && (
            <Pressable style={styles.testButton} accessibilityRole="button" onPress={onOpenTest}>
              <Text style={styles.buttonText}>Prova 25–200 elementi</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", top: 8, right: 8, zIndex: 900, maxWidth: 255, alignItems: "flex-end" },
  toggle: { backgroundColor: "rgba(10,21,35,0.92)", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, borderWidth: 1, borderColor: "#72829b" },
  title: { color: "#e2e8f0", fontSize: 11, fontWeight: "700" },
  panel: { backgroundColor: "rgba(10,21,35,0.96)", padding: 10, borderRadius: 8, marginTop: 4, width: 235, borderWidth: 1, borderColor: "#64748b", gap: 5 },
  text: { color: "#f1f5f9", fontSize: 11 },
  note: { color: "#cbd5e1", fontSize: 10, lineHeight: 14 },
  testButton: { backgroundColor: "#2563eb", paddingVertical: 8, paddingHorizontal: 8, borderRadius: 7, marginTop: 5 },
  disabledButton: { opacity: 0.55 },
  buttonText: { color: "#ffffff", fontWeight: "700", fontSize: 11, textAlign: "center" }
});
