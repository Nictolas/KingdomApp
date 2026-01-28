import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

export default function SanzioniScreen() {
  const router = useRouter();
  const { punteggioSanzioni } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const haSanzioni = punteggioSanzioni >= 5;
  const livelloRischio =
    punteggioSanzioni >= 8
      ? "Critico"
      : punteggioSanzioni >= 5
      ? "Alto"
      : punteggioSanzioni >= 3
      ? "Medio"
      : "Basso";

  const coloreRischio =
    punteggioSanzioni >= 8
      ? "#ef4444"
      : punteggioSanzioni >= 5
      ? "#f97316"
      : punteggioSanzioni >= 3
      ? "#fde047"
      : "#4ade80";

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>Sanzioni</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Punteggio */}
        <View style={styles.punteggioCard}>
          <Text style={styles.punteggioTitle}>Punteggio Sanzioni</Text>
          <View style={styles.punteggioContainer}>
            <Text style={[styles.punteggioValue, { color: coloreRischio }]}>{punteggioSanzioni}</Text>
            <Text style={styles.punteggioMax}>/ 10</Text>
          </View>
          <Text style={[styles.livelloRischio, { color: coloreRischio }]}>Livello Rischio: {livelloRischio}</Text>
        </View>

        {/* Barra di progresso */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${(punteggioSanzioni / 10) * 100}%`,
                  backgroundColor: coloreRischio
                }
              ]}
            />
          </View>
        </View>

        {/* Informazioni */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Sistema di Sanzioni</Text>
          <Text style={styles.infoText}>
            La Comunità Interplanetaria monitora le politiche della tua colonia. Alcune leggi e pratiche aumentano il
            punteggio sanzioni.
          </Text>
          <Text style={styles.infoText}>
            <Text style={styles.infoBold}>Soglia critica:</Text> Al raggiungimento di 5 punti, la Comunità
            Interplanetaria impone sanzioni economiche e diplomatiche.
          </Text>
        </View>

        {/* Fattori che influenzano */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fattori che Influenzano il Punteggio</Text>
          <View style={styles.fattoreCard}>
            <Text style={styles.fattoreEmoji}>🔗</Text>
            <View style={styles.fattoreContent}>
              <Text style={styles.fattoreTitolo}>Schiavitù</Text>
              <Text style={styles.fattoreDescrizione}>
                Se la colonia pratica la schiavitù (presenza di schiavisti o schiavi): +1 punto
              </Text>
            </View>
          </View>
          <View style={styles.fattoreCard}>
            <Text style={styles.fattoreEmoji}>⚰️</Text>
            <View style={styles.fattoreContent}>
              <Text style={styles.fattoreTitolo}>Pena di Morte</Text>
              <Text style={styles.fattoreDescrizione}>
                Se la pena di morte è attiva: +1 punto
              </Text>
            </View>
          </View>
        </View>

        {/* Stato sanzioni */}
        {haSanzioni && (
          <View style={[styles.sanzioniCard, { borderColor: "#ef4444" }]}>
            <Text style={[styles.sanzioniTitle, { color: "#ef4444" }]}>⚠️ Sanzioni Attive</Text>
            <Text style={styles.sanzioniText}>
              La Comunità Interplanetaria ha imposto sanzioni alla tua colonia a causa delle politiche contrarie ai
              diritti fondamentali.
            </Text>
            <Text style={styles.sanzioniEffetti}>
              <Text style={styles.sanzioniEffettiTitle}>Effetti:</Text>
              {"\n"}• Riduzione del 20% delle risorse prodotte
              {"\n"}• Blocco degli scambi commerciali
              {"\n"}• Isolamento diplomatico
            </Text>
          </View>
        )}
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
  punteggioCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 8,
    alignItems: "center"
  },
  punteggioTitle: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  punteggioContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 6
  },
  punteggioValue: {
    fontSize: 36,
    fontWeight: "800"
  },
  punteggioMax: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 4
  },
  livelloRischio: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  progressContainer: {
    marginBottom: 12
  },
  progressBar: {
    height: 8,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderRadius: 4,
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 4
  },
  infoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 12
  },
  infoTitle: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  infoText: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 4
  },
  infoBold: {
    color: "#ffffff",
    fontWeight: "700"
  },
  section: {
    marginBottom: 12
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8
  },
  fattoreCard: {
    flexDirection: "row",
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 6
  },
  fattoreEmoji: {
    fontSize: 24,
    marginRight: 10
  },
  fattoreContent: {
    flex: 1
  },
  fattoreTitolo: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4
  },
  fattoreDescrizione: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    lineHeight: 13
  },
  sanzioniCard: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: 8,
    padding: 12,
    borderWidth: 2,
    marginTop: 8
  },
  sanzioniTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8
  },
  sanzioniText: {
    color: "rgba(203,213,245,0.9)",
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 8
  },
  sanzioniEffetti: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 9,
    lineHeight: 14
  },
  sanzioniEffettiTitle: {
    color: "#ffffff",
    fontWeight: "700"
  }
});
