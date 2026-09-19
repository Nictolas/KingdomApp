import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { OGGETTI_INVENTARIO } from "../src/game/inventario";

const oggetti = Object.values(OGGETTI_INVENTARIO);

function descrizioneCategoria(item: (typeof oggetti)[number]): string {
  if (item.categoria === "Valuta") return "Valuta";
  const tags = item.tagCibo ?? [];
  if (tags.includes("carne") || tags.includes("latticini") || tags.includes("uova")) {
    return "Cibo animale";
  }
  return "Cibo vegetale";
}

export default function OggettiScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>🎒 Oggetti</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Catalogo degli oggetti attualmente utilizzati dagli inventari del regno.
        </Text>

        <View style={styles.grid}>
          {oggetti.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.emoji}>{item.emoji}</Text>
              <Text style={styles.name}>{item.nome}</Text>
              <Text style={styles.category}>{descrizioneCategoria(item)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>← Menu</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050816" },
  header: {
    alignItems: "center",
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)"
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  content: { width: "100%", maxWidth: 960, alignSelf: "center", padding: 16 },
  subtitle: { color: "rgba(203,213,245,0.78)", fontSize: 12, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    width: "31%",
    minWidth: 150,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "rgba(15,23,42,0.96)"
  },
  emoji: { fontSize: 32, marginBottom: 6 },
  name: { color: "#f1f5f9", fontSize: 13, fontWeight: "800", textAlign: "center" },
  category: { color: "#93c5fd", fontSize: 10, marginTop: 5, fontWeight: "700" },
  footer: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.6)"
  },
  back: { color: "#93c5fd", fontSize: 12 }
});
