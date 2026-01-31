import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

const COMPETENZE: { nome: string; emoji: string; descrizione: string }[] = [
  { nome: "Competenza Medica", emoji: "🩺", descrizione: "Influenza efficacia cure e riduzione malattie. Utile in Ospedale." },
  { nome: "Competenza Agricola", emoji: "🌱", descrizione: "Aumenta la produzione di cibo in Serra e strutture agricole." },
  { nome: "Competenza Tecnica", emoji: "🔧", descrizione: "Migliora manutenzione e produzione negli edifici industriali." },
  { nome: "Competenza Scientifica", emoji: "🔬", descrizione: "Bonus in Laboratorio di Ricerca e innovazione." },
  { nome: "Competenza Giuridica", emoji: "⚖️", descrizione: "Efficacia del Tribunale e riduzione recidiva." },
  { nome: "Competenza Educativa", emoji: "📚", descrizione: "Qualità dell'istruzione nella Scuola." },
  { nome: "Competenza Generale", emoji: "📊", descrizione: "Base comune a tutti gli abitanti (competenza 0-100)." }
];

export default function CompetenzeScreen() {
  const router = useRouter();

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
        <Text style={styles.title}>📊 Competenze</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Catalogo delle competenze riconosciute nella colonia. Ogni abitante ha un livello di competenza generale; alcune competenze speciali influenzano edifici e ruoli.
        </Text>

        <View style={styles.grid}>
          {COMPETENZE.map((c) => (
            <View key={c.nome} style={styles.card}>
              <Text style={styles.emoji}>{c.emoji}</Text>
              <Text style={styles.cardTitle}>{c.nome}</Text>
              <Text style={styles.cardDesc} numberOfLines={3}>
                {c.descrizione}
              </Text>
            </View>
          ))}
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
    marginBottom: 10
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    width: "48%",
    minWidth: 140
  },
  emoji: { fontSize: 24, marginBottom: 6 },
  cardTitle: { color: "#e5e7eb", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  cardDesc: { color: "rgba(203,213,245,0.7)", fontSize: 10, lineHeight: 14 }
});
