import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import type { Abitante, Reato } from "../src/types";

const REATI: { reato: Reato; emoji: string; descrizione: string }[] = [
  { reato: "Omicidio", emoji: "🔪", descrizione: "Uccisione intenzionale di un abitante." },
  { reato: "Stupro", emoji: "⛔", descrizione: "Violenza sessuale. Crimine gravissimo." },
  { reato: "Furto", emoji: "🧤", descrizione: "Sottrazione di beni o crediti senza consenso." },
  { reato: "Spaccio", emoji: "💊", descrizione: "Vendita illegale di sostanze stupefacenti." },
  { reato: "Evasione", emoji: "🏃", descrizione: "Fuga o elusione di custodia/sanzioni." }
];

export default function CrimineScreen() {
  const router = useRouter();
  const { abitanti } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const criminali = abitanti.filter((a: Abitante) => (a.reati?.length ?? 0) > 0);

  const countPerReato = (reato: Reato) =>
    criminali.filter((a) => (a.reati ?? []).includes(reato)).length;

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🕵️ Crimine</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Reati presenti nel regno (criminali totali: {criminali.length}).
        </Text>

        <View style={styles.grid}>
          {REATI.map((r) => (
            <View key={r.reato} style={styles.card}>
              <Text style={styles.emoji}>{r.emoji}</Text>
              <Text style={styles.cardTitle}>{r.reato}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {r.descrizione}
              </Text>
              <Text style={styles.chip}>
                Segnalazioni: <Text style={styles.chipValue}>{countPerReato(r.reato)}</Text>
              </Text>
            </View>
          ))}
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
  subtitle: { color: "rgba(203,213,245,0.7)", fontSize: 10, lineHeight: 14, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    width: "48%",
    minWidth: 140
  },
  emoji: { fontSize: 24, marginBottom: 6 },
  cardTitle: { color: "#e5e7eb", fontSize: 12, fontWeight: "700", marginBottom: 2 },
  cardDesc: { color: "rgba(203,213,245,0.7)", fontSize: 10, lineHeight: 14 },
  chip: { marginTop: 6, color: "rgba(203,213,245,0.7)", fontSize: 10 },
  chipValue: { color: "#ffffff", fontWeight: "700" }
});

