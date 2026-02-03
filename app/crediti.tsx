import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import type { Abitante, Edificio } from "../src/types";

export default function CreditiScreen() {
  const router = useRouter();
  const { abitanti, edifici, risorse } = useGameContext();

  const saldoCrediti = risorse.find((r) => r.nome === "Crediti")?.quantità ?? 0;

  // Solo abitanti con reddito/spese (escludi Robot); ordina per netto decrescente
  const entrateAbitanti = abitanti
    .filter((a) => a.razza !== "Robot")
    .map((abitante) => ({
      abitante,
      reddito: abitante.reddito,
      spese: abitante.spese,
      netto: abitante.reddito - abitante.spese
    }))
    .sort((a, b) => b.netto - a.netto);

  const speseManutenzione = edifici
    .filter((e) => e.stato === "Operativo")
    .map((edificio) => ({
      edificio,
      manutenzione: edificio.manutenzione
    }))
    .sort((a, b) => b.manutenzione - a.manutenzione);

  const totaleRedditi = abitanti.reduce((sum, a) => sum + a.reddito, 0);
  const totaleSpese = abitanti.reduce((sum, a) => sum + a.spese, 0);
  const totaleManutenzione = speseManutenzione.reduce((sum, s) => sum + s.manutenzione, 0);
  const totaleNetto = totaleRedditi - totaleSpese - totaleManutenzione;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const contentMaxWidth = isDesktop ? 1000 : undefined;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>Crediti</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentMaxWidth && { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" }]}
        showsVerticalScrollIndicator={true}
      >
        {/* Riepilogo in evidenza */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Saldo attuale</Text>
            <Text style={styles.summaryValore}>{saldoCrediti.toLocaleString("it-IT")}</Text>
            <Text style={styles.summaryUnita}>crediti</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardBilancio]}>
            <Text style={styles.summaryLabel}>Bilancio mensile</Text>
            <Text style={[styles.summaryValore, totaleNetto >= 0 ? styles.valorePositivo : styles.valoreNegativo]}>
              {totaleNetto >= 0 ? "+" : ""}{totaleNetto.toLocaleString("it-IT")}
            </Text>
            <Text style={styles.summaryUnita}>crediti/mese</Text>
          </View>
        </View>

        <Text style={styles.pageTitle}>Dettaglio entrate e uscite</Text>

        <View style={[styles.twoCols, !isDesktop && styles.twoColsStack]}>
          <View style={[styles.col, !isDesktop && styles.colFull]}>
            <Text style={styles.sectionTitle}>Redditi e spese abitanti</Text>
            <View style={styles.card}>
              {entrateAbitanti.length > 0 ? (
                <>
                  <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                    {entrateAbitanti.map(({ abitante, reddito, spese, netto }) => (
                      <View key={abitante.id} style={styles.item}>
                        <Text style={styles.itemEmoji}>{getEmojiAbitante(abitante)}</Text>
                        <View style={styles.itemContent}>
                          <Text style={styles.itemNome}>{abitante.nome}</Text>
                          <View style={styles.itemRow}>
                            <Text style={styles.itemLabel}>Reddito</Text>
                            <Text style={styles.valorePositivo}>+{reddito}</Text>
                          </View>
                          <View style={styles.itemRow}>
                            <Text style={styles.itemLabel}>Spese</Text>
                            <Text style={styles.valoreNegativo}>-{spese}</Text>
                          </View>
                          <View style={styles.itemRow}>
                            <Text style={styles.itemLabel}>Netto</Text>
                            <Text style={[styles.valoreNetto, netto >= 0 ? styles.valorePositivo : styles.valoreNegativo]}>
                              {netto >= 0 ? "+" : ""}{netto}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                  <View style={styles.totaleRow}>
                    <Text style={styles.totaleLabel}>Totale redditi</Text>
                    <Text style={styles.totaleValorePositivo}>+{totaleRedditi}</Text>
                  </View>
                  <View style={styles.totaleRow}>
                    <Text style={styles.totaleLabel}>Totale spese abitanti</Text>
                    <Text style={styles.totaleValoreNegativo}>-{totaleSpese}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.emptyText}>Nessun abitante con reddito/spese (esclusi i Robot)</Text>
              )}
            </View>
          </View>

          <View style={[styles.col, !isDesktop && styles.colFull]}>
            <Text style={styles.sectionTitle}>Manutenzione edifici</Text>
            <View style={styles.card}>
              {speseManutenzione.length > 0 ? (
                <>
                  <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                    {speseManutenzione.map(({ edificio, manutenzione }) => (
                      <View key={edificio.id} style={styles.item}>
                        <Text style={styles.itemEmoji}>{edificio.emoji}</Text>
                        <View style={styles.itemContent}>
                          <Text style={styles.itemNome}>{edificio.nome}</Text>
                          <View style={styles.itemRow}>
                            <Text style={styles.itemLabel}>Manutenzione</Text>
                            <Text style={styles.valoreNegativo}>-{manutenzione}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                  <View style={styles.totaleRow}>
                    <Text style={styles.totaleLabel}>Totale manutenzione</Text>
                    <Text style={styles.totaleValoreNegativo}>-{totaleManutenzione}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.emptyText}>Nessun edificio operativo</Text>
              )}
            </View>
          </View>
        </View>

        <Pressable style={styles.linkRow} onPress={() => router.push("/tassa-reddito")}>
          <Text style={styles.linkText}>Configura tassa sul reddito →</Text>
        </Pressable>
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
    padding: 16,
    paddingBottom: 40
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24
  },
  summaryCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    alignItems: "center"
  },
  summaryCardBilancio: {
    borderColor: "rgba(74,222,128,0.3)"
  },
  summaryLabel: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6
  },
  summaryValore: {
    color: "#e5e7eb",
    fontSize: 22,
    fontWeight: "700"
  },
  summaryUnita: {
    color: "rgba(203,213,245,0.6)",
    fontSize: 10,
    marginTop: 2
  },
  pageTitle: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  twoCols: {
    flexDirection: "row",
    gap: 28,
    alignItems: "flex-start"
  },
  twoColsStack: {
    flexDirection: "column",
    gap: 28
  },
  col: {
    flex: 1,
    minWidth: 0
  },
  colFull: {
    marginBottom: 0
  },
  sectionTitle: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  list: {
    maxHeight: 320,
    marginBottom: 16
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)"
  },
  itemEmoji: {
    fontSize: 28,
    marginRight: 14
  },
  itemContent: {
    flex: 1
  },
  itemNome: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
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
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.3)",
    marginTop: 6
  },
  totaleLabel: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600"
  },
  totaleValorePositivo: {
    color: "#4ade80",
    fontSize: 14,
    fontWeight: "700"
  },
  totaleValoreNegativo: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "700"
  },
  emptyText: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 24
  },
  linkRow: {
    marginTop: 20,
    paddingVertical: 10,
    alignItems: "center"
  },
  linkText: {
    color: "#93c5fd",
    fontSize: 12
  }
});
