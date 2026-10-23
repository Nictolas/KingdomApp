import React from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { generaAspettoDaSeed } from "../src/game/personaggioAspetto";
import { SCHEDE_RAZZE } from "../src/game/razzeNavigazione";
import { CircularSpriteFrame } from "../src/ui/CircularSpriteFrame";

export default function RazzeScreen() {
  const router = useRouter();
  const { abitanti } = useGameContext();
  const { width } = useWindowDimensions();
  const maxWidth = Math.max(0, Math.min(width, 960) - 32);
  const columns = width < 480 ? 2 : 3;
  const cardWidth = Math.max(0, (maxWidth - 10 * (columns - 1)) / columns);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>🧬 Razze</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Composizione razziale degli abitanti del regno. Seleziona una razza per vedere tutti i suoi abitanti.</Text>
        <View style={styles.grid}>
          {SCHEDE_RAZZE.map((item) => {
            const count = abitanti.filter((abitante) => (abitante.razza ?? "Umano") === item.razza).length;
            const aspetto = item.previewSeed != null
              ? generaAspettoDaSeed(item.razza === "Golem" ? "Umano" : item.razza, item.previewSeed)
              : null;
            return (
              <Pressable
                key={item.slug}
                testID={`razza-${item.slug}`}
                accessibilityRole="button"
                accessibilityLabel={`Visualizza gli abitanti ${item.titolo.toLowerCase()}: ${count}`}
                onPress={() => router.push(`/razze/${item.slug}`)}
                style={({ pressed }) => [styles.card, { width: cardWidth }, pressed && styles.pressed]}
              >
                {aspetto?.characterAppearance ? (
                  <View style={styles.avatarWrap}>
                    <CircularSpriteFrame appearance={aspetto.characterAppearance} size={52} animate={false} />
                  </View>
                ) : (
                  <Text style={styles.emoji}>{item.emoji}</Text>
                )}
                <Text style={styles.race}>{item.razza}</Text>
                <Text style={styles.count}>{count} {count === 1 ? "abitante" : "abitanti"}</Text>
                <Text style={styles.open}>Vedi abitanti ›</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <Pressable style={styles.footer} accessibilityRole="button" onPress={() => router.back()}>
        <Text style={styles.back}>← Menu</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050816" },
  header: {
    alignItems: "center", padding: 14, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)"
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  content: { width: "100%", maxWidth: 960, alignSelf: "center", padding: 16, paddingBottom: 28 },
  subtitle: { color: "rgba(203,213,245,0.85)", fontSize: 12, marginBottom: 12, lineHeight: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    alignItems: "center", paddingVertical: 14, paddingHorizontal: 8, borderRadius: 11,
    borderWidth: 1, borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "rgba(15,23,42,0.96)", minHeight: 148
  },
  pressed: { backgroundColor: "#223d68", borderColor: "#93c5fd" },
  avatarWrap: { marginBottom: 6, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 34, marginBottom: 6 },
  race: { color: "#f1f5f9", fontSize: 14, fontWeight: "800", textAlign: "center" },
  count: { color: "#93c5fd", fontSize: 11, marginTop: 6, fontWeight: "700" },
  open: { color: "#b9d8ff", fontSize: 10, marginTop: 7, fontWeight: "600" },
  footer: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(148,163,184,0.6)" },
  back: { color: "#93c5fd", fontSize: 12, fontWeight: "700" }
});
