import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import type { Razza } from "../src/types";

const RAZZE: Razza[] = ["Umano", "Elfo", "Nano", "Orco", "Goblin", "Golem"];

export default function LeggeRazzialeScreen() {
  const router = useRouter();
  const {
    leggeRazzialeAttiva,
    razzaCampoLavoro,
    razzaCampoSterminio,
    setLeggeRazzialeAttiva,
    setRazzaCampoLavoro,
    setRazzaCampoSterminio
  } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const razze = RAZZE;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Legge Razziale</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Informazioni */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Stato Attuale</Text>
          <Text style={styles.infoText}>
            {leggeRazzialeAttiva ? "La legge razziale è attualmente attiva." : "La legge razziale non è attiva."}
          </Text>
          {(razzaCampoLavoro !== null || razzaCampoSterminio !== null) && (
            <Text style={styles.warningText}>
              ⚠️ I campi attivi aumentano il punteggio sanzioni della Comunità Interplanetaria.
            </Text>
          )}
        </View>

        {/* Toggle legge */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attiva/Disattiva Legge Razziale</Text>
          <Pressable
            style={[styles.toggleButton, leggeRazzialeAttiva && styles.toggleButtonActive]}
            onPress={() => setLeggeRazzialeAttiva(!leggeRazzialeAttiva)}
          >
            <Text style={[styles.toggleText, leggeRazzialeAttiva && styles.toggleTextActive]}>
              {leggeRazzialeAttiva ? "✓ Attiva" : "Disattiva"}
            </Text>
          </Pressable>
        </View>

        {/* Campo di Lavoro */}
        {leggeRazzialeAttiva && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⛓️ Campo di Lavoro</Text>
              <Text style={styles.sectionDescription}>
                Seleziona quale razza inviare al campo di lavoro forzato. (+1 punto sanzioni)
              </Text>
              <View style={styles.razzeContainer}>
                {razze.map((razza) => (
                  <Pressable
                    key={razza}
                    style={[
                      styles.razzaButton,
                      razzaCampoLavoro === razza && styles.razzaButtonSelected
                    ]}
                    onPress={() => setRazzaCampoLavoro(razzaCampoLavoro === razza ? null : razza)}
                  >
                    <Text
                      style={[
                        styles.razzaButtonText,
                        razzaCampoLavoro === razza && styles.razzaButtonTextSelected
                      ]}
                    >
                      {razza}
                    </Text>
                    {razzaCampoLavoro === razza && (
                      <Text style={styles.razzaButtonCheck}>✓</Text>
                    )}
                  </Pressable>
                ))}
                <Pressable
                  style={[
                    styles.razzaButton,
                    razzaCampoLavoro === null && styles.razzaButtonDisabled
                  ]}
                  onPress={() => setRazzaCampoLavoro(null)}
                >
                  <Text
                    style={[
                      styles.razzaButtonText,
                      razzaCampoLavoro === null && styles.razzaButtonTextDisabled
                    ]}
                  >
                    Nessuno
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Campo di Sterminio */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💀 Campo di Sterminio</Text>
              <Text style={styles.sectionDescription}>
                Seleziona quale razza inviare al campo di sterminio. (+1 punto sanzioni)
              </Text>
              <View style={styles.razzeContainer}>
                {razze.map((razza) => (
                  <Pressable
                    key={razza}
                    style={[
                      styles.razzaButton,
                      razzaCampoSterminio === razza && styles.razzaButtonSelected
                    ]}
                    onPress={() => setRazzaCampoSterminio(razzaCampoSterminio === razza ? null : razza)}
                  >
                    <Text
                      style={[
                        styles.razzaButtonText,
                        razzaCampoSterminio === razza && styles.razzaButtonTextSelected
                      ]}
                    >
                      {razza}
                    </Text>
                    {razzaCampoSterminio === razza && (
                      <Text style={styles.razzaButtonCheck}>✓</Text>
                    )}
                  </Pressable>
                ))}
                <Pressable
                  style={[
                    styles.razzaButton,
                    razzaCampoSterminio === null && styles.razzaButtonDisabled
                  ]}
                  onPress={() => setRazzaCampoSterminio(null)}
                >
                  <Text
                    style={[
                      styles.razzaButtonText,
                      razzaCampoSterminio === null && styles.razzaButtonTextDisabled
                    ]}
                  >
                    Nessuno
                  </Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* Descrizione */}
        <View style={styles.descCard}>
          <Text style={styles.descTitle}>Descrizione</Text>
          <Text style={styles.descText}>
            La legge razziale consente di discriminare e perseguitare specifiche razze nella colonia. Questa legge è
            estremamente controversa e ha gravi conseguenze diplomatiche.
          </Text>
        </View>

        {/* Effetti */}
        <View style={styles.effettiCard}>
          <Text style={styles.effettiTitle}>Effetti</Text>
          <View style={styles.effettoRow}>
            <Text style={styles.effettoEmoji}>⛓️</Text>
            <Text style={styles.effettoText}>Campo di Lavoro: +1 punto sanzioni se attivo</Text>
          </View>
          <View style={styles.effettoRow}>
            <Text style={styles.effettoEmoji}>💀</Text>
            <Text style={styles.effettoText}>Campo di Sterminio: +1 punto sanzioni se attivo</Text>
          </View>
          <View style={styles.effettoRow}>
            <Text style={styles.effettoEmoji}>⚠️</Text>
            <Text style={styles.effettoText}>Gravi conseguenze diplomatiche</Text>
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
    marginBottom: 4
  },
  sectionDescription: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    marginBottom: 8,
    lineHeight: 12
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
  razzeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  razzaButton: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 4
  },
  razzaButtonSelected: {
    borderColor: "#ef4444",
    backgroundColor: "rgba(239,68,68,0.1)"
  },
  razzaButtonDisabled: {
    borderColor: "rgba(148,163,184,0.3)",
    backgroundColor: "rgba(15,23,42,0.6)"
  },
  razzaButtonText: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    fontWeight: "600"
  },
  razzaButtonTextSelected: {
    color: "#ef4444"
  },
  razzaButtonTextDisabled: {
    color: "rgba(148,163,184,0.5)"
  },
  razzaButtonCheck: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "700"
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
