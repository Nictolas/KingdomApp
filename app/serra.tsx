import React from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import type { Abitante } from "../src/types";

export default function SerraScreen() {
  const router = useRouter();
  const { abitanti, edifici, assegnaAbitanteAEdificio, rimuoviAbitanteDaEdificio } = useGameContext();

  // Trova la Serra
  const serra = edifici.find((e) => e.nome === "Serra Idroponica Alpha");
  if (!serra) {
    return null;
  }

  // Abitanti assegnati alla serra
  const abitantiAssegnati = abitanti.filter((a) => serra.abitantiAssegnati.includes(a.id));

  // Abitanti disponibili (non assegnati alla serra)
  const abitantiDisponibili = abitanti.filter((a) => !serra.abitantiAssegnati.includes(a.id));

  // Calcola produzione mensile basata sugli abitanti assegnati
  const calcolaProduzione = () => {
    if (abitantiAssegnati.length === 0) return 0;
    const produttivitàMedia =
      abitantiAssegnati.reduce((sum, a) => sum + a.produttività, 0) / abitantiAssegnati.length;
    return Math.floor(abitantiAssegnati.length * (produttivitàMedia / 10));
  };

  const produzioneMensile = calcolaProduzione();
  const puòAssegnare = abitantiDisponibili.length > 0 && abitantiAssegnati.length < serra.capacità;

  return (
    <SafeAreaView style={styles.safe}>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)"
  },
  back: {
    color: "#93c5fd",
    fontSize: 14
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700"
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 32,
    gap: 16
  },
  infoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center"
  },
  infoTitle: {
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  produzioneValue: {
    color: "#4ade80",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4
  },
  produzioneUnit: {
    color: "rgba(74,222,128,0.7)",
    fontSize: 14,
    fontWeight: "500"
  },
  infoSubtext: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 12,
    marginTop: 4
  },
  section: {
    marginTop: 8
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12
  },
  cardsContainer: {
    gap: 10
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  cardEmoji: {
    fontSize: 32
  },
  cardContent: {
    flex: 1
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2
  },
  cardLavoro: {
    color: "#93c5fd",
    fontSize: 12,
    marginBottom: 2
  },
  cardProduttività: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 11
  },
  addButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600"
  },
  removeButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  removeButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600"
  },
  emptyText: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 20
  }
});
