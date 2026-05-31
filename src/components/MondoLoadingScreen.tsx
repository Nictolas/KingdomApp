import React, { memo } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";

type Props = {
  progress: number;
  label: string;
};

/** Schermata a tutto schermo durante la prima generazione procedurale del mondo. */
export const MondoLoadingScreen = memo(function MondoLoadingScreen({ progress, label }: Props) {
  const pct = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <View style={styles.root} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
      <View style={styles.card}>
        <View style={styles.accentLine} />
        <Text style={styles.emoji}>🌍</Text>
        <Text style={styles.title}>Creazione del mondo</Text>
        <Text style={styles.subtitle}>MyKingdom sta preparando la tua colonia…</Text>

        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.percent}>{pct}%</Text>
        <Text style={styles.label}>{label}</Text>

        <ActivityIndicator size="small" color="#93c5fd" style={styles.spinner} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020617",
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#0f172a",
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    alignItems: "center",
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0 8px 32px rgba(0,0,0,0.45)"
        }
      : {
          elevation: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.45,
          shadowRadius: 16
        })
  },
  accentLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#3b82f6"
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12
  },
  title: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center"
  },
  subtitle: {
    color: "rgba(203, 213, 245, 0.75)",
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 28
  },
  barTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(30, 41, 59, 0.9)",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148, 163, 184, 0.2)"
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#3b82f6"
  },
  percent: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 10
  },
  label: {
    color: "rgba(226, 232, 240, 0.85)",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    minHeight: 20
  },
  spinner: {
    marginTop: 20
  }
});
