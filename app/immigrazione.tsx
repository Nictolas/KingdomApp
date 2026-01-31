import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import type { Abitante } from "../src/types";

export default function ImmigrazioneScreen() {
  const router = useRouter();
  const { abitantiProposti, accettaImmigrante, rifiutaImmigrante } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>Immigrazione</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {abitantiProposti.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>
              Nuovi candidati per questo mese ({abitantiProposti.length})
            </Text>
            <View style={styles.grid}>
              {abitantiProposti.map((a: Abitante) => (
                <View key={a.id} style={styles.card}>
                  <Text style={styles.emoji}>{a.emoji}</Text>
                  <Text style={styles.cardTitle}>{a.nome}</Text>
                  <Text style={styles.cardLavoro}>{a.lavoro}</Text>
                  <Text style={styles.cardInfo}>Età: {a.eta}</Text>
                  <Text style={styles.cardInfo}>Competenza: {a.competenza}%</Text>
                  <Text style={styles.cardInfo}>Produttività: {a.produttività}%</Text>
                  <Text style={styles.cardInfo}>Fazioni: {a.fazioni?.join(", ") ?? "—"}</Text>
                  <View style={styles.buttonRow}>
                    <Pressable
                      style={styles.acceptButton}
                      onPress={() => accettaImmigrante(a.id)}
                    >
                      <Text style={styles.buttonText}>Accetta</Text>
                    </Pressable>
                    <Pressable
                      style={styles.rejectButton}
                      onPress={() => rifiutaImmigrante(a.id)}
                    >
                      <Text style={styles.buttonText}>Rifiuta</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nessun nuovo candidato questo mese</Text>
            <Text style={styles.emptySubtext}>
              I nuovi candidati appariranno qui quando avanzi al mese successivo
            </Text>
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
    paddingVertical: 6,
    paddingBottom: 8,
    flex: 1
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    width: "48%",
    minWidth: 140
  },
  emoji: {
    fontSize: 32,
    marginBottom: 4
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
    textAlign: "center"
  },
  cardLavoro: {
    color: "#93c5fd",
    fontSize: 10,
    marginBottom: 2,
    textAlign: "center"
  },
  cardInfo: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    marginBottom: 1,
    textAlign: "center"
  },
  buttonRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    width: "100%"
  },
  acceptButton: {
    flex: 1,
    backgroundColor: "#4ade80",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: "center"
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#ef4444",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: "center"
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600"
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40
  },
  emptyText: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center"
  },
  emptySubtext: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 11,
    textAlign: "center",
    paddingHorizontal: 20
  }
});
