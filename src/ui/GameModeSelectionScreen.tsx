import React from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { GAME_MODE_OPTIONS, type GameMode } from "../game/gameMode";

type Props = {
  onSelect: (mode: GameMode) => void;
  canGoBack?: boolean;
  onBack?: () => void;
  error?: string | null;
};

export function GameModeSelectionScreen({ onSelect, canGoBack = false, onBack, error }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>NUOVA PARTITA</Text>
        <Text style={styles.title}>Scegli la modalità</Text>
        <Text style={styles.subtitle}>La modalità scelta resterà associata a questo salvataggio.</Text>

        <View style={styles.options}>
          {GAME_MODE_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
              onPress={() => onSelect(option.id)}
            >
              <Text style={styles.optionTitle}>{option.label}</Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </Pressable>
          ))}
        </View>

        {canGoBack && onBack ? (
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backText}>← Indietro</Text>
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
    justifyContent: "center",
    padding: 20
  },
  card: {
    width: "92%",
    maxWidth: 620,
    padding: 28,
    gap: 14,
    borderRadius: 18,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)"
  },
  eyebrow: {
    color: "#60a5fa",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textAlign: "center"
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center"
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 6
  },
  options: {
    gap: 12
  },
  option: {
    padding: 20,
    borderRadius: 14,
    backgroundColor: "#172033",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.32)"
  },
  optionPressed: {
    borderColor: "#60a5fa",
    backgroundColor: "#1e3a5f"
  },
  optionTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 6
  },
  optionDescription: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 19
  },
  backButton: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 2
  },
  backText: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "700"
  },
  error: {
    color: "#fca5a5",
    textAlign: "center",
    marginTop: 4
  }
});
