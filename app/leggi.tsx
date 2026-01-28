import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { leggiData } from "../src/kingdomData";
import type { Legge } from "../src/types";

export default function LeggiScreen() {
  const router = useRouter();
  const leggi = leggiData;

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
        <Text style={styles.title}>Leggi</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {leggi.map((l: Legge) => {
          const isTassaReddito = l.titolo === "Tassa sul Reddito";
          return (
            <Pressable
              key={l.id}
              style={styles.card}
              onPress={isTassaReddito ? () => router.push("/tassa-reddito") : undefined}
              disabled={!isTassaReddito}
            >
              <Text style={styles.cardTitle}>{l.titolo}</Text>
              <Text style={styles.line}>{l.descrizione}</Text>
              <Text style={styles.chip}>
                Stato:{" "}
                <Text
                  style={[
                    styles.chipValue,
                    l.stato === "In vigore" && styles.chipActive,
                    l.stato === "Proposta" && styles.chipProposed,
                    l.stato === "Abrogata" && styles.chipRepealed
                  ]}
                >
                  {l.stato}
                </Text>
              </Text>
            </Pressable>
          );
        })}
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
    gap: 6,
    flex: 1
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 3
  },
  line: {
    color: "#cbd5f5",
    fontSize: 11
  },
  chip: {
    marginTop: 4,
    color: "#e5e7eb",
    fontSize: 11
  },
  chipValue: {
    fontWeight: "700"
  },
  chipActive: {
    color: "#4ade80"
  },
  chipProposed: {
    color: "#fde047"
  },
  chipRepealed: {
    color: "#f97373"
  }
});

