import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getEmojiRazza } from "../src/kingdomData";
import type { Abitante } from "../src/types";

export default function NativiScreen() {
  const router = useRouter();
  const { abitanti, razzaNativi } = useGameContext();

  const nativi = abitanti.filter((a: Abitante) => a.fazioni?.includes("Nativi"));
  const emojiRazza = getEmojiRazza(razzaNativi);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Fazioni
        </Text>
        <Text style={styles.title}>🌿 Nativi</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Popolazione nativa del pianeta, integrata o in tensione con la colonia. A inizio partita viene scelta una razza non umana: tutti i Nativi di quella partita appartengono a quella razza.
        </Text>

        <View style={[styles.infoCard, styles.razzaCard]}>
          <Text style={styles.razzaLabel}>Razza dei Nativi in questa partita</Text>
          <Text style={styles.razzaValue}>
            {emojiRazza} {razzaNativi}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nativi ({nativi.length})</Text>
          {nativi.length > 0 ? (
            <View style={styles.grid}>
              {nativi.map((a: Abitante) => {
                const razza = a.razza ?? razzaNativi;
                const emoji = getEmojiRazza(razza);
                return (
                  <View key={a.id} style={styles.card}>
                    <Text style={styles.emoji}>{emoji}</Text>
                    <Text style={styles.cardTitle}>{a.nome}</Text>
                    <Text style={styles.cardLavoro}>{a.lavoro}</Text>
                    <Text style={styles.cardRazza}>
                      Razza: {razza}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>Nessun nativo in colonia</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050816" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)"
  },
  back: { color: "#93c5fd", fontSize: 12 },
  title: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  content: { paddingHorizontal: 12, paddingVertical: 6, paddingBottom: 8, flex: 1 },
  subtitle: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 12
  },
  infoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 14
  },
  razzaCard: {
    borderColor: "rgba(34,197,94,0.5)",
    backgroundColor: "rgba(34,197,94,0.08)"
  },
  razzaLabel: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 10,
    marginBottom: 4
  },
  razzaValue: {
    color: "#22c55e",
    fontSize: 14,
    fontWeight: "700"
  },
  section: { marginBottom: 14 },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    width: "48%",
    minWidth: 140,
    alignItems: "center"
  },
  emoji: { fontSize: 32, marginBottom: 4 },
  cardTitle: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginBottom: 2, textAlign: "center" },
  cardLavoro: { color: "#93c5fd", fontSize: 9, marginBottom: 4, textAlign: "center" },
  cardRazza: { color: "rgba(203,213,245,0.7)", fontSize: 9, textAlign: "center" },
  emptyText: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 10,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12
  }
});
