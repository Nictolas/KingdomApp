import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

export default function PenaDiMorteScreen() {
  const router = useRouter();
  const { penaDiMorteAttiva, setPenaDiMorteAttiva } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Pena di Morte</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Informazioni */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Stato Attuale</Text>
          <Text style={styles.infoText}>
            {penaDiMorteAttiva ? "La pena di morte è attualmente attiva." : "La pena di morte non è attiva."}
          </Text>
          {penaDiMorteAttiva && (
            <Text style={styles.warningText}>
              ⚠️ Questa legge aumenta il punteggio sanzioni della Comunità Interplanetaria di +1 punto.
            </Text>
          )}
        </View>

        {/* Toggle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attiva/Disattiva Pena di Morte</Text>
          <Pressable
            style={[styles.toggleButton, penaDiMorteAttiva && styles.toggleButtonActive]}
            onPress={() => setPenaDiMorteAttiva(!penaDiMorteAttiva)}
          >
            <Text style={[styles.toggleText, penaDiMorteAttiva && styles.toggleTextActive]}>
              {penaDiMorteAttiva ? "✓ Attiva" : "Disattiva"}
            </Text>
          </Pressable>
        </View>

        {/* Descrizione */}
        <View style={styles.descCard}>
          <Text style={styles.descTitle}>Descrizione</Text>
          <Text style={styles.descText}>
            La pena di morte consente l'esecuzione capitale per crimini gravi commessi nel regno. Questa legge è
            controversa e può avere conseguenze diplomatiche.
          </Text>
        </View>

        {/* Effetti */}
        <View style={styles.effettiCard}>
          <Text style={styles.effettiTitle}>Effetti</Text>
          <View style={styles.effettoRow}>
            <Text style={styles.effettoEmoji}>⚰️</Text>
            <Text style={styles.effettoText}>Consente l'esecuzione capitale per crimini gravi</Text>
          </View>
          <View style={styles.effettoRow}>
            <Text style={styles.effettoEmoji}>📉</Text>
            <Text style={styles.effettoText}>Riduce la paura nella popolazione</Text>
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
    borderColor: "#ef4444",
    backgroundColor: "rgba(239,68,68,0.1)"
  },
  toggleText: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 12,
    fontWeight: "700"
  },
  toggleTextActive: {
    color: "#ef4444"
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
