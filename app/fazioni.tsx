import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { fazioniData } from "../src/kingdomData";
import type { Fazione } from "../src/types";

export default function FazioniScreen() {
  const router = useRouter();
  const fazioni = fazioniData;

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
          <View key={f.id} style={styles.card}>
            <Text style={styles.cardTitle}>{f.nome}</Text>
            <Text style={styles.line}>{f.descrizione}</Text>
          </View>
        ))}
      </ScrollView>
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
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4
  },
  line: {
    color: "#cbd5f5",
    fontSize: 13
  }
});

