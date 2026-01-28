import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import type { Abitante } from "../src/types";

export default function SerraScreen() {
  const router = useRouter();
  const { abitanti, edifici, assegnaAbitanteAEdificio, rimuoviAbitanteDaEdificio } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  // Trova la Serra
  const serra = edifici.find((e) => e.nome === "Serra Idroponica Alpha");
  if (!serra) {
    return null;
  }

  // Abitanti assegnati alla serra
  const abitantiAssegnati = abitanti.filter((a) => serra.abitantiAssegnati.includes(a.id));

  // Abitanti disponibili (non assegnati alla serra)
  const abitantiDisponibili = abitanti.filter((a) => !serra.abitantiAssegnati.includes(a.id));

  // Ogni abitante assegnato alla Serra produce un valore fisso di cibo (10-20 razioni al mese)
  const getProduzioneCiboPerAbitante = (abitante: Abitante): number => {
    const seed = abitante.id * 31;
    return 10 + (seed % 11); // 10-20
  };

  // Calcola produzione mensile basata sugli abitanti assegnati (somma dei valori fissi individuali)
  const calcolaProduzione = () => {
    if (abitantiAssegnati.length === 0) return 0;
    return abitantiAssegnati.reduce((sum, a) => sum + getProduzioneCiboPerAbitante(a), 0);
  };

  const produzioneMensile = calcolaProduzione();
  const puòAssegnare = abitantiDisponibili.length > 0 && abitantiAssegnati.length < serra.capacità;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Edifici
        </Text>
        <Text style={styles.title}>Serra Idroponica Alpha</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Informazioni produzione */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Produzione Mensile</Text>
          <Text style={styles.produzioneValue}>
            {produzioneMensile} <Text style={styles.produzioneUnit}>razioni di cibo</Text>
          </Text>
          <Text style={styles.infoSubtext}>
            {abitantiAssegnati.length} abitante{abitantiAssegnati.length !== 1 ? "i" : ""} assegnato
            {abitantiAssegnati.length !== 1 ? "i" : ""}
          </Text>
          <Text style={styles.infoSubtext}>
            Capacità: {abitantiAssegnati.length}/{serra.capacità}
          </Text>
        </View>

        {/* Abitanti assegnati */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Abitanti Assegnati</Text>
          {abitantiAssegnati.length > 0 ? (
            <View style={styles.cardsContainer}>
              {abitantiAssegnati.map((a: Abitante) => (
                <View key={a.id} style={styles.card}>
                  <Text style={styles.cardEmoji}>{a.emoji}</Text>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{a.nome}</Text>
                    <Text style={styles.cardLavoro}>{a.lavoro}</Text>
                    <Text style={styles.cardProduttività}>
                      Produttività: {a.produttività}%
                    </Text>
                  </View>
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => rimuoviAbitanteDaEdificio(a.id, serra.id)}
                  >
                    <Text style={styles.removeButtonText}>Rimuovi</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Nessun abitante assegnato</Text>
          )}
        </View>

        {/* Abitanti disponibili */}
        {puòAssegnare && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Abitanti Disponibili</Text>
            <View style={styles.cardsContainer}>
              {abitantiDisponibili.map((a: Abitante) => (
                <View key={a.id} style={styles.card}>
                  <Text style={styles.cardEmoji}>{a.emoji}</Text>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{a.nome}</Text>
                    <Text style={styles.cardLavoro}>{a.lavoro}</Text>
                    <Text style={styles.cardProduttività}>
                      Produttività: {a.produttività}%
                    </Text>
                  </View>
                  <Pressable
                    style={styles.addButton}
                    onPress={() => assegnaAbitanteAEdificio(a.id, serra.id)}
                  >
                    <Text style={styles.addButtonText}>Assegna</Text>
                  </Pressable>
                </View>
              ))}
            </View>
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
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center"
  },
  infoTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  produzioneValue: {
    color: "#4ade80",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 1
  },
  produzioneUnit: {
    color: "rgba(74,222,128,0.7)",
    fontSize: 9,
    fontWeight: "500"
  },
  infoSubtext: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    marginTop: 1
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
  cardProduttività: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 8,
    textAlign: "center"
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
    marginTop: 4,
    width: "100%",
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
