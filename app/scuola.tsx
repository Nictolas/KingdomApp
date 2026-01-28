import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import type { Abitante } from "../src/types";

export default function ScuolaScreen() {
  const router = useRouter();
  const { abitanti, edifici, etaMinimaLavoro, assegnaAbitanteAEdificio, rimuoviAbitanteDaEdificio } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  // Trova la Scuola
  const scuola = edifici.find((e) => e.nome === "Scuola");
  if (!scuola) {
    return null;
  }

  // Il professore è il primo (e unico) abitante assegnato alla scuola
  const professoreId = scuola.abitantiAssegnati.length > 0 ? scuola.abitantiAssegnati[0] : null;
  const professore = professoreId ? abitanti.find((a) => a.id === professoreId) : null;

  // I bambini sono tutti gli abitanti con età < etaMinimaLavoro
  const bambini = abitanti.filter((a) => a.eta < etaMinimaLavoro);

  // Abitanti disponibili per essere professore (non bambini, non già professore)
  const abitantiDisponibiliProfessore = abitanti.filter(
    (a) => a.eta >= etaMinimaLavoro && a.id !== professoreId
  );

  const puòAssegnareProfessore = abitantiDisponibiliProfessore.length > 0 && !professore;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Edifici
        </Text>
        <Text style={styles.title}>📚 Scuola</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Informazioni */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Stato Scuola</Text>
          <Text style={styles.infoText}>
            {professore ? `Professore: ${professore.nome}` : "Nessun professore assegnato"}
          </Text>
          <Text style={styles.infoSubtext}>
            Bambini iscritti: {bambini.length}
          </Text>
          <Text style={styles.infoSubtext}>
            Età minima lavoro: {etaMinimaLavoro} anni
          </Text>
        </View>

        {/* Professore */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Professore</Text>
          {professore ? (
            <View style={styles.professoreCard}>
              <Text style={styles.cardEmoji}>{professore.emoji}</Text>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{professore.nome}</Text>
                <Text style={styles.cardLavoro}>{professore.lavoro}</Text>
                <Text style={styles.cardInfo}>
                  Età: {professore.eta} anni | Competenza: {professore.competenza}%
                </Text>
              </View>
              <Pressable
                style={styles.removeButton}
                onPress={() => rimuoviAbitanteDaEdificio(professore.id, scuola.id)}
              >
                <Text style={styles.removeButtonText}>Rimuovi</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.emptyText}>Nessun professore assegnato</Text>
          )}

          {/* Abitanti disponibili per professore */}
          {puòAssegnareProfessore && (
            <View style={styles.subsection}>
              <Text style={styles.subsectionTitle}>Assegna Professore</Text>
              <View style={styles.cardsContainer}>
                {abitantiDisponibiliProfessore.map((a: Abitante) => (
                  <View key={a.id} style={styles.card}>
                    <Text style={styles.cardEmoji}>{a.emoji}</Text>
                    <View style={styles.cardContent}>
                      <Text style={styles.cardTitle}>{a.nome}</Text>
                      <Text style={styles.cardLavoro}>{a.lavoro}</Text>
                      <Text style={styles.cardInfo}>
                        Età: {a.eta} | Competenza: {a.competenza}%
                      </Text>
                    </View>
                    <Pressable
                      style={styles.addButton}
                      onPress={() => assegnaAbitanteAEdificio(a.id, scuola.id)}
                    >
                      <Text style={styles.addButtonText}>Assegna</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Lista Bambini */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bambini ({bambini.length})</Text>
          {bambini.length > 0 ? (
            <View style={styles.cardsContainer}>
              {bambini.map((bambino: Abitante) => (
                <View key={bambino.id} style={styles.bambinoCard}>
                  <Text style={styles.cardEmoji}>{bambino.emoji}</Text>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{bambino.nome}</Text>
                    <Text style={styles.cardInfo}>Età: {bambino.eta} anni</Text>
                    <Text style={styles.cardInfo}>Felicità: {bambino.felicità}/100</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Nessun bambino nella colonia</Text>
          )}
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
    paddingVertical: 4,
    paddingBottom: 6,
    gap: 4,
    flex: 1
  },
  infoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
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
    marginBottom: 2
  },
  infoSubtext: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    marginTop: 2
  },
  section: {
    marginTop: 4
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4
  },
  subsection: {
    marginTop: 6
  },
  subsectionTitle: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4
  },
  professoreCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "#3b82f6",
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  cardsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    width: "48%",
    minWidth: 120
  },
  bambinoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    width: "48%",
    minWidth: 120
  },
  cardEmoji: {
    fontSize: 24,
    marginBottom: 2
  },
  cardContent: {
    width: "100%",
    alignItems: "center"
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 1,
    textAlign: "center"
  },
  cardLavoro: {
    color: "#93c5fd",
    fontSize: 9,
    marginBottom: 1,
    textAlign: "center"
  },
  cardInfo: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 8,
    textAlign: "center",
    marginBottom: 1
  },
  addButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
    width: "100%",
    alignItems: "center"
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "600"
  },
  removeButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    width: 80,
    alignItems: "center"
  },
  removeButtonText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "600"
  },
  emptyText: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 10,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8
  }
});
