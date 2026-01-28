import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ministriData } from "../src/kingdomData";
import type { Ministro } from "../src/types";

export default function MinistriScreen() {
  const router = useRouter();
  const ministri = ministriData;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>Ministri</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {ministri.map((m: Ministro) => (
          <View key={m.id} style={styles.card}>
            <Text style={styles.cardTitle}>{m.nome}</Text>
            <Text style={styles.line}>Ministero: {m.ministero}</Text>
            <Text style={styles.line}>Fazione: {m.fazione}</Text>
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

