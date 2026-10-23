import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { generaAspettoDaSeed } from "../src/game/personaggioAspetto";
import { CircularSpriteFrame } from "../src/ui/CircularSpriteFrame";
import type { Razza } from "../src/types";

const RAZZE: readonly Razza[] = ["Umano", "Elfo", "Nano", "Orco", "Goblin", "Felix", "Golem"];

const EMOJI_RAZZA: Record<Razza, string> = {
  Umano: "🧑",
  Elfo: "🧝",
  Nano: "🧔",
  Orco: "👹",
  Goblin: "👺",
  Felix: "🐱",
  Golem: "🗿"
};

const PREVIEW_SEED: Record<Exclude<Razza, "Golem">, number> = {
  Umano: 42,
  Elfo: 84,
  Nano: 126,
  Orco: 168,
  Goblin: 210,
  Felix: 252
};

export default function RazzeScreen() {
  const router = useRouter();
  const { abitanti } = useGameContext();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>🧬 Razze</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Composizione razziale degli abitanti del regno.</Text>

        <View style={styles.grid}>
          {RAZZE.map((razza) => {
            const count = abitanti.filter((abitante) => (abitante.razza ?? "Umano") === razza).length;
            const aspetto = razza === "Golem" ? null : generaAspettoDaSeed(razza, PREVIEW_SEED[razza]);

            return (
              <View key={razza} style={styles.card}>
                {aspetto?.characterAppearance ? (
                  <View style={styles.avatarWrap}>
                    <CircularSpriteFrame
                      appearance={aspetto.characterAppearance}
                      size={52}
                      animate={false}
                    />
                  </View>
                ) : (
                  <Text style={styles.emoji}>{EMOJI_RAZZA[razza]}</Text>
                )}
                <Text style={styles.race}>{razza}</Text>
                <Text style={styles.count}>{count} abitanti</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>← Menu</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050816" },
  header: {
    alignItems: "center",
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)"
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  content: { width: "100%", maxWidth: 960, alignSelf: "center", padding: 16 },
  subtitle: { color: "rgba(203,213,245,0.78)", fontSize: 12, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    width: "31%",
    minWidth: 150,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "rgba(15,23,42,0.96)"
  },
  avatarWrap: { marginBottom: 6, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 34, marginBottom: 6 },
  race: { color: "#f1f5f9", fontSize: 14, fontWeight: "800", textAlign: "center" },
  count: { color: "#93c5fd", fontSize: 11, marginTop: 6, fontWeight: "700" },
  footer: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.6)"
  },
  back: { color: "#93c5fd", fontSize: 12 }
});
