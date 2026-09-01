import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

export default function ObiettiviScreen() {
  const router = useRouter();
  const { width } = Dimensions.get("window");
  const maxHeight = width > 768 ? width * (9 / 16) : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight != null ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🎯 Obiettivi</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.emoji}>⛲</Text>
          <View style={styles.info}>
            <Text style={styles.cardTitle}>Fonte della Giovinezza</Text>
            <Text style={styles.description}>Se il Re la trova non muore più di vecchiaia.</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>← Menu</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050816" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)"
  },
  title: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  content: { padding: 16 },
  card: {
    flexDirection: "row",
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.45)"
  },
  emoji: { fontSize: 28, marginRight: 12 },
  info: { flex: 1 },
  cardTitle: { color: "#e5e7eb", fontSize: 13, fontWeight: "700", marginBottom: 5 },
  description: { color: "rgba(203,213,245,0.8)", fontSize: 11, lineHeight: 16 },
  footer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.6)"
  },
  back: { color: "#93c5fd", fontSize: 12 }
});
