import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

export default function ReligioneScreen() {
  const router = useRouter();
  const { politicaReligiosa, setPoliticaReligiosa } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const politiche = [
    {
      id: "ateismo-stato" as const,
      titolo: "Ateismo di Stato",
      descrizione: "Lo stato promuove attivamente l'ateismo e scoraggia le pratiche religiose. Le religioni sono vietate.",
      emoji: "🚫"
    },
    {
      id: "religione-stato" as const,
      titolo: "Religione di Stato",
      descrizione: "Una religione ufficiale viene promossa dallo stato. Le altre religioni sono tollerate ma non supportate.",
      emoji: "⛪"
    },
    {
      id: "liberta-culto" as const,
      titolo: "Libertà di Culto",
      descrizione: "Tutti gli abitanti sono liberi di praticare qualsiasi religione o essere atei senza interferenze dello stato.",
      emoji: "🕊️"
    }
  ];

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Leggi
        </Text>
        <Text style={styles.title}>Religione</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Informazioni */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Politica Attuale</Text>
          <Text style={styles.infoText}>
            {politiche.find((p) => p.id === politicaReligiosa)?.titolo || "Nessuna"}
          </Text>
        </View>

        {/* Selettore politiche */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seleziona Politica</Text>
          {politiche.map((politica) => {
            const isSelected = politicaReligiosa === politica.id;
            return (
              <Pressable
                key={politica.id}
                style={[styles.politicaCard, isSelected && styles.politicaCardSelected]}
                onPress={() => setPoliticaReligiosa(politica.id)}
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

        {/* Religioni disponibili */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Religioni Disponibili</Text>
          <View style={styles.religioniGrid}>
            <View style={styles.religioneCard}>
              <Text style={styles.religioneEmoji}>🚫</Text>
              <Text style={styles.religioneNome}>Ateo</Text>
            </View>
            <View style={styles.religioneCard}>
              <Text style={styles.religioneEmoji}>🤔</Text>
              <Text style={styles.religioneNome}>Deista</Text>
            </View>
            <View style={styles.religioneCard}>
              <Text style={styles.religioneEmoji}>❓</Text>
              <Text style={styles.religioneNome}>Agnostico</Text>
            </View>
            <View style={styles.religioneCard}>
              <Text style={styles.religioneEmoji}>☀️</Text>
              <Text style={styles.religioneNome}>Culto del Sole</Text>
            </View>
            <View style={styles.religioneCard}>
              <Text style={styles.religioneEmoji}>👽</Text>
              <Text style={styles.religioneNome}>Culto degli Alieni</Text>
            </View>
          </View>
        </View>

        {/* Edifici religiosi */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Edifici Religiosi</Text>
          <View style={styles.edificioCard}>
            <Text style={styles.edificioEmoji}>☀️</Text>
            <View style={styles.edificioContent}>
              <Text style={styles.edificioNome}>Culto del Sole</Text>
              <Text style={styles.edificioDescrizione}>
                Tempio dedicato al culto del Sole. Aperto a tutti gli abitanti.
              </Text>
            </View>
          </View>
          <View style={styles.edificioCard}>
            <Text style={styles.edificioEmoji}>👽</Text>
            <View style={styles.edificioContent}>
              <Text style={styles.edificioNome}>Culto degli Alieni</Text>
              <Text style={styles.edificioDescrizione}>
                Tempio dedicato al culto degli Alieni. Riservato solo agli alieni.
              </Text>
            </View>
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
    marginBottom: 12
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
  },
  religioniGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  religioneCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    width: "48%",
    minWidth: 120
  },
  religioneEmoji: {
    fontSize: 32,
    marginBottom: 4
  },
  religioneNome: {
    color: "#e5e7eb",
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center"
  },
  edificioCard: {
    flexDirection: "row",
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 8
  },
  edificioEmoji: {
    fontSize: 32,
    marginRight: 10
  },
  edificioContent: {
    flex: 1
  },
  edificioNome: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4
  },
  edificioDescrizione: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    lineHeight: 13
  }
});
