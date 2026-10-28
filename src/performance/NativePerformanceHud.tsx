import React, { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { NativeFrameWindow, type NativeFrameSnapshot } from "./nativeFrameMetrics";
import { takeNativeResidentFrameCallbacks, takeNativeResidentRenderInvocations, takeNativeResidentBusCycles } from "./nativeResidentWorkCounters";
import { NativeMeasurementSession, formatNativeMeasurement } from "./nativeMeasurementSession";
import { getNativeResidentTimerSnapshot, type NativeResidentTimerSnapshot } from "./nativeResidentTimerQueue";
import { diffNativeResidentTimerCounters } from "./nativeResidentTimerDiagnostics";

const INITIAL_METRICS: NativeFrameSnapshot = {
  samples: 0, jsFps: 0, meanFrameMs: 0, p95FrameMs: 0, framesOver33Ms: 0, framesOver50Ms: 0
};

/**
 * Device-local diagnostic only. Measures JS RAF pacing, NOT GPU/UI-thread FPS.
 * Runs only while mounted and stops on unmount; never saves/transmits data.
 */
export function NativePerformanceHud({
  residents,
  terrainCells,
  label,
  onOpenTest
}: {
  residents: number;
  terrainCells?: number;
  label: string;
  onOpenTest?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState<NativeFrameSnapshot>(INITIAL_METRICS);
  const [residentCallbacks, setResidentCallbacks] = useState(0);
  const [residentRenders, setResidentRenders] = useState(0);
  const [residentBusCycles, setResidentBusCycles] = useState(0);
  const [timerMetrics, setTimerMetrics] = useState({
    pending: 0, platformWakeupsPerSecond: 0, logicalCallbacksPerSecond: 0, scheduled: false
  });
  const lastTimerSample = useRef<{ timestamp: number; counters: NativeResidentTimerSnapshot } | null>(null);
  const frameWindow = useRef(new NativeFrameWindow(120));
  const [measuring, setMeasuring] = useState(false);
  const [latestReport, setLatestReport] = useState<string | null>(null);
  const capture = useRef<{
    session: NativeMeasurementSession;
    timerStart: NativeResidentTimerSnapshot;
    environment: { platform: string; label: string; residents: number; terrainCells?: number };
  } | null>(null);

  const startMeasurement = useCallback(() => {
    setLatestReport(null);
    capture.current = {
      session: new NativeMeasurementSession(performance.now()),
      timerStart: getNativeResidentTimerSnapshot(),
      environment: { platform: Platform.OS, label, residents, terrainCells }
    };
    setMeasuring(true);
  }, [label, residents, terrainCells]);

  useFocusEffect(useCallback(() => {
    setStats(INITIAL_METRICS);
    setResidentCallbacks(0);
    setResidentRenders(0);
    setResidentBusCycles(0);
    setTimerMetrics({ pending: 0, platformWakeupsPerSecond: 0, logicalCallbacksPerSecond: 0, scheduled: false });
    lastTimerSample.current = { timestamp: performance.now(), counters: getNativeResidentTimerSnapshot() };
    takeNativeResidentBusCycles();
    takeNativeResidentFrameCallbacks();
    takeNativeResidentRenderInvocations();
    frameWindow.current.reset();
    capture.current = null;
    setMeasuring(false);
    let raf = 0;
    let previous: number | null = null;
    let lastPublished = 0;
    const onStateChange = AppState.addEventListener("change", () => {
      previous = null;
      frameWindow.current.reset();
      lastTimerSample.current = null;
      // Pausing/rotating the app invalidates a timed measurement.
      capture.current = null;
      setMeasuring(false);
    });
    const onFrame = (timestamp: number) => {
      if (AppState.currentState === "active") {
        if (previous != null) {
          const delta = timestamp - previous;
          frameWindow.current.record(delta);
          const active = capture.current;
          if (active) {
            const complete = active.session.record(timestamp, delta);
            if (complete) {
              capture.current = null;
              setMeasuring(false);
              const delta = diffNativeResidentTimerCounters(
                active.timerStart, getNativeResidentTimerSnapshot(), complete.durationMs
              );
              setLatestReport(formatNativeMeasurement(complete, active.environment, delta));
            }
          }
        }
        previous = timestamp;
        if (timestamp - lastPublished >= 1000) {
          setStats(frameWindow.current.snapshot());
          setResidentCallbacks(takeNativeResidentFrameCallbacks());
          setResidentRenders(takeNativeResidentRenderInvocations());
          setResidentBusCycles(takeNativeResidentBusCycles());
          const next = getNativeResidentTimerSnapshot();
          const prev = lastTimerSample.current;
          const interval = prev ? timestamp - prev.timestamp : 0;
          const rates = prev ? diffNativeResidentTimerCounters(prev.counters, next, interval) : null;
          setTimerMetrics({
            pending: next.pending,
            scheduled: next.scheduled,
            platformWakeupsPerSecond: rates?.platformWakeupsPerSecond ?? 0,
            logicalCallbacksPerSecond: rates?.logicalCallbacksPerSecond ?? 0
          });
          lastTimerSample.current = { timestamp, counters: next };
          lastPublished = timestamp;
        }
      } else {
        previous = null;
      }
      raf = requestAnimationFrame(onFrame);
    };
    raf = requestAnimationFrame(onFrame);
    return () => {
      cancelAnimationFrame(raf);
      capture.current = null;
      onStateChange.remove();
    };
  }, []));

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityLabel="Mostra o nascondi diagnostica prestazioni native" onPress={() => setExpanded((was) => !was)} style={styles.toggle}>
        <Text style={styles.title}>JS {stats.samples ? stats.jsFps.toFixed(0) : "—"} FPS · {expanded ? "Chiudi" : "Dettagli"}</Text>
      </Pressable>
      {expanded && (
        <View style={styles.panel}>
          <Text style={styles.text}>{label} · {residents} elementi</Text>
          {terrainCells != null && <Text style={styles.text}>Celle terreno visibili: {terrainCells}</Text>}
          <Text style={styles.text}>Media frame JS: {stats.samples ? stats.meanFrameMs.toFixed(1) : "—"} ms</Text>
          <Text style={styles.text}>p95 frame JS: {stats.samples ? stats.p95FrameMs.toFixed(1) : "—"} ms</Text>
          <Text style={styles.text}>Frame oltre 33/50 ms: {stats.framesOver33Ms}/{stats.framesOver50Ms}</Text>
          <Text style={styles.text}>Callback animazione abitanti/s: {residentCallbacks}</Text>
          <Text style={styles.text}>Render React abitanti/s: {residentRenders}</Text>
          <Text style={styles.text}>Frame bus nativo/s: {residentBusCycles}</Text>
          <Text style={styles.text}>Timer residenti in attesa: {timerMetrics.pending}</Text>
          <Text style={styles.text}>Timeout nativi attivi: {timerMetrics.scheduled ? 1 : 0}</Text>
          <Text style={styles.text}>Wakeup timer nativo/s: {timerMetrics.platformWakeupsPerSecond.toFixed(1)}</Text>
          <Text style={styles.text}>Callback timer residenti/s: {timerMetrics.logicalCallbacksPerSecond.toFixed(1)}</Text>
          <Text style={styles.note}>Timer e callback/s misurano soltanto attività JS e timer gestiti dalla mappa, non FPS UI/GPU. Solo ritmo JS, non GPU; nessun dato salvato.</Text>
          <Pressable
            style={[styles.testButton, measuring && styles.disabledButton]}
            disabled={measuring}
            accessibilityRole="button"
            onPress={startMeasurement}
          >
            <Text style={styles.buttonText}>{measuring ? "Campionamento in corso (10 s)" : "Misura 10 secondi"}</Text>
          </Pressable>
          {latestReport && (
            <>
              <Text style={styles.text}>{latestReport.split("\n").filter((line) => /FPS JS medio:|p95:|Campioni:/.test(line)).join(" · ")}</Text>
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
