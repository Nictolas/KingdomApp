import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

export default function DivietoEspatrioScreen() {
  const router = useRouter();
  const { divietoEspatrioAttivo, setDivietoEspatrioAttivo } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🚧 Divieto di Espatrio</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Informazioni */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Stato Attuale</Text>
          <Text style={styles.infoText}>
            {divietoEspatrioAttivo
              ? "Il divieto di espatrio è attualmente attivo."
              : "Il divieto di espatrio non è attivo."}
          </Text>
          {divietoEspatrioAttivo && (
            <Text style={styles.warningText}>
              ⚠️ Questa legge aumenta il punteggio sanzioni della Comunità Interplanetaria di +1 punto.
            </Text>
          )}
        </View>

        {/* Toggle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attiva/Disattiva Divieto di Espatrio</Text>
          <Pressable
            style={[styles.toggleButton, divietoEspatrioAttivo && styles.toggleButtonActive]}
            onPress={() => setDivietoEspatrioAttivo(!divietoEspatrioAttivo)}
          >
            <Text style={[styles.toggleText, divietoEspatrioAttivo && styles.toggleTextActive]}>
              {divietoEspatrioAttivo ? "✓ Attivo" : "Disattivo"}
            </Text>
          </Pressable>
        </View>

        {/* Descrizione */}
        <View style={styles.descCard}>
          <Text style={styles.descTitle}>Descrizione</Text>
          <Text style={styles.descText}>
            Il divieto di espatrio impedisce agli abitanti di lasciare il regno. Senza questa legge, gli abitanti
            con Soddisfazione non positiva possono emigrare quando il divieto di espatrio non è attivo.
          </Text>
        </View>

        {/* Effetti */}
        <View style={styles.effettiCard}>
          <Text style={styles.effettiTitle}>Effetti</Text>
          <View style={styles.effettoRow}>
            <Text style={styles.effettoEmoji}>🚧</Text>
            <Text style={styles.effettoText}>Impedisce agli abitanti di lasciare il regno</Text>
          </View>
          <View style={styles.effettoRow}>
            <Text style={styles.effettoEmoji}>👥</Text>
            <Text style={styles.effettoText}>
              Previene l'emigrazione di abitanti infelici (felicità ≤10) con almeno 100 monete
            </Text>
          </View>
          <View style={styles.effettoRow}>
            <Text style={styles.effettoEmoji}>⚠️</Text>
            <Text style={styles.effettoText}>Aumenta il punteggio sanzioni di +1 punto</Text>
          </View>
        </View>
      </ScrollView>
    </View>
    <View style={styles.footer}>
      <Text style={styles.back} onPress={() => router.back()}>← Leggi</Text>
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
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4
  },
  warningText: {
    color: "#f97316",
    fontSize: 10,
    marginTop: 6,
    fontStyle: "italic"
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
  toggleButton: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 12,
    borderWidth: 2,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center"
  },
  toggleButtonActive: {
    borderColor: "#f97316",
    backgroundColor: "rgba(249,115,22,0.1)"
  },
  toggleText: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 12,
    fontWeight: "700"
  },
  toggleTextActive: {
    color: "#f97316"
  },
  descCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 12
  },
  descTitle: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  descText: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14
  },
  effettiCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  effettiTitle: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  effettoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6
  },
  effettoEmoji: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 2
  },
  effettoText: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14,
    flex: 1
  }
});
