import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import type { Abitante } from "../src/types";

export default function SchiaviScreen() {
  const router = useRouter();
  const { abitanti } = useGameContext();

  const schiavi = abitanti.filter((a: Abitante) => a.ruoloSchiavitu === "schiavo");
  const schiaviDiStato = schiavi.filter((s) => s.schiavistaId == null || s.schiavistaId === undefined);
  const schiaviPrivati = schiavi.filter((s) => s.schiavistaId != null);

  const getPadroneNome = (schiavistaId?: number): string => {
    if (schiavistaId == null || schiavistaId === undefined) return "Stato";
    const padrone = abitanti.find((a) => a.id === schiavistaId);
    return padrone ? padrone.nome : `ID ${schiavistaId}`;
  };

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Fazioni
        </Text>
        <Text style={styles.title}>⛓️ Schiavi</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Lista degli schiavi della colonia e dei loro padroni. Gli schiavi di Stato sono di proprietà della colonia (il giocatore); gli schiavi privati appartengono a un abitante.
        </Text>

        {/* Schiavi di Stato */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schiavi di Stato ({schiaviDiStato.length})</Text>
          <Text style={styles.sectionDesc}>Di proprietà della colonia (padrone: il giocatore)</Text>
          {schiaviDiStato.length > 0 ? (
            <View style={styles.grid}>
              {schiaviDiStato.map((schiavo: Abitante) => (
                <View key={schiavo.id} style={[styles.card, styles.cardStato]}>
                  <Text style={styles.emoji}>{getEmojiAbitante(schiavo)}</Text>
                  <Text style={styles.cardTitle}>{schiavo.nome}</Text>
                  <Text style={styles.cardLavoro}>{schiavo.lavoro}</Text>
                  <Text style={styles.badgeStato}>Padrone: Stato</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Nessuno schiavo di Stato</Text>
          )}
        </View>

        {/* Schiavi privati */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schiavi privati ({schiaviPrivati.length})</Text>
          <Text style={styles.sectionDesc}>Di proprietà di un abitante</Text>
          {schiaviPrivati.length > 0 ? (
            <View style={styles.grid}>
              {schiaviPrivati.map((schiavo: Abitante) => (
                <View key={schiavo.id} style={[styles.card, styles.cardPrivato]}>
                  <Text style={styles.emoji}>{getEmojiAbitante(schiavo)}</Text>
                  <Text style={styles.cardTitle}>{schiavo.nome}</Text>
                  <Text style={styles.cardLavoro}>{schiavo.lavoro}</Text>
                  <Text style={styles.cardPadrone}>
                    Padrone: {getPadroneNome(schiavo.schiavistaId)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Nessuno schiavo privato</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050816" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)"
  },
  back: { color: "#93c5fd", fontSize: 12 },
  title: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  content: { paddingHorizontal: 12, paddingVertical: 6, paddingBottom: 8, flex: 1 },
  subtitle: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 12
  },
  section: { marginBottom: 14 },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4
  },
  sectionDesc: {
    color: "rgba(203,213,245,0.6)",
    fontSize: 10,
    marginBottom: 8
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    width: "48%",
    minWidth: 140,
    alignItems: "center"
  },
  cardStato: {
    borderColor: "rgba(59,130,246,0.6)",
    backgroundColor: "rgba(15,23,42,0.98)"
  },
  cardPrivato: {
    borderColor: "rgba(148,163,184,0.6)"
  },
  emoji: { fontSize: 32, marginBottom: 4 },
  cardTitle: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginBottom: 2, textAlign: "center" },
  cardLavoro: { color: "#93c5fd", fontSize: 9, marginBottom: 4, textAlign: "center" },
  badgeStato: {
    color: "#3b82f6",
    fontSize: 9,
    fontWeight: "600"
  },
  cardPadrone: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
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
