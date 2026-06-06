import React from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { fazioniData } from "../kingdomData";
import { useGameContext } from "../context/GameContext";
import type { Abitante } from "../types";

export default function GridGame() {
  const router = useRouter();
  const { abitanti, edifici, abitantiProposti } = useGameContext();

  const criminali = abitanti.filter((a: Abitante) => (a.reati?.length ?? 0) > 0);
  const personalitàUniche = Array.from(new Set(abitanti.map((a: Abitante) => a.personalità))).filter(Boolean);
  const fazioni = fazioniData;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;

  const contentWrapStyle = isDesktop ? [styles.scrollContent, styles.contentWrapDesktop] : styles.scrollContent;

  return (
    <ScrollView style={styles.container} contentContainerStyle={contentWrapStyle} showsVerticalScrollIndicator={false}>
      {/* Navigazione: Colonia */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>🏘️ Colonia</Text>
        <View style={[styles.navGrid, isDesktop && styles.navGridWide]}>
          <Pressable style={[styles.navCard, isDesktop && styles.navCardWide]} onPress={() => router.push("/fazioni")}>
            <Text style={styles.navEmoji}>⚔️</Text>
            <Text style={styles.navLabel}>Fazioni</Text>
            <Text style={styles.navMeta}>{fazioni.length}</Text>
          </Pressable>
          <Pressable style={[styles.navCard, isDesktop && styles.navCardWide]} onPress={() => router.push("/edifici")}>
            <Text style={styles.navEmoji}>🏗️</Text>
            <Text style={styles.navLabel}>Edifici</Text>
            <Text style={styles.navMeta}>{edifici.length}</Text>
          </Pressable>
          <Pressable style={[styles.navCard, isDesktop && styles.navCardWide]} onPress={() => router.push("/ricchezza")}>
            <Text style={styles.navEmoji}>💎</Text>
            <Text style={styles.navLabel}>Ricchezza</Text>
            <Text style={styles.navMeta}>{abitanti.length}</Text>
          </Pressable>
          <Pressable style={[styles.navCard, isDesktop && styles.navCardWide]} onPress={() => router.push("/")}>
            <Text style={styles.navEmoji}>🗺️</Text>
            <Text style={styles.navLabel}>Mappa</Text>
          </Pressable>
        </View>
      </View>

      {/* Navigazione: Leggi e ordine */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>📜 Leggi e ordine</Text>
        <View style={[styles.navGrid, isDesktop && styles.navGridWide]}>
          <Pressable style={[styles.navCard, isDesktop && styles.navCardWide]} onPress={() => router.push("/amministrazione")}>
            <Text style={styles.navEmoji}>🏛️</Text>
            <Text style={styles.navLabel}>Amministrazione</Text>
          </Pressable>
          <Pressable style={[styles.navCard, isDesktop && styles.navCardWide]} onPress={() => router.push("/crimine")}>
            <Text style={styles.navEmoji}>🕵️</Text>
            <Text style={styles.navLabel}>Crimine</Text>
            <Text style={styles.navMeta}>{criminali.length}</Text>
          </Pressable>
          <Pressable style={[styles.navCard, isDesktop && styles.navCardWide]} onPress={() => router.push("/regole")}>
            <Text style={styles.navEmoji}>📋</Text>
            <Text style={styles.navLabel}>Regole</Text>
          </Pressable>
        </View>
      </View>

      {/* Navigazione: Altro */}
      <View style={[styles.block, styles.blockLast]}>
        <Text style={styles.blockTitle}>🌐 Altro</Text>
        <View style={[styles.navGrid, isDesktop && styles.navGridWide]}>
          <Pressable style={[styles.navCard, isDesktop && styles.navCardWide]} onPress={() => router.push("/personalita")}>
            <Text style={styles.navEmoji}>🧠</Text>
            <Text style={styles.navLabel}>Personalità</Text>
            <Text style={styles.navMeta}>{personalitàUniche.length}</Text>
          </Pressable>
          <Pressable style={[styles.navCard, isDesktop && styles.navCardWide]} onPress={() => router.push("/casta")}>
            <Text style={styles.navEmoji}>🏛️</Text>
            <Text style={styles.navLabel}>Casta</Text>
          </Pressable>
          <Pressable style={[styles.navCard, isDesktop && styles.navCardWide]} onPress={() => router.push("/competenze")}>
            <Text style={styles.navEmoji}>📊</Text>
            <Text style={styles.navLabel}>Competenze</Text>
          </Pressable>
          <Pressable style={[styles.navCard, isDesktop && styles.navCardWide]} onPress={() => router.push("/eventi")}>
            <Text style={styles.navEmoji}>📌</Text>
            <Text style={styles.navLabel}>Eventi</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1a"
  },
  scrollContent: {
    paddingBottom: 28,
    paddingHorizontal: 14
  },
  contentWrapDesktop: {
    maxWidth: 440,
    alignSelf: "center",
    width: "100%"
  },
  block: {
    marginBottom: 20
  },
  blockLast: { marginBottom: 12 },
  blockTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(248,250,252,0.9)",
    marginBottom: 10,
    letterSpacing: 0.3
  },
  navGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  navGridWide: {
    gap: 12
  },
  navCard: {
    width: "47%",
    minHeight: 72,
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 12,
    padding: 12,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)"
  },
  navCardWide: {
    width: "31%"
  },
  navEmoji: { fontSize: 24, marginBottom: 4 },
  navLabel: { fontSize: 12, fontWeight: "700", color: "#e2e8f0" },
  navMeta: { fontSize: 10, color: "rgba(148,163,184,0.85)", marginTop: 2 },
  navMetaWarn: { color: "#f87171", fontWeight: "700" }
});
