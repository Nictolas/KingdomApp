import React from "react";
import { Dimensions, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

const VOCI: { emoji: string; label: string; route: string }[] = [
  { emoji: "🎲", label: "Generazione Partita", route: "/generazione-partita" },
  { emoji: "⏭️", label: "Regole Skip", route: "/regole-skip" }
];

export default function RegoleScreen() {
  const router = useRouter();
  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>📋 Regole</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={[styles.content, isDesktop && styles.contentDesktop]}>
        <Text style={styles.intro}>
          Consulta le regole di generazione della partita e tutto ciò che succede quando skippi il mese.
        </Text>
        {VOCI.map((v) => (
          <Pressable
            key={v.route}
            style={[styles.card, isDesktop && styles.cardDesktop]}
            onPress={() => router.push(v.route)}
          >
            <Text style={styles.cardEmoji}>{v.emoji}</Text>
            <Text style={styles.cardLabel}>{v.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#050816"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)"
  },
  back: {
    color: "#93c5fd",
    fontSize: 12
  },
  title: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700"
  },
  content: {
    padding: 20,
    paddingBottom: 32
  },
  contentDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16
  },
  intro: {
    color: "rgba(203,213,245,0.9)",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 20,
    width: "100%"
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    minWidth: 260
  },
  cardDesktop: {
    width: "48%",
    minWidth: 280,
    maxWidth: 400,
    marginBottom: 0
  },
  cardEmoji: {
    fontSize: 28,
    marginRight: 14
  },
  cardLabel: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "700"
  }
});
