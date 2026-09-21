import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { regniData } from "../src/kingdomData";
import { useGameContext } from "../src/context/GameContext";

export default function RegniScreen() {
  const router = useRouter();
  const { abitanti } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const conteggioPerRazza = regniData.map((regno) => ({
    ...regno,
    count: abitanti.filter((a) => (a.razza ?? "Umano") === regno.razza).length
  }));

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🏰 Regni e popoli</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Terre d'origine dei popoli che abitano il regno e ne attraversano le frontiere.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Regni ({regniData.length})</Text>
          <View style={styles.grid}>
            {conteggioPerRazza.map((regno) => (
              <View key={regno.id} style={styles.card}>
                <Text style={styles.emoji}>{regno.emoji}</Text>
                <Text style={styles.cardTitle}>{regno.nome}</Text>
                <Text style={styles.cardDesc}>
                  Razza: {regno.razza} · Nel regno: {regno.count} abitanti
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.note}>
          <Text style={styles.noteText}>
            Umani, Elfi, Nani, Orchi, Goblin e Golem possono vivere nel regno o arrivare come viandanti e immigrati.
          </Text>
        </View>
      </ScrollView>
    </View>
    <View style={styles.footer}>
      <Text style={styles.back} onPress={() => router.back()}>← Home</Text>
    </View>
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
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.6)"
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
  section: { marginBottom: 14 },
  sectionTitle: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    width: "48%",
    minWidth: 160
  },
  emoji: { fontSize: 26, marginBottom: 4 },
  cardTitle: { color: "#e5e7eb", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  cardDesc: { color: "rgba(203,213,245,0.7)", fontSize: 10, lineHeight: 14 },
  note: {
    backgroundColor: "rgba(148,163,184,0.1)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  noteText: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 10,
    lineHeight: 14,
    fontStyle: "italic"
  }
});
