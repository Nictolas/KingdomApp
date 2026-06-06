import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import {
  getTotaleOggettiInventarioGiocatore,
  normalizzaInventarioGiocatore,
  OGGETTI_INVENTARIO
} from "../src/game/inventario";

export default function CiboScreen() {
  const router = useRouter();
  const { inventarioGiocatore } = useGameContext();

  const inventario = normalizzaInventarioGiocatore(inventarioGiocatore);
  const vociCibo = inventario
    .filter((v) => v.quantità > 0)
    .map((v) => ({
      def: OGGETTI_INVENTARIO[v.itemId]!,
      quantità: v.quantità
    }));
  const totale = getTotaleOggettiInventarioGiocatore(inventario);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🍱 Inventario Cibo</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        <Text style={styles.subtitle}>
          Scorte personali del giocatore · {totale} oggetti totali
        </Text>

        <View style={styles.grid}>
          {vociCibo.map((v) => (
            <View key={v.def.id} style={styles.slot}>
              <Text style={styles.slotEmoji}>{v.def.emoji}</Text>
              <Text style={styles.slotNome}>{v.def.nome}</Text>
              <Text style={styles.slotQty}>×{v.quantità}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Indietro
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
  content: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 24 },
  subtitle: {
    color: "rgba(203,213,245,0.75)",
    fontSize: 12,
    marginBottom: 16
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center"
  },
  slot: {
    width: 100,
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)"
  },
  slotEmoji: { fontSize: 32, marginBottom: 6 },
  slotNome: { color: "#e5e7eb", fontSize: 11, fontWeight: "600", textAlign: "center" },
  slotQty: { color: "#93c5fd", fontSize: 16, fontWeight: "700", marginTop: 4 }
});
