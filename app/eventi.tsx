import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

export default function EventiScreen() {
  const router = useRouter();
  const { eventiInCorso, eventiCatalogo } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const idsInCorso = new Set(eventiInCorso.map((e) => e.id));
  const inCorso = eventiCatalogo.filter((e) => idsInCorso.has(e.id));
  const possibili = eventiCatalogo.filter((e) => !idsInCorso.has(e.id));

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>📌 Eventi</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Eventi possibili o in corso nella colonia. Qui trovi il catalogo degli eventi che possono verificarsi o che sono attivi.
        </Text>

        {inCorso.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>In corso ({inCorso.length})</Text>
            <View style={styles.grid}>
              {inCorso.map((e) => (
                <View key={e.id} style={[styles.card, styles.cardInCorso]}>
                  <Text style={styles.emoji}>{e.emoji}</Text>
                  <View style={styles.badgeInCorso}>
                    <Text style={styles.badgeText}>In corso</Text>
                  </View>
                  <Text style={styles.cardTitle}>{e.nome}</Text>
                  <Text style={styles.cardDesc} numberOfLines={3}>
                    {e.descrizione}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Possibili ({possibili.length})</Text>
          <View style={styles.grid}>
            {possibili.map((e) => (
              <View key={e.id} style={styles.card}>
                <Text style={styles.emoji}>{e.emoji}</Text>
                <View style={styles.badgePossibile}>
                  <Text style={styles.badgeText}>Possibile</Text>
                </View>
                <Text style={styles.cardTitle}>{e.nome}</Text>
                <Text style={styles.cardDesc} numberOfLines={3}>
                  {e.descrizione}
                </Text>
              </View>
            ))}
          </View>
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
  cardInCorso: {
    borderColor: "#f59e0b",
    backgroundColor: "rgba(245,158,11,0.08)"
  },
  emoji: { fontSize: 26, marginBottom: 4 },
  badgePossibile: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(148,163,184,0.25)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4
  },
  badgeInCorso: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(245,158,11,0.3)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4
  },
  badgeText: { color: "#e5e7eb", fontSize: 9, fontWeight: "700" },
  cardTitle: { color: "#e5e7eb", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  cardDesc: { color: "rgba(203,213,245,0.7)", fontSize: 10, lineHeight: 14 }
});
