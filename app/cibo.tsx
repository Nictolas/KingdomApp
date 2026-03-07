import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import {
  getCategoriaPeso,
  getConsumoCibo,
  getProduzioneCiboPerAbitante,
  CATEGORIE_PESO
} from "../src/game/ciboConsumo";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import type { Abitante } from "../src/types";

export default function CiboScreen() {
  const router = useRouter();
  const { abitanti, edifici, risorse, calcolaDeltaOrdiniMercato } = useGameContext();

  // I Robot non consumano cibo: esclusi da lista e totali
  const consumiPerAbitante = abitanti
    .filter((a) => a.razza !== "Robot")
    .map((a) => ({
      abitante: a,
      categoria: getCategoriaPeso(a),
      consumo: getConsumoCibo(a)
    }));

  const totaleConsumo = consumiPerAbitante.reduce((s, c) => s + c.consumo, 0);

  const serra = edifici.find((e) => e.nome === "Serra");
  const totaleProduzione =
    serra?.abitantiAssegnati.reduce((sum, id) => sum + getProduzioneCiboPerAbitante(id), 0) ?? 0;
  const bilancio = totaleProduzione - totaleConsumo;

  const risorsaCibo = risorse.find((r) => r.nome.toLowerCase().includes("cibo"));
  const scortaAttuale = risorsaCibo?.quantità ?? 0;

  // Anteprima effetto ordini di mercato su Cibo (come in Home)
  const deltaMercato = calcolaDeltaOrdiniMercato();
  const deltaCibo = risorsaCibo ? deltaMercato[risorsaCibo.nome] ?? 0 : 0;
  const scortaDopoMercato = scortaAttuale + deltaCibo;

  const perCategoria = CATEGORIE_PESO.map((cat) => ({
    categoria: cat,
    abitanti: consumiPerAbitante.filter((c) => c.categoria === cat)
  }));

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🍱 Cibo</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={true}>
        <View style={[styles.mainRow, !isDesktop && styles.mainRowStack]}>
          {/* Sinistra: Totale */}
          <View style={[styles.leftCol, !isDesktop && styles.leftColFull]}>
            <Text style={styles.sectionTitle}>Totale</Text>
            <View style={styles.totaleCard}>
              <Text style={styles.totaleLabel}>Consumo mensile</Text>
              <Text style={styles.totaleValueConsumo}>{totaleConsumo} razioni</Text>
            </View>
            <View style={styles.totaleCard}>
              <Text style={styles.totaleLabel}>Produzione mensile (Serra)</Text>
              <Text style={styles.totaleValueProduzione}>{totaleProduzione} razioni</Text>
            </View>
            <View style={styles.totaleCard}>
              <Text style={styles.totaleLabel}>Bilancio mensile</Text>
              <Text style={[styles.totaleValueBilancio, bilancio >= 0 ? styles.bilancioPos : styles.bilancioNeg]}>
                {bilancio >= 0 ? "+" : ""}{bilancio} razioni
              </Text>
            </View>
            <View style={styles.totaleCard}>
              <Text style={styles.totaleLabel}>Scorta attuale</Text>
              <Text style={styles.totaleValueScorta}>{scortaAttuale} razioni</Text>
              <Text style={styles.totaleSubHint}>
                Dopo ordini mercato:{" "}
                <Text style={deltaCibo >= 0 ? styles.deltaPositivo : styles.deltaNegativo}>
                  {scortaDopoMercato} razioni
                  {deltaCibo !== 0 ? ` (${deltaCibo > 0 ? "+" : ""}${deltaCibo})` : ""}
                </Text>
              </Text>
            </View>
          </View>

          {/* Destra: 4 colonne consumi per categoria */}
          <View style={[styles.rightCol, !isDesktop && styles.rightColFull]}>
            <Text style={styles.sectionTitle}>Consumi individuali per categoria peso</Text>
            <View style={[styles.gridColonne, !isDesktop && styles.gridColonneStack]}>
              {perCategoria.map(({ categoria, abitanti: list }) => (
                <View key={categoria} style={styles.colonna}>
                  <Text style={styles.colonnaTitolo}>{categoria}</Text>
                  <View style={styles.colonnaLista}>
                    {list.length === 0 ? (
                      <Text style={styles.colonnaVuota}>—</Text>
                    ) : (
                      list.map(({ abitante, consumo }) => (
                        <View key={abitante.id} style={styles.rigaAbitante}>
                          <Text style={styles.rigaEmoji}>{getEmojiAbitante(abitante)}</Text>
                          <View style={styles.rigaTesto}>
                            <Text style={styles.rigaNome} numberOfLines={1}>{abitante.nome}</Text>
                            <Text style={styles.rigaConsumo}>{consumo} raz.</Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                  {list.length > 0 && (
                    <Text style={styles.colonnaTotale}>
                      Tot: {list.reduce((s, c) => s + c.consumo, 0)} raz.
                    </Text>
                  )}
                </View>
              ))}
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
  totaleSubHint: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    marginTop: 4
  },
  deltaPositivo: {
    color: "#4ade80"
  },
  deltaNegativo: {
    color: "#ef4444"
  },
  gridColonne: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  gridColonneStack: { flexDirection: "row", flexWrap: "wrap" },
  colonna: {
    flex: 1,
    minWidth: 120,
    maxWidth: 200,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  colonnaTitolo: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center"
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
