import React, { useState } from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { fazioniData } from "../src/kingdomData";
import type { Fazione } from "../src/types";
import { FazioneInfoModal } from "../src/ui/FazioneInfoModal";

export default function FazioniScreen() {
  const router = useRouter();
  const { abitanti } = useGameContext();
  const fazioni = fazioniData;
  const [selectedFazione, setSelectedFazione] = useState<Fazione | null>(null);

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
        <Text style={styles.title}>Fazioni</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.grid}>
          {fazioni.map((f: Fazione) => (
            <Pressable
              key={f.id}
              style={styles.card}
              onPress={() => {
                if (f.nome === "Mafia") {
                  router.push("/mafia");
                } else {
                  setSelectedFazione(f);
                }
              }}
            >
              <Text style={styles.emoji}>{f.emoji}</Text>
              <Text style={styles.cardTitle}>{f.nome}</Text>
              <Text style={styles.cardDescrizione} numberOfLines={2}>
                {f.descrizione}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <FazioneInfoModal
        visible={selectedFazione !== null}
        fazione={selectedFazione}
        abitanti={abitanti}
        onClose={() => setSelectedFazione(null)}
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    paddingBottom: 8,
    flex: 1
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    width: "48%",
    minWidth: 140
  },
  emoji: {
    fontSize: 32,
    marginBottom: 4
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
    textAlign: "center"
  },
  cardDescrizione: {
    color: "#cbd5f5",
    fontSize: 10,
    textAlign: "center"
  }
});

