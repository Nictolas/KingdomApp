import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getConsumoAcqua } from "../src/game/ciboConsumo";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import type { Abitante } from "../src/types";

export default function AcquaScreen() {
  const router = useRouter();
  const { abitanti, edifici, risorse } = useGameContext();

  const consumatori = abitanti
    .filter((a) => a.razza !== "Golem")
    .map((a) => ({
      abitante: a,
      consumo: getConsumoAcqua(a)
    }));

  const totaleConsumo = consumatori.reduce((s, c) => s + c.consumo, 0);

  const serre = edifici.filter((e) => e.nome === "Serra");
  const dissalatore = edifici.find((e) => e.nome === "Dissalatore");

  let produzioneSerra = 0;
  for (const serra of serre) {
    if (serra.abitantiAssegnati.length === 0) continue;
    const produttivitàMedia =
      serra.abitantiAssegnati.reduce((sum, id) => {
        const a = abitanti.find((x) => x.id === id);
        return sum + (a?.produttività ?? 0);
      }, 0) / serra.abitantiAssegnati.length;
    produzioneSerra += Math.floor(serra.abitantiAssegnati.length * (produttivitàMedia / 10));
  }

  const produttivitàMediaDissalatore =
    dissalatore && dissalatore.abitantiAssegnati.length > 0
      ? dissalatore.abitantiAssegnati.reduce((sum, id) => {
          const a = abitanti.find((x) => x.id === id);
          return sum + (a?.produttività ?? 0);
        }, 0) / dissalatore.abitantiAssegnati.length
      : 0;
  const produzioneDissalatore =
    dissalatore && dissalatore.abitantiAssegnati.length > 0
      ? Math.floor(dissalatore.abitantiAssegnati.length * (produttivitàMediaDissalatore / 10))
      : 0;

  const totaleProduzione = produzioneSerra + produzioneDissalatore;
  const bilancio = totaleProduzione - totaleConsumo;

  const risorsaAcqua = risorse.find((r) => r.nome.toLowerCase().includes("acqua"));
  const scortaAttuale = risorsaAcqua?.quantità ?? 0;
  const unità = risorsaAcqua?.unità ?? "m³";

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>💧 Acqua potabile</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={true}>
        <View style={[styles.mainRow, !isDesktop && styles.mainRowStack]}>
          <View style={[styles.leftCol, !isDesktop && styles.leftColFull]}>
            <Text style={styles.sectionTitle}>Totale</Text>
            <View style={styles.totaleCard}>
              <Text style={styles.totaleLabel}>Consumo mensile</Text>
              <Text style={styles.totaleValueConsumo}>{totaleConsumo} {unità}</Text>
            </View>
            <View style={styles.totaleCard}>
              <Text style={styles.totaleLabel}>Produzione mensile (Serra + Dissalatore)</Text>
              <Text style={styles.totaleValueProduzione}>{totaleProduzione} {unità}</Text>
            </View>
            <View style={styles.totaleCard}>
              <Text style={styles.totaleLabel}>Bilancio mensile</Text>
              <Text style={[styles.totaleValueBilancio, bilancio >= 0 ? styles.bilancioPos : styles.bilancioNeg]}>
                {bilancio >= 0 ? "+" : ""}{bilancio} {unità}
              </Text>
            </View>
            <View style={styles.totaleCard}>
              <Text style={styles.totaleLabel}>Scorta attuale</Text>
              <Text style={styles.totaleValueScorta}>{scortaAttuale} {unità}</Text>
            </View>
          </View>

          <View style={[styles.rightCol, !isDesktop && styles.rightColFull]}>
            <Text style={styles.sectionTitle}>Consumi individuali</Text>
            <View style={styles.colonna}>
              {consumatori.length === 0 ? (
                <Text style={styles.colonnaVuota}>Nessun consumatore (solo Golem)</Text>
              ) : (
                <View style={styles.colonnaLista}>
                  {consumatori.map(({ abitante, consumo }) => (
                    <View key={abitante.id} style={styles.rigaAbitante}>
                      <Text style={styles.rigaEmoji}>{getEmojiAbitante(abitante)}</Text>
                      <View style={styles.rigaTesto}>
                        <Text style={styles.rigaNome} numberOfLines={1}>{abitante.nome}</Text>
                        <Text style={styles.rigaConsumo}>{consumo} {unità}/mese</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
              {consumatori.length > 0 && (
                <Text style={styles.colonnaTotale}>Totale: {totaleConsumo} {unità}</Text>
              )}
            </View>
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
  content: { paddingHorizontal: 12, paddingVertical: 8, paddingBottom: 16, flexGrow: 1 },
  mainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16
  },
  mainRowStack: { flexDirection: "column" },
  leftCol: { width: 220, minWidth: 200 },
  leftColFull: { width: "100%" },
  rightCol: { flex: 1, minWidth: 0 },
  rightColFull: { width: "100%" },
  sectionTitle: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  totaleCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  totaleLabel: { color: "rgba(203,213,245,0.8)", fontSize: 10, marginBottom: 4 },
  totaleValueConsumo: { color: "#ef4444", fontSize: 16, fontWeight: "700" },
  totaleValueProduzione: { color: "#4ade80", fontSize: 16, fontWeight: "700" },
  totaleValueBilancio: { fontSize: 16, fontWeight: "700" },
  bilancioPos: { color: "#4ade80" },
  bilancioNeg: { color: "#ef4444" },
  totaleValueScorta: { color: "#e5e7eb", fontSize: 16, fontWeight: "700" },
  colonna: {
    minWidth: 200,
    maxWidth: 320,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  colonnaLista: { minHeight: 24 },
  colonnaVuota: {
    color: "rgba(203,213,245,0.4)",
    fontSize: 10,
    fontStyle: "italic",
    textAlign: "center"
  },
  colonnaTotale: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    marginTop: 6,
    textAlign: "center",
    fontWeight: "600"
  },
  rigaAbitante: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.2)"
  },
  rigaEmoji: { fontSize: 16, marginRight: 6 },
  rigaTesto: { flex: 1, minWidth: 0 },
  rigaNome: { color: "#e5e7eb", fontSize: 10, fontWeight: "500" },
  rigaConsumo: { color: "#ef4444", fontSize: 9 }
});
