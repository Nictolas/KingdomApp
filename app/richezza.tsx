import React, { useMemo } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { ordinaAbitantiPerRicchezza } from "../src/game/richezza";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";

export default function RicchezzaScreen() {
  const router = useRouter();
  const { abitanti } = useGameContext();

  const classifica = useMemo(() => ordinaAbitantiPerRicchezza(abitanti), [abitanti]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Indietro</Text>
        </Pressable>
        <Text style={styles.title}>💎 Ricchezza</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Classifica per monete in inventario, dal più ricco al più povero. Schiavi e Servi della gleba non hanno
          inventario personale.
        </Text>

        {classifica.map((voce, idx) => (
          <View key={voce.abitante.id} style={styles.row}>
            <Text style={styles.rank}>{idx + 1}.</Text>
            <Text style={styles.emoji}>{getEmojiAbitante(voce.abitante)}</Text>
            <View style={styles.col}>
              <Text style={styles.nome}>{voce.abitante.nome}</Text>
              <Text style={styles.dettaglio}>{voce.monete} monete</Text>
            </View>
            <Text style={styles.totale}>{voce.totale}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1a1a2e" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#333"
  },
  backBtn: { width: 80 },
  backText: { color: "#7eb8ff", fontSize: 14 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  content: { padding: 16, paddingBottom: 32 },
  subtitle: { color: "#aaa", fontSize: 13, marginBottom: 16, lineHeight: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#252540",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 8
  },
  rank: { color: "#888", width: 24, fontWeight: "600" },
  emoji: { fontSize: 24 },
  col: { flex: 1 },
  nome: { color: "#fff", fontWeight: "600", fontSize: 15 },
  dettaglio: { color: "#aaa", fontSize: 12, marginTop: 2 },
  totale: { color: "#ffd700", fontWeight: "700", fontSize: 16 }
});
