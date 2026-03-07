import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import type { Abitante } from "../src/types";

export default function SchiavituScreen() {
  const router = useRouter();
  const { abitanti } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  // Filtra schiavisti e schiavi
  const schiavisti = abitanti.filter((a: Abitante) => a.ruoloSchiavitu === "schiavista");
  const schiavi = abitanti.filter((a: Abitante) => a.ruoloSchiavitu === "schiavo");

  // Funzione per ottenere il nome dello schiavista (Stato = schiavo di proprietà della colonia)
  const getSchiavistaNome = (schiavistaId?: number): string => {
    if (schiavistaId == null || schiavistaId === undefined) return "Stato";
    const schiavista = abitanti.find((a) => a.id === schiavistaId);
    return schiavista ? schiavista.nome : `ID ${schiavistaId}`;
  };

  // Funzione per ottenere gli schiavi di uno schiavista
  const getSchiaviDiSchiavista = (schiavistaId: number): Abitante[] => {
    return schiavi.filter((s) => s.schiavistaId === schiavistaId);
  };

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Schiavitu</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Sezione Schiavisti */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Schiavisti ({schiavisti.length})
          </Text>
          {schiavisti.length > 0 ? (
            <View style={styles.grid}>
              {schiavisti.map((schiavista: Abitante) => {
                const schiaviDiQuesto = getSchiaviDiSchiavista(schiavista.id);
                return (
                  <View key={schiavista.id} style={styles.card}>
                    <Text style={styles.emoji}>{getEmojiAbitante(schiavista)}</Text>
                    <Text style={styles.cardTitle}>{schiavista.nome}</Text>
                    <Text style={styles.cardLavoro}>{schiavista.lavoro}</Text>
                    <Text style={styles.cardInfo}>
                      Schiavi: {schiaviDiQuesto.length}
                    </Text>
                    {schiaviDiQuesto.length > 0 && (
                      <View style={styles.schiaviList}>
                        {schiaviDiQuesto.map((schiavo) => (
                          <Text key={schiavo.id} style={styles.schiavoItem}>
                            {getEmojiAbitante(schiavo)} {schiavo.nome}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>Nessuno schiavista registrato</Text>
          )}
        </View>

        {/* Sezione Schiavi */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Schiavi ({schiavi.length})
          </Text>
          {schiavi.length > 0 ? (
            <View style={styles.grid}>
              {schiavi.map((schiavo: Abitante) => (
                <View key={schiavo.id} style={styles.card}>
                  <Text style={styles.emoji}>{getEmojiAbitante(schiavo)}</Text>
                  <Text style={styles.cardTitle}>{schiavo.nome}</Text>
                  <Text style={styles.cardLavoro}>{schiavo.lavoro}</Text>
                  <Text style={styles.cardInfo}>
                    Schiavista: {getSchiavistaNome(schiavo.schiavistaId)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Nessuno schiavo registrato</Text>
          )}
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
  section: {
    marginBottom: 12
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 8,
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
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
    textAlign: "center"
  },
  cardLavoro: {
    color: "#93c5fd",
    fontSize: 9,
    textAlign: "center",
    marginBottom: 4
  },
  cardInfo: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    textAlign: "center"
  },
  schiaviList: {
    marginTop: 6,
    width: "100%",
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.3)"
  },
  schiavoItem: {
    color: "rgba(203,213,245,0.6)",
    fontSize: 8,
    marginBottom: 2,
    textAlign: "center"
  },
  emptyText: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 10,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12
  }
});
