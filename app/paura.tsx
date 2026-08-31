import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

export default function PauraScreen() {
  const router = useRouter();
  const { abitanti } = useGameContext();

  const abitantiConPaura = abitanti.filter((a) => a.razza !== "Golem");
  const n = abitantiConPaura.length;
  const pauraMedia = n ? Math.round(abitantiConPaura.reduce((s, a) => s + a.paura, 0) / n) : 0;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>😨 Paura</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.mediaCard}>
          <Text style={styles.mediaLabel}>Paura media (colonia)</Text>
          <Text style={styles.mediaValue}>{pauraMedia}%</Text>
          <Text style={styles.mediaSubtext}>
            Media della paura degli abitanti non Golem ({n} abitanti). Valore base 0–100.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Modificatori di Paura (nel codice)</Text>
        <Text style={styles.sectionIntro}>
          La paura di ogni abitante è un valore 0–100 memorizzato in stato. Nel codice attuale non sono presenti modificatori che alterano la paura in base a leggi, eventi o azioni (a differenza di felicità e lealtà).
        </Text>

        <View style={styles.modCard}>
          <Text style={styles.modTitle}>1. Valore base (types.ts / abitantiData / useGameState)</Text>
          <View style={styles.modItem}>
            <Text style={styles.modBullet}>•</Text>
            <Text style={styles.modText}>La paura è memorizzata per ogni abitante come valore <Text style={styles.modBold}>0–100</Text>. I dati iniziali (abitantiData) e i nuovi abitanti generati (immigrazione, assimilazione) hanno un valore di paura casuale nel rispettivo intervallo; non esiste una funzione "paura modificata" né bonus/malus applicati in tempo reale.</Text>
          </View>
        </View>

        <View style={styles.modCard}>
          <Text style={styles.modTitle}>2. Dove viene usata</Text>
          <View style={styles.modItem}>
            <Text style={styles.modBullet}>•</Text>
            <Text style={styles.modText}>La paura è mostrata in <Text style={styles.modBold}>Home</Text> (Paura media), nella scheda <Text style={styles.modBold}>Abitanti</Text> (colonna Paura) e nel <Text style={styles.modBold}>modale dettaglio abitante</Text> (AbitanteInfoModal). Al momento non è usata da meccaniche di gioco (emigrazione, eventi, ecc.).</Text>
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
