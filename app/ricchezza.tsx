import React, { useMemo } from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { ordinaAbitantiPerRicchezza } from "../src/game/ricchezza";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";

export default function RicchezzaScreen() {
  const router = useRouter();
  const { abitanti } = useGameContext();

  const classifica = useMemo(() => ordinaAbitantiPerRicchezza(abitanti), [abitanti]);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const maxHeight = isDesktop ? width * (9 / 16) : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight != null && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>💎 Ricchezza</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Classifica per monete in inventario, dal più ricco al più povero.
        </Text>

        {classifica.map((voce, index) => (
          <View key={voce.abitante.id} style={styles.row}>
            <Text style={styles.posizione}>{index + 1}</Text>
            <Text style={styles.emoji}>{getEmojiAbitante(voce.abitante)}</Text>
            <View style={styles.info}>
              <Text style={styles.nome} numberOfLines={1}>
                {voce.abitante.nome}
              </Text>
              <Text style={styles.dettaglio}>{voce.monete} monete</Text>
            </View>
            <Text style={styles.totale}>{voce.totale}</Text>
          </View>
        ))}

        {classifica.length === 0 ? (
          <Text style={styles.empty}>Nessun abitante in colonia.</Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Menu
        </Text>
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
  content: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 24 },
  subtitle: {
    color: "rgba(203,213,245,0.75)",
    fontSize: 11,
    marginBottom: 14,
    lineHeight: 16
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)"
  },
  posizione: {
    width: 22,
    color: "rgba(148,163,184,0.9)",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center"
  },
  emoji: { fontSize: 22, marginRight: 8 },
  info: { flex: 1, minWidth: 0 },
  nome: { color: "#e5e7eb", fontSize: 12, fontWeight: "700" },
  dettaglio: { color: "rgba(203,213,245,0.65)", fontSize: 9, marginTop: 2 },
  totale: { color: "#4ade80", fontSize: 14, fontWeight: "700", marginLeft: 8 },
  empty: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 24
  }
});
