import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { REATI_PUNIBILI_INFO } from "../src/game/reati";

export default function ReatiScreen() {
  const router = useRouter();
  const { penaReati, setPenaReato } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>⚖️ Reati</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.subtitle}>
            Ogni reato parte da 10 anni di carcere; puoi modificare il valore. Il Giudice applica queste pene quando
            scegli «Fai decidere al Giudice». Zero anni = nessuna legge che punisce quel reato.
          </Text>

          {REATI_PUNIBILI_INFO.map((r) => (
            <View key={r.reato} style={styles.card}>
              <Text style={styles.emoji}>{r.emoji}</Text>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{r.reato}</Text>
                <Text style={styles.cardDesc}>{r.descrizione}</Text>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Anni di carcere</Text>
                  <TextInput
                    style={styles.input}
                    value={String(penaReati[r.reato] ?? 0)}
                    keyboardType="number-pad"
                    onChangeText={(text) => {
                      const n = parseInt(text.replace(/[^0-9]/g, ""), 10);
                      setPenaReato(r.reato, isNaN(n) ? 0 : n);
                    }}
                  />
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Tribunale
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
  content: { paddingHorizontal: 12, paddingVertical: 6, paddingBottom: 8, gap: 8, flex: 1 },
  subtitle: { color: "rgba(203,213,245,0.7)", fontSize: 10, lineHeight: 14, marginBottom: 4 },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    flexDirection: "row",
    gap: 10
  },
  emoji: { fontSize: 28 },
  cardBody: { flex: 1 },
  cardTitle: { color: "#e5e7eb", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  cardDesc: { color: "rgba(203,213,245,0.7)", fontSize: 10, lineHeight: 14, marginBottom: 8 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  inputLabel: { color: "#93c5fd", fontSize: 10, fontWeight: "600" },
  input: {
    backgroundColor: "rgba(30,41,59,0.9)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: "#e5e7eb",
    fontSize: 14,
    minWidth: 56,
    textAlign: "center"
  }
});
