import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { RESIDENZE_ENERGIA_PER_ABITANTE } from "../src/data/residenzeData";
import type { Edificio } from "../src/types";

const ENERGIA_PER_ROBOT = 2;

function useBilancioEnergia() {
  const { edifici, abitanti } = useGameContext();

  const consumiEdifici = edifici
    .filter((e) => {
      if (e.stato !== "Operativo") return false;
      if (!e.consumo) return false;
      return e.consumo.split(",").map((c) => c.trim()).some((c) => c.toLowerCase().includes("energia"));
    })
    .map((e) => {
      const consumoBase = e.efficienza / 20;
      const consumo = Math.floor(consumoBase * ((e.occupazione || 0) / (e.capacità || 1)));
      return { edificio: e, consumo };
    });

  const residenze = edifici.filter((e) => e.tipo === "Residenza" && e.stato === "Operativo");
  const consumiResidenze = residenze.map((e) => {
    const perAbitante = RESIDENZE_ENERGIA_PER_ABITANTE[e.nome] ?? 0;
    const numAbitanti = (e.abitantiAssegnati ?? []).length;
    return { edificio: e, consumo: perAbitante * numAbitanti };
  }).filter((c) => c.consumo > 0);

  const numRobots = abitanti.filter((a) => a.razza === "Golem").length;
  const consumoRobots = numRobots * ENERGIA_PER_ROBOT;

  const produzioneEnergia = edifici
    .filter((e) => {
      if (e.stato !== "Operativo") return false;
      if (!e.produzione) return false;
      return e.produzione.split(",").map((p) => p.trim()).some((p) => p.toLowerCase().includes("energia"));
    })
    .map((e) => {
      const numAbitanti = (e.abitantiAssegnati ?? []).length;
      const produzione =
        numAbitanti > 0
          ? Math.floor(
              numAbitanti *
                ((e.abitantiAssegnati ?? []).reduce((sum, id) => {
                  const a = abitanti.find((x) => x.id === id);
                  return sum + (a?.produttività ?? 0);
                }, 0) /
                  numAbitanti /
                  10)
            ) || Math.floor(e.efficienza / 10)
          : 0;
      return { edificio: e, produzione };
    });

  const totaleConsumo =
    consumiEdifici.reduce((s, c) => s + c.consumo, 0) +
    consumiResidenze.reduce((s, c) => s + c.consumo, 0) +
    consumoRobots;
  const totaleProduzione = produzioneEnergia.reduce((s, p) => s + p.produzione, 0);
  const bilancio = totaleProduzione - totaleConsumo;

  return {
    consumiEdifici,
    consumiResidenze,
    consumoRobots,
    numRobots,
    produzioneEnergia,
    totaleConsumo,
    totaleProduzione,
    bilancio
  };
}

export default function EnergiaScreen() {
  const router = useRouter();
  const {
    consumiEdifici,
    consumiResidenze,
    consumoRobots,
    numRobots,
    produzioneEnergia,
    totaleConsumo,
    totaleProduzione,
    bilancio
  } = useBilancioEnergia();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const maxHeight = isDesktop ? width * (9 / 16) : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Energia</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={true}>
        <Text style={styles.intro}>
          Produzione e consumo mensili (ogni Skip Mese). Le residenze consumano energia in base al numero di residenti.
        </Text>

        {produzioneEnergia.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Produzione</Text>
            {produzioneEnergia.map(({ edificio, produzione }) => (
              <View key={edificio.id} style={styles.card}>
                <Text style={styles.emoji}>{edificio.emoji}</Text>
                <View style={styles.cardContent}>
                  <Text style={styles.nome}>{edificio.nome}</Text>
                  <Text style={styles.valorePositivo}>+{produzione} MW</Text>
                </View>
              </View>
            ))}
            <View style={styles.totaleRow}>
              <Text style={styles.totaleLabel}>Totale produzione:</Text>
              <Text style={styles.totaleValorePositivo}>+{totaleProduzione} MW</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Consumo</Text>
          {consumiEdifici.map(({ edificio, consumo }) => (
            <View key={edificio.id} style={styles.card}>
              <Text style={styles.emoji}>{edificio.emoji}</Text>
              <View style={styles.cardContent}>
                <Text style={styles.nome}>{edificio.nome}</Text>
                <Text style={styles.valoreNegativo}>-{consumo} MW</Text>
              </View>
            </View>
          ))}
          {consumiResidenze.map(({ edificio, consumo }) => (
            <View key={edificio.id} style={styles.card}>
              <Text style={styles.emoji}>{edificio.emoji}</Text>
              <View style={styles.cardContent}>
                <Text style={styles.nome}>{edificio.nome} (residenza)</Text>
                <Text style={styles.valoreNegativo}>-{consumo} MW</Text>
                <Text style={styles.dettaglio}>
                  {(edificio.abitantiAssegnati ?? []).length} abitanti × {RESIDENZE_ENERGIA_PER_ABITANTE[edificio.nome] ?? 0} MW
                </Text>
              </View>
            </View>
          ))}
          {numRobots > 0 && (
            <View style={styles.card}>
              <Text style={styles.emoji}>🤖</Text>
              <View style={styles.cardContent}>
                <Text style={styles.nome}>Fazione Golem</Text>
                <Text style={styles.valoreNegativo}>-{consumoRobots} MW</Text>
                <Text style={styles.dettaglio}>{numRobots} × {ENERGIA_PER_ROBOT} energia runica</Text>
              </View>
            </View>
          )}
          <View style={styles.totaleRow}>
            <Text style={styles.totaleLabel}>Totale consumo:</Text>
            <Text style={styles.totaleValoreNegativo}>-{totaleConsumo} MW</Text>
          </View>
        </View>

        <View style={styles.bilancioContainer}>
          <Text style={styles.bilancioLabel}>Bilancio energetico</Text>
          <Text style={[styles.bilancioValore, bilancio >= 0 ? styles.valorePositivo : styles.valoreNegativo]}>
            {bilancio >= 0 ? "+" : ""}{bilancio} MW
          </Text>
        </View>
      </ScrollView>
      </View>
      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>← Indietro</Text>
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
  content: { paddingHorizontal: 14, paddingVertical: 12, paddingBottom: 28, flexGrow: 1 },
  intro: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 11,
    marginBottom: 14,
    fontStyle: "italic"
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  emoji: { fontSize: 22, marginRight: 10 },
  cardContent: { flex: 1 },
  nome: { color: "#e5e7eb", fontSize: 13, fontWeight: "600" },
  valorePositivo: { color: "#4ade80", fontSize: 12, fontWeight: "700" },
  valoreNegativo: { color: "#ef4444", fontSize: 12, fontWeight: "700" },
  dettaglio: { color: "rgba(203,213,245,0.7)", fontSize: 10, marginTop: 2 },
  totaleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.3)"
  },
  totaleLabel: { color: "#93c5fd", fontSize: 11, fontWeight: "600" },
  totaleValorePositivo: { color: "#4ade80", fontSize: 12, fontWeight: "700" },
  totaleValoreNegativo: { color: "#ef4444", fontSize: 12, fontWeight: "700" },
  bilancioContainer: {
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: "rgba(148,163,184,0.4)",
    alignItems: "center"
  },
  bilancioLabel: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  bilancioValore: { fontSize: 18, fontWeight: "700" }
});
