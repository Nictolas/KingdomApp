import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { aspettoPerVisualizzazioneAbitante } from "../game/personaggioAspetto";
import { lpcSpriteCircleDiameter } from "../character-system/lpcPack";
import { canRenderCharacter } from "../character-system/registry";
import { getEmojiRazza } from "../data/regniData";
import type { Abitante } from "../types";
import { CircularSpriteFrame } from "./CircularSpriteFrame";

const DEFAULT_SIZE = 40;
const DEFAULT_LIFT = 6;

export function AbitanteAvatarPreview({
  abitante,
  size = DEFAULT_SIZE,
  liftPx = DEFAULT_LIFT,
  grayscale = false,
  faceOnly = false
}: {
  abitante: Abitante;
  size?: number;
  liftPx?: number;
  /** Bianco e nero (es. genitori deceduti del Re). */
  grayscale?: boolean;
  /** Ritaglio sul volto (intro dialog, ritratti). */
  faceOnly?: boolean;
}) {
  const frame = lpcSpriteCircleDiameter(size) + 8;
  const aspetto = aspettoPerVisualizzazioneAbitante(abitante);
  const grayStyle = grayscale ? ({ filter: "grayscale(1)" } as const) : undefined;

  if (aspetto?.characterAppearance && abitante.razza !== "Golem" && canRenderCharacter(aspetto.characterAppearance, "idle")) {
    return (
      <View style={[styles.wrap, { width: frame, height: frame }, grayStyle]}>
        <CircularSpriteFrame
          appearance={aspetto.characterAppearance}
          size={size}
          animate={false}
          liftPx={liftPx}
          faceOnly={faceOnly}
        />
      </View>
    );
  }

  return (
    <View style={[styles.fallback, { width: frame, height: frame, borderRadius: frame / 2 }, grayStyle]}>
      <Text style={styles.fallbackText}>{getEmojiRazza(abitante.razza ?? "Umano")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 2
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30,41,59,0.9)",
    marginBottom: 2
  },
  fallbackText: { fontSize: 18 }
});
