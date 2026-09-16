import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import type { Abitante } from "../src/types";

export default function PersonalitaScreen() {
  const router = useRouter();
  const { abitanti } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const mappa = new Map<string, number>();
  abitanti.forEach((a: Abitante) => {
    const p = (a.personalità || "").trim();
    if (!p) return;
    mappa.set(p, (mappa.get(p) ?? 0) + 1);
  });

  const catalogoPersonalita: { nome: string; emoji: string; effetto: string }[] = [
    { nome: "Pollice Verde", emoji: "🌱", effetto: "+10% produzione Cibo" },
    { nome: "Salutista", emoji: "🥗", effetto: "+10% Salute" },
    { nome: "Empatico", emoji: "🩺", effetto: "+10% Competenza Medica" },
    { nome: "Depresso", emoji: "🌧️", effetto: "-10% qualsiasi produzione" },
    { nome: "Carismatico", emoji: "✨", effetto: "+10% lealtà della fazione" },
    { nome: "Psicopatico", emoji: "🔪", effetto: "Rivalità ≥60 può portare a omicidio (soglia 90 per gli altri)" },
    { nome: "Stakanovista", emoji: "⚒️", effetto: "+15% produttività" },
    { nome: "Tiepido", emoji: "🌡️", effetto: "Nessun bonus né malus" },
    { nome: "Omofobo", emoji: "😤", effetto: "Stesso Lavoro con Omo/Bi: a ogni Skip solo +0–5 Rivalità" },
    { nome: "Razzista", emoji: "😠", effetto: "Stesso Lavoro con Razza diversa: a ogni Skip solo +0–5 Rivalità" },
    { nome: "Vegetariano", emoji: "🥬", effetto: "Non consuma carne dall'inventario (es. Bistecca)" },
    { nome: "Vegano", emoji: "🌿", effetto: "Non consuma carne, latte né uova dall'inventario" }
  ];

  const nomiCatalogo = new Set(catalogoPersonalita.map((p) => p.nome));
  const personalitaCustom = Array.from(mappa.entries())
    .filter(([nome]) => !nomiCatalogo.has(nome))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([nome, count]) => ({ nome, count, emoji: "🧬", effetto: "—" }));

  const personalita = [
    ...catalogoPersonalita.map((p) => ({
      ...p,
      count: mappa.get(p.nome) ?? 0
    })),
    ...personalitaCustom
  ];

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🧠 Personalità</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Catalogo delle personalità (con conteggio attuale nella colonia).
        </Text>

        <View style={[styles.grid, isDesktop && styles.gridDesktop]}>
          {personalita.map((p) => (
            <View key={p.nome} style={[styles.card, isDesktop && styles.cardDesktop]}>
              <Text style={styles.emoji}>{p.emoji}</Text>
              <Text style={styles.cardTitle}>{p.nome}</Text>
              <Text style={styles.cardEffetto}>{p.effetto}</Text>
              <Text style={styles.cardDesc}>
                Presenti: <Text style={styles.bold}>{p.count}</Text>
              </Text>
            </View>
          ))}
          {personalita.length === 0 && (
            <Text style={styles.emptyText}>Nessuna personalità trovata.</Text>
          )}
        </View>
      </ScrollView>
      </View>
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
    marginBottom: 6
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  gridDesktop: {
    gap: 8
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    width: "48%",
    minWidth: 120
  },
  cardDesktop: {
    width: "23%",
    minWidth: 130,
    maxWidth: 200
  },
  emoji: { fontSize: 20, marginBottom: 4 },
  cardTitle: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginBottom: 2 },
  cardEffetto: { color: "#93c5fd", fontSize: 9, marginBottom: 2 },
  cardDesc: { color: "rgba(203,213,245,0.7)", fontSize: 9, lineHeight: 12 },
  bold: { color: "#ffffff", fontWeight: "700" },
  emptyText: { color: "rgba(203,213,245,0.5)", fontSize: 10, fontStyle: "italic" }
});

