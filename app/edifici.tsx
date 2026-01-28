import React, { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import type { Edificio } from "../src/types";
import { EdificioInfoModal } from "../src/ui/EdificioInfoModal";

export default function EdificiScreen() {
  const router = useRouter();
  const { edifici } = useGameContext();
  const [selectedEdificio, setSelectedEdificio] = useState<Edificio | null>(null);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>Edifici</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {edifici.map((e: Edificio) => (
          <Pressable
            key={e.id}
            style={styles.card}
            onPress={() => {
              if (e.nome === "Serra Idroponica Alpha") {
                router.push("/serra");
              } else {
                setSelectedEdificio(e);
              }
            }}
          >
            <Text style={styles.emoji}>{e.emoji}</Text>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{e.nome}</Text>
              <Text style={styles.cardTipo}>{e.tipo}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <EdificioInfoModal
        visible={selectedEdificio !== null}
        edificio={selectedEdificio}
        onClose={() => setSelectedEdificio(null)}
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
  cardTipo: {
    color: "#93c5fd",
    fontSize: 14
  }
});
