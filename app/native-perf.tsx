import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { Animated, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { NativePerformanceHud } from "../src/performance/NativePerformanceHud";
import {
  NATIVE_TEST_POPULATIONS,
  createNativeSyntheticMarkers,
  type NativeSyntheticMarker,
  type NativeTestPopulation
} from "../src/performance/nativePopulationFixture";

/**
 * Developer-only, isolated RN view workload.
 * Does not create GameContext citizens, modify paths, simulate AI, or save data.
 */
export default function NativePerformanceScreen() {
  if (!__DEV__ || Platform.OS === "web") return <Redirect href="/" />;
  return <NativePerformanceScene />;
}

const ResidentDot = memo(function ResidentDot({
  marker,
  progress,
  animated,
  width,
  height
}: {
  marker: NativeSyntheticMarker;
  progress: Animated.Value;
  animated: boolean;
  width: number;
  height: number;
}) {
  const shift = progress.interpolate({ inputRange: [0, 1], outputRange: [0, marker.direction * 6] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.dot,
        {
          left: (marker.col + 0.45) * width / 20,
          top: (marker.row + 0.45) * height / 10,
          transform: [{ translateX: animated ? shift : 0 }]
        }
      ]}
    />
  );
});

const gridCells = Array.from({ length: 200 }, (_, index) => index);

function NativePerformanceScene() {
  const router = useRouter();
  const [population, setPopulation] = useState<NativeTestPopulation>(25);
  const [isMoving, setIsMoving] = useState(true);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const phase = useRef(new Animated.Value(0)).current;
  const residents = useMemo(() => createNativeSyntheticMarkers(population), [population]);

  useEffect(() => {
    if (!isMoving) {
      phase.stopAnimation();
      phase.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, { toValue: 1, duration: 850, useNativeDriver: true, isInteraction: false }),
        Animated.timing(phase, { toValue: 0, duration: 850, useNativeDriver: true, isInteraction: false })
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [phase, isMoving]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.whiteText}>Indietro</Text>
        </Pressable>
        <View style={styles.heading}>
          <Text style={styles.headingTitle}>Diagnostica native</Text>
          <Text style={styles.subtitle}>Solo sviluppo · nessun salvataggio</Text>
        </View>
      </View>
      <View style={styles.controls}>
        {NATIVE_TEST_POPULATIONS.map((count) => (
          <Pressable key={count} accessibilityRole="button" accessibilityState={{ selected: population === count }} style={[styles.option, population === count && styles.selected]} onPress={() => setPopulation(count)}>
            <Text style={styles.whiteText}>{count}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" style={[styles.option, styles.moveOption]} onPress={() => setIsMoving((v) => !v)}>
          <Text style={styles.whiteText}>{isMoving ? "Ferma" : "Muovi"}</Text>
        </Pressable>
      </View>
      <View
        style={styles.world}
        onLayout={(event) => {
          const next = event.nativeEvent.layout;
          setSize((prev) => prev.width === next.width && prev.height === next.height
            ? prev : { width: next.width, height: next.height });
        }}
      >
        {gridCells.map((index) => (
          <View key={index} pointerEvents="none" style={[styles.tile, { left: (index % 20) * size.width / 20, top: Math.floor(index / 20) * size.height / 10, width: size.width / 20, height: size.height / 10 }]} />
        ))}
        {residents.map((marker) => (
          <ResidentDot key={marker.id} marker={marker} progress={phase} animated={isMoving} width={size.width} height={size.height} />
        ))}
        <NativePerformanceHud residents={residents.length} terrainCells={gridCells.length} label={isMoving ? "Marker animati" : "Marker fermi"} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Carico sintetico React Native: {residents.length} marker semplici su 200 celle.</Text>
        <Text style={styles.footerText}>Non misura IA, percorsi, collisioni, asset LPC o prestazioni GPU. Per GPU/UI thread usare il profiler di sistema sul dispositivo.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b1220" },
  header: { flexDirection: "row", padding: 12, alignItems: "center", gap: 12 },
  heading: { flex: 1 },
  headingTitle: { color: "#ffffff", fontSize: 17, fontWeight: "700" },
  subtitle: { color: "#94a3b8", fontSize: 11 },
  backButton: { backgroundColor: "#334155", paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8 },
  controls: { flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingBottom: 10 },
  option: { flex: 1, backgroundColor: "#334155", paddingVertical: 12, alignItems: "center", borderRadius: 7 },
  selected: { backgroundColor: "#1d4ed8" },
  moveOption: { backgroundColor: "#155e75", flex: 1.5 },
  whiteText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  world: { flex: 1, overflow: "hidden", backgroundColor: "#4e634a", marginHorizontal: 8, position: "relative", borderWidth: 1, borderColor: "#64748b" },
  tile: { position: "absolute", borderColor: "#7e9876", borderWidth: 0.5, backgroundColor: "rgba(30,75,46,0.18)" },
  dot: { position: "absolute", width: 11, height: 12, borderRadius: 4, backgroundColor: "#f7b267", borderColor: "#623e32", borderWidth: 1 },
  footer: { paddingHorizontal: 14, paddingVertical: 12, gap: 5 },
  footerText: { color: "#cbd5e1", fontSize: 11, lineHeight: 15 }
});
