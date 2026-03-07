import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

export default function LealtaScreen() {
  const router = useRouter();
  const { abitanti } = useGameContext();

  const abitantiConLealtà = abitanti.filter((a) => a.razza !== "Robot");
  const n = abitantiConLealtà.length;
  const lealtàMedia = n ? Math.round(abitantiConLealtà.reduce((s, a) => s + a.lealtà, 0) / n) : 0;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>❤️ Lealtà</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.mediaCard}>
          <Text style={styles.mediaLabel}>Lealtà media (colonia)</Text>
          <Text style={styles.mediaValue}>{lealtàMedia}%</Text>
          <Text style={styles.mediaSubtext}>
            Media della lealtà degli abitanti non Robot ({n} abitanti). Valore base 0–100, nessun modificatore applicato in tempo reale.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Modificatori di Lealtà (nel codice)</Text>
        <Text style={styles.sectionIntro}>
          La lealtà di ogni abitante è un valore 0–100. I seguenti modificatori sono presenti nel codice.
        </Text>

        <View style={styles.modCard}>
          <Text style={styles.modTitle}>1. Tribunale – Grazia criminale (useGameState → graziaCriminale)</Text>
          <View style={styles.modItem}>
            <Text style={styles.modBullet}>•</Text>
            <Text style={styles.modText}>Quando si concede la grazia a un criminale dal Tribunale: il <Text style={styles.modBold}>criminale</Text> e i suoi <Text style={styles.modBold}>amici</Text> +10% lealtà (arrotondata, max 100); i suoi <Text style={styles.modBold}>rivali</Text> -10% lealtà (arrotondata, min 0). I reati del criminale vengono azzerati.</Text>
          </View>
        </View>

        <View style={styles.modCard}>
          <Text style={styles.modTitle}>2. Valore base (types.ts / abitantiData)</Text>
          <View style={styles.modItem}>
            <Text style={styles.modBullet}>•</Text>
            <Text style={styles.modText}>La lealtà è memorizzata per ogni abitante come valore <Text style={styles.modBold}>0–100</Text>. Non esiste una funzione "lealtà modificata" come per la felicità: la media mostrata in Home e qui è la media dei valori base.</Text>
          </View>
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
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.6)"
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
    padding: 16,
    paddingBottom: 24
  },
  mediaCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    alignItems: "center"
  },
  mediaLabel: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  mediaValue: {
    color: "#4ade80",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4
  },
  mediaSubtext: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    textAlign: "center"
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8
  },
  sectionIntro: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 11,
    marginBottom: 16,
    lineHeight: 16
  },
  modCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  modTitle: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 10
  },
  modItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6
  },
  modBullet: {
    color: "#93c5fd",
    fontSize: 12,
    marginRight: 8
  },
  modText: {
    color: "#e5e7eb",
    fontSize: 11,
    flex: 1,
    lineHeight: 16
  },
  modBold: {
    fontWeight: "700",
    color: "#f1f5f9"
  }
});
