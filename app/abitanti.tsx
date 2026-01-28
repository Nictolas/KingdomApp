import React, { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import type { Abitante } from "../src/types";
import { AbitanteInfoModal } from "../src/ui/AbitanteInfoModal";

export default function AbitantiScreen() {
  const router = useRouter();
  const { abitanti } = useGameContext();
  const [selectedAbitante, setSelectedAbitante] = useState<Abitante | null>(null);

  const getAbitanteNome = (id: number) => {
    return abitanti.find((a) => a.id === id)?.nome || `ID ${id}`;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>Abitanti</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {abitanti.map((a: Abitante) => (
          <Pressable
            key={a.id}
            style={styles.card}
            onPress={() => setSelectedAbitante(a)}
          >
            <Text style={styles.emoji}>{a.emoji}</Text>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{a.nome}</Text>
              <Text style={styles.cardLavoro}>{a.lavoro}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <AbitanteInfoModal
        visible={selectedAbitante !== null}
        abitante={selectedAbitante}
        onClose={() => setSelectedAbitante(null)}
        getAbitanteNome={getAbitanteNome}
      />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)"
  },
  back: {
    color: "#93c5fd",
    fontSize: 14
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700"
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 32,
    gap: 10
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  emoji: {
    fontSize: 40
  },
  cardContent: {
    flex: 1
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4
  },
  cardLavoro: {
    color: "#93c5fd",
    fontSize: 14
  }
});

