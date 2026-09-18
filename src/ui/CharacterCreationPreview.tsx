import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { canRenderCharacter } from "../character-system/registry";
import type { CharacterAnimationId, CharacterAppearance, CharacterDirection } from "../character-system/types";
import { CircularSpriteFrame } from "./CircularSpriteFrame";

const DIRECTIONS: CharacterDirection[] = ["down", "left", "up", "right"];

const DIRECTION_LABELS: Record<CharacterDirection, string> = {
  down: "Fronte",
  left: "Sinistra",
  up: "Retro",
  right: "Destra"
};

export function CharacterCreationPreview({
  appearance,
  size = 128
}: {
  appearance: CharacterAppearance;
  size?: number;
}) {
  const [direction, setDirection] = useState<CharacterDirection>("down");
  const animation: CharacterAnimationId = canRenderCharacter(appearance, "walk") ? "walk" : "idle";

  const rotate = (delta: -1 | 1) => {
    const index = DIRECTIONS.indexOf(direction);
    setDirection(DIRECTIONS[(index + delta + DIRECTIONS.length) % DIRECTIONS.length]!);
  };

  return (
    <View style={styles.wrap} accessibilityLabel="Anteprima personaggio animata">
      <CircularSpriteFrame appearance={appearance} size={size} animation={animation} direction={direction} animate />
      <Text style={styles.hint}>{animation === "walk" ? "Cammina sul posto" : "Anteprima statica"}</Text>
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ruota a sinistra"
          style={styles.rotateBtn}
          onPress={() => rotate(-1)}
        >
          <Text style={styles.rotateBtnText}>↺</Text>
        </Pressable>
        <View style={styles.dpad}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Vista retro"
            style={[styles.dirBtn, direction === "up" && styles.dirBtnSelected]}
            onPress={() => setDirection("up")}
          >
            <Text style={[styles.dirBtnText, direction === "up" && styles.dirBtnTextSelected]}>↑</Text>
          </Pressable>
          <View style={styles.dpadRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Vista sinistra"
              style={[styles.dirBtn, direction === "left" && styles.dirBtnSelected]}
              onPress={() => setDirection("left")}
            >
              <Text style={[styles.dirBtnText, direction === "left" && styles.dirBtnTextSelected]}>←</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Vista fronte"
              style={[styles.dirBtn, direction === "down" && styles.dirBtnSelected]}
              onPress={() => setDirection("down")}
            >
              <Text style={[styles.dirBtnText, direction === "down" && styles.dirBtnTextSelected]}>↓</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Vista destra"
              style={[styles.dirBtn, direction === "right" && styles.dirBtnSelected]}
              onPress={() => setDirection("right")}
            >
              <Text style={[styles.dirBtnText, direction === "right" && styles.dirBtnTextSelected]}>→</Text>
            </Pressable>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ruota a destra"
          style={styles.rotateBtn}
          onPress={() => rotate(1)}
        >
          <Text style={styles.rotateBtnText}>↻</Text>
        </Pressable>
      </View>
      <Text style={styles.dirLabel}>{DIRECTION_LABELS[direction]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 8 },
  hint: { color: "#93c5fd", fontSize: 11, fontWeight: "700" },
  controls: { flexDirection: "row", alignItems: "center", gap: 10 },
  rotateBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    backgroundColor: "rgba(30, 41, 59, 0.72)"
  },
  rotateBtnText: { color: "#e2e8f0", fontSize: 18, fontWeight: "800" },
  dpad: { alignItems: "center", gap: 4 },
  dpadRow: { flexDirection: "row", gap: 4 },
  dirBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    backgroundColor: "rgba(30, 41, 59, 0.72)"
  },
  dirBtnSelected: {
    borderColor: "#60a5fa",
    backgroundColor: "rgba(59, 130, 246, 0.24)"
  },
  dirBtnText: { color: "rgba(203, 213, 245, 0.76)", fontSize: 16, fontWeight: "800" },
  dirBtnTextSelected: { color: "#eff6ff" },
  dirLabel: { color: "#f3ddb0", fontSize: 12, fontWeight: "800" }
});
