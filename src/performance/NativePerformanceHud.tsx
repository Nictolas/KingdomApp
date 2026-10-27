import React, { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { NativeFrameWindow, type NativeFrameSnapshot } from "./nativeFrameMetrics";

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
  const frameWindow = useRef(new NativeFrameWindow(120));

  useFocusEffect(useCallback(() => {
    setStats(INITIAL_METRICS);
    frameWindow.current.reset();
    let raf = 0;
    let previous: number | null = null;
    let lastPublished = 0;
    const onStateChange = AppState.addEventListener("change", () => {
      previous = null;
      frameWindow.current.reset();
    });
    const onFrame = (timestamp: number) => {
      if (AppState.currentState === "active") {
        if (previous != null) frameWindow.current.record(timestamp - previous);
        previous = timestamp;
        if (timestamp - lastPublished >= 1000) {
          setStats(frameWindow.current.snapshot());
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
          <Text style={styles.note}>Solo ritmo JS, non FPS GPU; nessun dato salvato.</Text>
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
  buttonText: { color: "#ffffff", fontWeight: "700", fontSize: 11, textAlign: "center" }
});
