import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import type { Abitante, Edificio } from "../src/types";

export default function CreditiScreen() {
  const router = useRouter();
  const { abitanti, edifici } = useGameContext();

  const entrateAbitanti = abitanti.map((abitante) => ({
    abitante,
    reddito: abitante.reddito,
    spese: abitante.spese,
    netto: abitante.reddito - abitante.spese
  }));

  const speseManutenzione = edifici
    .filter((e) => e.stato === "Operativo")
    .map((edificio) => ({
      edificio,
      manutenzione: edificio.manutenzione
    }));

  const totaleRedditi = abitanti.reduce((sum, a) => sum + a.reddito, 0);
  const totaleSpese = abitanti.reduce((sum, a) => sum + a.spese, 0);
  const totaleManutenzione = speseManutenzione.reduce((sum, s) => sum + s.manutenzione, 0);
  const totaleNetto = totaleRedditi - totaleSpese - totaleManutenzione;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const contentMaxWidth = isDesktop ? 900 : undefined;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>💰 Crediti</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentMaxWidth && { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" }]}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.pageTitle}>Entrate e Uscite Mensili</Text>

        <View style={[styles.twoCols, !isDesktop && styles.twoColsStack]}>
          {/* Colonna sinistra: Entrate dalle tasse */}
          <View style={[styles.col, !isDesktop && styles.colFull]}>
            <Text style={styles.sectionTitle}>Entrate dalle Tasse</Text>
            <View style={styles.card}>
              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {entrateAbitanti.map(({ abitante, reddito, spese, netto }) => (
                  <View key={abitante.id} style={styles.item}>
                    <Text style={styles.itemEmoji}>{getEmojiAbitante(abitante)}</Text>
                    <View style={styles.itemContent}>
                      <Text style={styles.itemNome}>{abitante.nome}</Text>
                      <View style={styles.itemRow}>
                        <Text style={styles.itemLabel}>Reddito:</Text>
                        <Text style={styles.valorePositivo}>+{reddito}</Text>
                      </View>
                      <View style={styles.itemRow}>
                        <Text style={styles.itemLabel}>Spese:</Text>
                        <Text style={styles.valoreNegativo}>-{spese}</Text>
                      </View>
                      <View style={styles.itemRow}>
                        <Text style={styles.itemLabel}>Netto:</Text>
                        <Text style={[styles.valoreNetto, netto >= 0 ? styles.valorePositivo : styles.valoreNegativo]}>
                          {netto >= 0 ? "+" : ""}{netto}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.totaleRow}>
                <Text style={styles.totaleLabel}>Totale entrate:</Text>
                <Text style={styles.totaleValorePositivo}>+{totaleRedditi}</Text>
              </View>
              <View style={styles.totaleRow}>
                <Text style={styles.totaleLabel}>Totale spese abitanti:</Text>
                <Text style={styles.totaleValoreNegativo}>-{totaleSpese}</Text>
              </View>
            </View>
          </View>

          {/* Colonna destra: Spese di manutenzione */}
          <View style={[styles.col, !isDesktop && styles.colFull]}>
            <Text style={styles.sectionTitle}>Spese di Manutenzione</Text>
            <View style={styles.card}>
              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {speseManutenzione.map(({ edificio, manutenzione }) => (
                  <View key={edificio.id} style={styles.item}>
                    <Text style={styles.itemEmoji}>{edificio.emoji}</Text>
                    <View style={styles.itemContent}>
                      <Text style={styles.itemNome}>{edificio.nome}</Text>
                      <View style={styles.itemRow}>
                        <Text style={styles.itemLabel}>Manutenzione:</Text>
                        <Text style={styles.valoreNegativo}>-{manutenzione}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.totaleRow}>
                <Text style={styles.totaleLabel}>Totale manutenzione:</Text>
                <Text style={styles.totaleValoreNegativo}>-{totaleManutenzione}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bilancio mensile full width */}
        <View style={styles.bilancioCard}>
          <Text style={styles.bilancioLabel}>Bilancio mensile</Text>
          <Text style={[styles.bilancioValore, totaleNetto >= 0 ? styles.valorePositivo : styles.valoreNegativo]}>
            {totaleNetto >= 0 ? "+" : ""}{totaleNetto} <Text style={styles.bilancioUnita}>crediti</Text>
          </Text>
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)"
  },
  back: {
    color: "#93c5fd",
    fontSize: 14
  },
  title: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32
  },
  pageTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center"
  },
  twoCols: {
    flexDirection: "row",
    gap: 20,
    alignItems: "flex-start"
  },
  twoColsStack: {
    flexDirection: "column"
  },
  col: {
    flex: 1,
    minWidth: 0
  },
  colFull: {
    marginBottom: 24
  },
  sectionTitle: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  list: {
    maxHeight: 280,
    marginBottom: 12
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)"
  },
  itemEmoji: {
    fontSize: 26,
    marginRight: 12
  },
  itemContent: {
    flex: 1
  },
  itemNome: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2
  },
  itemLabel: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 11
  },
  valorePositivo: {
    color: "#4ade80",
    fontSize: 12,
    fontWeight: "700"
  },
  valoreNegativo: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "700"
  },
  valoreNetto: {
    fontSize: 12,
    fontWeight: "700"
  },
  totaleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.3)",
    marginTop: 4
  },
  totaleLabel: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600"
  },
  totaleValorePositivo: {
    color: "#4ade80",
    fontSize: 13,
    fontWeight: "700"
  },
  totaleValoreNegativo: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "700"
  },
  bilancioCard: {
    marginTop: 24,
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(148,163,184,0.4)",
    alignItems: "center"
  },
  bilancioLabel: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  bilancioValore: {
    fontSize: 22,
    fontWeight: "700"
  },
  bilancioUnita: {
    fontSize: 16,
    fontWeight: "500"
  }
});
