import React, { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { fazioniData } from "../src/kingdomData";
import type { Fazione } from "../src/types";
import { FazioneInfoModal } from "../src/ui/FazioneInfoModal";

export default function FazioniScreen() {
  const router = useRouter();
  const fazioni = fazioniData;
  const [selectedFazione, setSelectedFazione] = useState<Fazione | null>(null);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>Fazioni</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {fazioni.map((f: Fazione) => (
          <Pressable
            key={f.id}
            style={styles.card}
            onPress={() => setSelectedFazione(f)}
          >
            <Text style={styles.emoji}>{f.emoji}</Text>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{f.nome}</Text>
              <Text style={styles.cardDescrizione} numberOfLines={2}>
                {f.descrizione}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <FazioneInfoModal
        visible={selectedFazione !== null}
        fazione={selectedFazione}
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
  cardDescrizione: {
    color: "#cbd5f5",
    fontSize: 13
  }
});

