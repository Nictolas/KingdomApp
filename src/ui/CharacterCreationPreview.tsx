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
  size = 128,
  compact = false
}: {
  appearance: CharacterAppearance;
  size?: number;
  compact?: boolean;
}) {
  const [direction, setDirection] = useState<CharacterDirection>("down");
  const animation: CharacterAnimationId = canRenderCharacter(appearance, "walk") ? "walk" : "idle";

  const rotate = (delta: -1 | 1) => {
    const index = DIRECTIONS.indexOf(direction);
    setDirection(DIRECTIONS[(index + delta + DIRECTIONS.length) % DIRECTIONS.length]!);
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]} accessibilityLabel="Anteprima personaggio animata">
      <CircularSpriteFrame appearance={appearance} size={size} animation={animation} direction={direction} animate />
      <Text style={styles.hint}>{animation === "walk" ? "Cammina sul posto" : "Anteprima statica"}</Text>
      <View style={[styles.controls, compact && styles.controlsCompact]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ruota a sinistra"
          style={styles.rotateBtn}
          onPress={() => rotate(-1)}
        >
          <Text style={styles.rotateBtnText}>↺</Text>
        </Pressable>
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
  wrapCompact: { gap: 4 },
  hint: { color: "#93c5fd", fontSize: 11, fontWeight: "700" },
  controls: { flexDirection: "row", alignItems: "center", gap: 18 },
  controlsCompact: { gap: 24 },
  rotateBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    backgroundColor: "rgba(30, 41, 59, 0.72)"
  },
  rotateBtnText: { color: "#e2e8f0", fontSize: 18, fontWeight: "800" },
  dirLabel: { color: "#f3ddb0", fontSize: 12, fontWeight: "800" }
});
