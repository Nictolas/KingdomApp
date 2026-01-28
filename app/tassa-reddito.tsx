import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import type { Abitante } from "../src/types";

export default function TassaRedditoScreen() {
  const router = useRouter();
  const { abitanti } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  // Calcola la tassa per ogni abitante basata su scaglioni progressivi
  const calcolaTassa = (reddito: number): number => {
    if (reddito <= 300) {
      return 0; // Esenzione
    } else if (reddito <= 800) {
      return Math.floor((reddito - 300) * 0.1); // 10% sulla parte oltre 300
    } else if (reddito <= 1500) {
      return Math.floor(50 + (reddito - 800) * 0.2); // 50 (da 300-800) + 20% sulla parte oltre 800
    } else {
      return Math.floor(190 + (reddito - 1500) * 0.3); // 190 (da 0-1500) + 30% sulla parte oltre 1500
    }
  };

  // Calcola tasse per tutti gli abitanti
  const tasseAbitanti = abitanti.map((abitante) => {
    const tassa = calcolaTassa(abitante.reddito);
    return {
      abitante,
      tassa,
      redditoNetto: abitante.reddito - tassa
    };
  });

  // Calcola totali
  const totaleRedditi = abitanti.reduce((sum, a) => sum + a.reddito, 0);
  const totaleTasse = tasseAbitanti.reduce((sum, t) => sum + t.tassa, 0);
  const totaleRedditiNetto = totaleRedditi - totaleTasse;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Leggi
        </Text>
        <Text style={styles.title}>Tassa sul Reddito</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Informazioni sugli scaglioni */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Scaglioni Fiscali</Text>
          <View style={styles.scaglioneRow}>
            <Text style={styles.scaglioneLabel}>0 - 300 crediti:</Text>
            <Text style={styles.scaglioneValue}>0% (Esenzione)</Text>
          </View>
          <View style={styles.scaglioneRow}>
            <Text style={styles.scaglioneLabel}>301 - 800 crediti:</Text>
            <Text style={styles.scaglioneValue}>10%</Text>
          </View>
          <View style={styles.scaglioneRow}>
            <Text style={styles.scaglioneLabel}>801 - 1500 crediti:</Text>
            <Text style={styles.scaglioneValue}>20%</Text>
          </View>
          <View style={styles.scaglioneRow}>
            <Text style={styles.scaglioneLabel}>Oltre 1500 crediti:</Text>
            <Text style={styles.scaglioneValue}>30%</Text>
          </View>
        </View>

        {/* Lista abitanti con tasse */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tassazione per Abitante</Text>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {tasseAbitanti.map(({ abitante, tassa, redditoNetto }) => (
              <View key={abitante.id} style={styles.item}>
                <Text style={styles.emoji}>{abitante.emoji}</Text>
                <View style={styles.itemContent}>
                  <Text style={styles.nome}>{abitante.nome}</Text>
                  <View style={styles.itemRow}>
                    <Text style={styles.label}>Reddito:</Text>
                    <Text style={styles.valore}>{abitante.reddito} crediti</Text>
                  </View>
                  <View style={styles.itemRow}>
                    <Text style={styles.label}>Tassa:</Text>
                    <Text style={styles.valoreTassa}>-{tassa} crediti</Text>
                  </View>
                  <View style={styles.itemRow}>
                    <Text style={styles.label}>Reddito netto:</Text>
                    <Text style={styles.valoreNetto}>{redditoNetto} crediti</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Totali */}
        <View style={styles.totaleContainer}>
          <View style={styles.totaleRow}>
            <Text style={styles.totaleLabel}>Totale redditi:</Text>
            <Text style={styles.totaleValore}>{totaleRedditi} crediti</Text>
          </View>
          <View style={styles.totaleRow}>
            <Text style={styles.totaleLabel}>Totale tasse:</Text>
            <Text style={styles.totaleTasse}>-{totaleTasse} crediti</Text>
          </View>
          <View style={styles.totaleRowFinale}>
            <Text style={styles.totaleLabelFinale}>Entrate nette dalla colonia:</Text>
            <Text style={styles.totaleNetto}>{totaleRedditiNetto} crediti</Text>
          </View>
        </View>
      </ScrollView>
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    paddingBottom: 8,
    flex: 1
  },
  infoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 8
  },
  infoTitle: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  scaglioneRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3
  },
  scaglioneLabel: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10
  },
  scaglioneValue: {
    color: "#4ade80",
    fontSize: 10,
    fontWeight: "600"
  },
  section: {
    marginBottom: 8
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6
  },
  list: {
    maxHeight: 200,
    marginBottom: 4
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: "rgba(15,23,42,0.6)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)"
  },
  emoji: {
    fontSize: 20,
    marginRight: 8
  },
  itemContent: {
    flex: 1
  },
  nome: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 3
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2
  },
  label: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9
  },
  valore: {
    color: "#4ade80",
    fontSize: 9,
    fontWeight: "600"
  },
  valoreTassa: {
    color: "#ef4444",
    fontSize: 9,
    fontWeight: "600"
  },
  valoreNetto: {
    color: "#93c5fd",
    fontSize: 9,
    fontWeight: "600"
  },
  totaleContainer: {
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.3)",
    marginTop: 4
  },
  totaleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  totaleRowFinale: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.3)",
    marginTop: 4
  },
  totaleLabel: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600"
  },
  totaleLabelFinale: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700"
  },
  totaleValore: {
    color: "#4ade80",
    fontSize: 11,
    fontWeight: "700"
  },
  totaleTasse: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "700"
  },
  totaleNetto: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "700"
  }
});
