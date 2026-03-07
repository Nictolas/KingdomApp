import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

export default function LeggeNasciteScreen() {
  const router = useRouter();
  const { politicaNascite, setPoliticaNascite } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const politiche = [
    {
      id: "figlio-unico" as const,
      titolo: "Politica del Figlio Unico",
      descrizione: "Ogni coppia può avere massimo un figlio. Riduce la crescita demografica.",
      emoji: "👶"
    },
    {
      id: "incentivi" as const,
      titolo: "Incentivi alle Nascite",
      descrizione: "Offre bonus e supporto economico alle famiglie che hanno figli. Aumenta la crescita demografica.",
      emoji: "👨‍👩‍👧‍👦"
    },
    {
      id: "nessuna" as const,
      titolo: "Nessuna Politica",
      descrizione: "Nessuna regolamentazione sulla crescita demografica. La popolazione cresce naturalmente.",
      emoji: "➖"
    }
  ];

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Legge sulle Nascite</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Informazioni */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Politica Attuale</Text>
          <Text style={styles.infoText}>
            {politiche.find((p) => p.id === politicaNascite)?.titolo || "Nessuna"}
          </Text>
        </View>

        {/* Selettore politiche */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seleziona Politica</Text>
          {politiche.map((politica) => {
            const isSelected = politicaNascite === politica.id;
            return (
              <Pressable
                key={politica.id}
                style={[styles.politicaCard, isSelected && styles.politicaCardSelected]}
                onPress={() => setPoliticaNascite(politica.id)}
              >
                <View style={styles.politicaHeader}>
                  <Text style={styles.politicaEmoji}>{politica.emoji}</Text>
                  <Text style={[styles.politicaTitolo, isSelected && styles.politicaTitoloSelected]}>
                    {politica.titolo}
                  </Text>
                </View>
                <Text style={styles.politicaDescrizione}>{politica.descrizione}</Text>
                {isSelected && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>✓ Attiva</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
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
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  infoText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600"
  },
  section: {
    marginBottom: 8
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8
  },
  politicaCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 8
  },
  politicaCardSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "rgba(59,130,246,0.1)"
  },
  politicaHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6
  },
  politicaEmoji: {
    fontSize: 24,
    marginRight: 8
  },
  politicaTitolo: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "700",
    flex: 1
  },
  politicaTitoloSelected: {
    color: "#93c5fd"
  },
  politicaDescrizione: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14
  },
  selectedBadge: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  selectedBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "600"
  }
});
