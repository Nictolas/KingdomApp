import React, { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { canRenderCharacter } from "../character-system/registry";
import { aspettoPerVisualizzazioneAbitante } from "../game/personaggioAspetto";
import type { Abitante } from "../types";
import { CircularSpriteFrame } from "./CircularSpriteFrame";

/** Ritratto statico, costruito dagli stessi layer LPC usati sulla mappa.
 * Renderizza solo l'abitante selezionato: nessun canvas, asset o timer nuovo.
 */
export const ResidentPortrait = memo(function ResidentPortrait({
  abitante,
  nudismoAttivo = false
}: {
  abitante: Abitante;
  nudismoAttivo?: boolean;
}) {
  const appearance = useMemo(
    () => aspettoPerVisualizzazioneAbitante(abitante, { nudismoAttivo })?.characterAppearance,
    [abitante.id, abitante.razza, abitante.aspetto, abitante.lavoro, abitante.incinta, abitante.sesso, nudismoAttivo]
  );

  const canShowPortrait = appearance != null && canRenderCharacter(appearance, "idle");

  return (
    <View
      style={styles.wrap}
      accessibilityRole="image"
      accessibilityLabel={`Ritratto di ${abitante.nome}`}
    >
      {canShowPortrait && appearance ? (
        <CircularSpriteFrame
          appearance={appearance}
          animation="idle"
          direction="down"
          animate={false}
          faceOnly
          size={48}
        />
      ) : (
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>
            {abitante.razza === "Golem" ? "🗿" : "👤"}
          </Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    width: 76,
    height: 76,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(30,41,59,0.92)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    overflow: "hidden"
  },
  fallback: {
    width: 70,
    height: 70,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.8)"
  },
  fallbackText: { fontSize: 32 }
});
