import React from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import type { GameMode } from "../game/gameMode";

type Props = {
  error: string | null;
  canCancel: boolean;
  onSelect: (mode: GameMode) => void;
  onTryTerritories: () => void;
  onCancel: () => void;
};

export function GameModeSelectionScreen({ error, canCancel, onSelect, onCancel, onTryTerritories }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.title}>Scegli la modalità</Text>
        <Text style={styles.subtitle}>Come vuoi iniziare la nuova partita?</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Avventura"
          style={[styles.modeButton, styles.adventureButton]}
          onPress={() => onSelect("avventura")}
        >
          <Text style={styles.modeTitle}>⚔️ Avventura</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Creativa"
          style={[styles.modeButton, styles.creativeButton]}
          onPress={() => onSelect("creativa")}
        >
          <Text style={styles.modeTitle}>✨ Creativa</Text>
        </Pressable>

        <Pressable testID="choose-territory-world" accessibilityRole="button"
          accessibilityLabel="Regno a territori, nuova modalità espandibile 32 per 32"
          style={[styles.modeButton,styles.territoryButton]} onPress={onTryTerritories}>
          <Text style={styles.modeTitle}>Regno a territori · 32×32</Text>
          <Text style={styles.modeDescription}>Mondo casuale espandibile: acquista, conquista, costruisci liberamente.</Text>
        </Pressable>

        {canCancel ? (
          <Pressable style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>Indietro</Text>
          </Pressable>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#050816",
    alignItems: "center",
    justifyContent: "center"
  },
  card: {
    width: "88%",
    maxWidth: 460,
    padding: 28,
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)"
  },
  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center"
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8
  },
  modeButton: {
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1
  },
  adventureButton: {
    backgroundColor: "rgba(37,99,235,0.22)",
    borderColor: "rgba(96,165,250,0.7)"
  },
  modeDescription: {
    color: "#d1fae5",
    textAlign: "center",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 5
  },
  territoryButton: {backgroundColor:"rgba(157,112,48,0.30)",borderColor:"rgba(235,201,126,0.8)"},
  creativeButton: {
    backgroundColor: "rgba(124,58,237,0.22)",
    borderColor: "rgba(167,139,250,0.7)"
  },
  modeTitle: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center"
  },
  cancelButton: {
    marginTop: 4,
    paddingVertical: 10
  },
  cancelText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center"
  },
  error: {
    color: "#fca5a5",
    textAlign: "center",
    marginTop: 4
  }
});
