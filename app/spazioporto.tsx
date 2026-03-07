import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

export default function SpazioportoScreen() {
  const router = useRouter();
  const { edifici } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const spazioporto = edifici.find((e) => e.nome === "Spazioporto");

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Edifici
        </Text>
        <Text style={styles.title}>🚀 Spazioporto</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Spazioporto</Text>
          {spazioporto && (
            <Text style={styles.infoText}>
              Capacità: {spazioporto.occupazione ?? 0}/{spazioporto.capacità ?? 15} · Stato: {spazioporto.stato ?? "Operativo"}
            </Text>
          )}
          <Text style={styles.infoSubtext}>
            Base per arrivi e partenze di navi e coloni. Gestisce immigrazione e collegamenti con altri pianeti.
          </Text>
        </View>

        <View style={styles.linksSection}>
          <Text style={styles.sectionTitle}>Collegamenti</Text>
          <Pressable style={styles.linkCard} onPress={() => router.push("/immigrazione")}>
            <Text style={styles.linkEmoji}>🛂</Text>
            <View style={styles.linkContent}>
              <Text style={styles.linkTitle}>Immigrazione</Text>
              <Text style={styles.linkDesc}>Candidati in attesa di entrare in colonia</Text>
            </View>
          </Pressable>
          <Pressable style={styles.linkCard} onPress={() => router.push("/pianeti")}>
            <Text style={styles.linkEmoji}>🪐</Text>
            <View style={styles.linkContent}>
              <Text style={styles.linkTitle}>Pianeti</Text>
              <Text style={styles.linkDesc}>Origini e collegamenti con altri mondi</Text>
            </View>
          </Pressable>
        </View>
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
    paddingVertical: 8,
    paddingBottom: 12
  },
  infoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  infoTitle: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6
  },
  infoText: {
    color: "#93c5fd",
    fontSize: 12,
    marginBottom: 6
  },
  infoSubtext: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 11,
    lineHeight: 18
  },
  linksSection: {
    marginBottom: 12
  },
  sectionTitle: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  linkEmoji: {
    fontSize: 28,
    marginRight: 12
  },
  linkContent: {
    flex: 1
  },
  linkTitle: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2
  },
  linkDesc: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 11
  }
});
