import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { CASTA_CATALOGO, getCastaAbitante } from "../src/game/casta";
import type { Abitante, Casta } from "../src/types";
import { CastaMembriModal } from "../src/ui/CastaMembriModal";
import { CastaPieChart, coloriCasta } from "../src/ui/CastaPieChart";

export default function CastaScreen() {
  const router = useRouter();
  const { abitanti } = useGameContext();
  const [selectedCasta, setSelectedCasta] = useState<Casta | null>(null);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const conteggi = useMemo(
    () =>
      CASTA_CATALOGO.map((c) => ({
        ...c,
        count: abitanti.filter((a: Abitante) => getCastaAbitante(a) === c.nome).length
      })),
    [abitanti]
  );

  const fetteTorta = useMemo(
    () =>
      conteggi.map((c) => ({
        nome: c.nome,
        emoji: c.emoji,
        count: c.count,
        color: coloriCasta(c.nome)
      })),
    [conteggi]
  );

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🏛️ Casta</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.subtitle}>
            La casta definisce lo status sociale di ogni abitante e quali vincoli o privilegi ha rispetto al lavoro, alla proprietà e alla legge.
            Compravendita e uccisione dalla pagina Schiavi; assegnazione lavoro forzata dei Servi della gleba da Postazioni di lavoro.
          </Text>

          <CastaPieChart
            slices={fetteTorta}
            size={isDesktop ? 200 : 160}
            onCastaPress={(casta) => setSelectedCasta(casta)}
          />

          <View style={[styles.grid, isDesktop && styles.gridDesktop]}>
            {conteggi.map((c) => (
              <Pressable
                key={c.nome}
                style={({ pressed }) => [
                  styles.card,
                  isDesktop && styles.cardDesktop,
                  pressed && styles.cardPressed
                ]}
                onPress={() => setSelectedCasta(c.nome)}
                accessibilityRole="button"
                accessibilityLabel={`Apri elenco abitanti casta ${c.nome}`}
              >
                <Text style={styles.emoji}>{c.emoji}</Text>
                <Text style={styles.cardTitle}>{c.nome}</Text>
                <Text style={styles.cardCount}>
                  Presenti: <Text style={styles.bold}>{c.count}</Text>
                </Text>
                <Text style={styles.cardHint}>Tocca per vedere l'elenco</Text>
                {c.regole.map((regola, idx) => (
                  <View key={idx} style={styles.regolaRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.regolaTesto}>{regola}</Text>
                  </View>
                ))}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
      <CastaMembriModal
        visible={selectedCasta !== null}
        casta={selectedCasta}
        abitanti={abitanti}
        onClose={() => setSelectedCasta(null)}
      />
      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>← Home</Text>
      </View>
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
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.6)"
  },
  back: { color: "#93c5fd", fontSize: 12 },
  title: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  content: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    paddingBottom: 12
  },
  subtitle: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 10
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  gridDesktop: {
    gap: 10
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    width: "100%",
    minWidth: 200
  },
  cardDesktop: {
    width: "48%",
    minWidth: 260,
    maxWidth: 400
  },
  cardPressed: {
    opacity: 0.88,
    borderColor: "rgba(147,197,253,0.75)"
  },
  cardHint: {
    color: "rgba(147,197,253,0.85)",
    fontSize: 9,
    fontStyle: "italic",
    marginBottom: 6
  },
  emoji: { fontSize: 22, marginBottom: 4 },
  cardTitle: { color: "#e5e7eb", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  cardCount: { color: "rgba(203,213,245,0.7)", fontSize: 9, marginBottom: 6 },
  bold: { color: "#ffffff", fontWeight: "700" },
  regolaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
    gap: 4
  },
  bullet: { color: "#93c5fd", fontSize: 10, lineHeight: 14 },
  regolaTesto: {
    flex: 1,
    color: "rgba(203,213,245,0.85)",
    fontSize: 10,
    lineHeight: 14
  }
});
