import React, { useState } from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import type { Edificio } from "../src/types";
import { EdificioInfoModal } from "../src/ui/EdificioInfoModal";

export default function EdificiScreen() {
  const router = useRouter();
  const { edifici } = useGameContext();
  const [selectedEdificio, setSelectedEdificio] = useState<Edificio | null>(null);

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
        <Text style={styles.title}>Edifici</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.grid}>
          {edifici.map((e: Edificio) => (
            <Pressable
              key={e.id}
              style={styles.card}
              onPress={() => {
                if (e.nome === "Serra Idroponica Alpha") {
                  router.push("/serra");
                } else if (e.nome === "Scuola") {
                  router.push("/scuola");
                } else if (e.nome === "Ospedale Coloniale") {
                  router.push("/ospedale");
                } else if (e.nome === "Tribunale") {
                  router.push("/tribunale");
                } else {
                  setSelectedEdificio(e);
                }
              }}
            >
              <Text style={styles.emoji}>{e.emoji}</Text>
              <Text style={styles.cardTitle}>{e.nome}</Text>
              <Text style={styles.cardTipo}>{e.tipo}</Text>
            </Pressable>
          ))}
        </View>
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)"
  },
  back: {
    color: "#93c5fd",
    fontSize: 12
  },
  title: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700"
  },
  content: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    paddingBottom: 6,
    flex: 1
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    width: "23.5%",
    minWidth: 100
  },
  emoji: {
    fontSize: 24,
    marginBottom: 2
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 1,
    textAlign: "center"
  },
  cardTipo: {
    color: "#93c5fd",
    fontSize: 8,
    textAlign: "center"
  }
});
