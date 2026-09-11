import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

export default function LeggeDrogheScreen() {
  const router = useRouter();
  const { leggeDroghe, setLeggeDroghe } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const opzioni = [
    {
      valore: "vietate" as const,
      emoji: "🚫",
      titolo: "Tutte Vietate",
      descrizione: "Tutte le droghe sono completamente vietate nel regno."
    },
    {
      valore: "parziali" as const,
      emoji: "⚠️",
      titolo: "Parzialmente Legali",
      descrizione: "Alcune droghe leggere sono legali, quelle pesanti sono vietate."
    },
    {
      valore: "legali" as const,
      emoji: "✅",
      titolo: "Tutte Legali",
      descrizione: "Tutte le droghe sono legali e regolamentate."
    }
  ];

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>💊 Legge sulle Droghe</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.descrizione}>
          Regola la legalità delle sostanze stupefacenti nel regno. Le tue scelte influenzano la felicità di alcune
          fazioni.
        </Text>

        <View style={styles.opzioniContainer}>
          {opzioni.map((opzione) => {
            const isSelected = leggeDroghe === opzione.valore;
            return (
              <Pressable
                key={opzione.valore}
                style={[styles.opzioneCard, isSelected && styles.opzioneCardSelected]}
                onPress={() => setLeggeDroghe(opzione.valore)}
              >
                <Text style={styles.opzioneEmoji}>{opzione.emoji}</Text>
                <Text style={[styles.opzioneTitolo, isSelected && styles.opzioneTitoloSelected]}>
                  {opzione.titolo}
                </Text>
                <Text style={[styles.opzioneDescrizione, isSelected && styles.opzioneDescrizioneSelected]}>
                  {opzione.descrizione}
                </Text>
                {isSelected && <Text style={styles.selectedBadge}>✓ Attiva</Text>}
              </Pressable>
            );
          })}
        </View>

        {/* Effetti */}
        <View style={styles.effettiSection}>
          <Text style={styles.effettiTitle}>Effetti</Text>
          <View style={styles.effettoItem}>
            <Text style={styles.effettoEmoji}>🕴️</Text>
            <Text style={styles.effettoText}>
              <Text style={styles.effettoBold}>Mafia:</Text> +10% felicità se tutte le droghe sono vietate
            </Text>
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
  descrizione: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 12
  },
  opzioniContainer: {
    gap: 8,
    marginBottom: 12
  },
  opzioneCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  opzioneCardSelected: {
    borderColor: "#60a5fa",
    borderWidth: 2,
    backgroundColor: "rgba(30,58,138,0.3)"
  },
  opzioneEmoji: {
    fontSize: 32,
    marginBottom: 6,
    textAlign: "center"
  },
  opzioneTitolo: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center"
  },
  opzioneTitoloSelected: {
    color: "#93c5fd"
  },
  opzioneDescrizione: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
    marginBottom: 4
  },
  opzioneDescrizioneSelected: {
    color: "rgba(203,213,245,0.9)"
  },
  selectedBadge: {
    color: "#60a5fa",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4
  },
  effettiSection: {
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 8,
    padding: 10,
    marginTop: 8
  },
  effettiTitle: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8
  },
  effettoItem: {
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
  },
  effettoBold: {
    fontWeight: "700",
    color: "#e5e7eb"
  }
});
