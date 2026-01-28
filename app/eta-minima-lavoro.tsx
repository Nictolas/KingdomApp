import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

export default function EtaMinimaLavoroScreen() {
  const router = useRouter();
  const { etaMinimaLavoro, setEtaMinimaLavoro } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  // Opzioni di età disponibili
  const etaOptions = [10, 11, 12, 13, 14, 15, 16, 17, 18];

  const haSanzione = etaMinimaLavoro <= 13;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Leggi
        </Text>
        <Text style={styles.title}>Età Minima sul Lavoro</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Informazioni */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Età Minima Attuale</Text>
          <Text style={styles.infoText}>{etaMinimaLavoro} anni</Text>
          {haSanzione && (
            <Text style={styles.warningText}>
              ⚠️ Questa età minima aumenta il punteggio sanzioni della Comunità Interplanetaria di +1 punto.
            </Text>
          )}
        </View>

        {/* Selettore età */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seleziona Età Minima</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.etaBarContainer}
          >
            {etaOptions.map((eta) => {
              const isSelected = etaMinimaLavoro === eta;
              const haSanzioneEta = eta <= 13;
              return (
                <Pressable
                  key={eta}
                  style={[
                    styles.etaButton,
                    isSelected && styles.etaButtonSelected,
                    haSanzioneEta && styles.etaButtonWarning
                  ]}
                  onPress={() => setEtaMinimaLavoro(eta)}
                >
                  <Text style={[styles.etaValue, isSelected && styles.etaValueSelected]}>
                    {eta}
                  </Text>
                  <Text style={styles.etaLabel}>anni</Text>
                  {isSelected && <Text style={styles.selectedCheck}>✓</Text>}
                  {haSanzioneEta && (
                    <Text style={styles.sanzioneBadge}>⚠️</Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Descrizione */}
        <View style={styles.descCard}>
          <Text style={styles.descTitle}>Descrizione</Text>
          <Text style={styles.descText}>
            Stabilisce l'età minima alla quale gli abitanti possono essere impiegati nel lavoro. Un'età minima troppo
            bassa può avere conseguenze diplomatiche.
          </Text>
        </View>

        {/* Effetti */}
        <View style={styles.effettiCard}>
          <Text style={styles.effettiTitle}>Effetti</Text>
          <View style={styles.effettoRow}>
            <Text style={styles.effettoEmoji}>👶</Text>
            <Text style={styles.effettoText}>
              Protegge i minori dal lavoro forzato e pericoloso
            </Text>
          </View>
          <View style={styles.effettoRow}>
            <Text style={styles.effettoEmoji}>⚠️</Text>
            <Text style={styles.effettoText}>
              Età ≤ 13 anni: +1 punto sanzioni
            </Text>
          </View>
          <View style={styles.effettoRow}>
            <Text style={styles.effettoEmoji}>📚</Text>
            <Text style={styles.effettoText}>
              I minori possono dedicarsi all'istruzione invece del lavoro
            </Text>
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
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 10
  },
  infoTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  infoText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4
  },
  warningText: {
    color: "#f97316",
    fontSize: 9,
    marginTop: 4,
    fontStyle: "italic"
  },
  section: {
    marginBottom: 10
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6
  },
  etaBarContainer: {
    flexDirection: "row",
    paddingVertical: 4,
    gap: 6
  },
  etaButton: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
    position: "relative"
  },
  etaButtonSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "rgba(59,130,246,0.1)",
    borderWidth: 2
  },
  etaButtonWarning: {
    borderColor: "#f97316",
    backgroundColor: "rgba(249,115,22,0.05)"
  },
  etaValue: {
    color: "#e5e7eb",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2
  },
  etaValueSelected: {
    color: "#93c5fd"
  },
  etaLabel: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 8,
    marginBottom: 2
  },
  selectedCheck: {
    color: "#3b82f6",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2
  },
  sanzioneBadge: {
    color: "#f97316",
    fontSize: 8,
    fontWeight: "600",
    marginTop: 2
  },
  descCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 10
  },
  descTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  descText: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    lineHeight: 13
  },
  effettiCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  effettiTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  effettoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4
  },
  effettoEmoji: {
    fontSize: 14,
    marginRight: 6,
    marginTop: 1
  },
  effettoText: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    lineHeight: 13,
    flex: 1
  }
});
