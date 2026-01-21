import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatGameTime } from "../hooks/useGameClock";

type TopHudProps = {
  gameTime: { hours: number; minutes: number };
  buildMode: "light" | "bridge" | null;
  onClockPress: () => void;
  onReset: () => void;
  onBuildPress: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
};

const formatGameTime = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

export function TopHud({ gameTime, buildMode, onClockPress, onReset, onBuildPress, onZoomOut, onZoomIn }: TopHudProps) {
  return (
    <View style={styles.topHud}>
      <Pressable style={styles.clockContainer} onPress={onClockPress}>
        <Text style={styles.clockText}>🕐 {formatGameTime(gameTime.hours, gameTime.minutes)}</Text>
      </Pressable>
      <View style={styles.topHudButtons}>
        <Pressable style={styles.btn} onPress={onReset}>
          <Text style={styles.btnText}>↻ Reset</Text>
        </Pressable>
        <Pressable style={[styles.btn, buildMode !== null && styles.btnActive]} onPress={onBuildPress}>
          <Text style={styles.btnText}>💡 Costruisci</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={onZoomOut}>
          <Text style={styles.btnText}>− Zoom</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={onZoomIn}>
          <Text style={styles.btnText}>＋ Zoom</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topHud: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    zIndex: 1000,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10
  },
  clockContainer: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)"
  },
  topHudButtons: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  clockText: { color: "#ffffff", fontSize: 16, fontWeight: "700", fontFamily: "monospace" },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)"
  },
  btnActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderColor: "rgba(255,255,255,0.4)"
  },
  btnText: { color: "white", fontWeight: "700" }
});
