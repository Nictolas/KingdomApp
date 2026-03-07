import React from "react";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { fazioniData } from "../kingdomData";
import { useGameContext } from "../context/GameContext";
import type { Abitante } from "../types";

export default function GridGame() {
  const router = useRouter();
  const { abitanti, edifici, mese, anno, isLoading, avanzaMese, abitantiProposti } = useGameContext();

  const criminali = abitanti.filter((a: Abitante) => (a.reati?.length ?? 0) > 0);
  const personalitàUniche = Array.from(new Set(abitanti.map((a: Abitante) => a.personalità))).filter(Boolean);
  const fazioni = fazioniData;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;

  const contentWrapStyle = isDesktop ? [styles.scrollContent, styles.contentWrapDesktop] : styles.scrollContent;

  return (
    <ScrollView style={styles.container} contentContainerStyle={contentWrapStyle} showsVerticalScrollIndicator={false}>
      {/* Hero header */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.titleBlock}>
            <Text style={styles.heroEmoji}>🏰</Text>
            <View>
              <Text style={styles.heroTitle}>MyKingdom</Text>
              <Text style={styles.heroSubtitle}>Gestisci la tua colonia</Text>
            </View>
          </View>
          <View style={styles.heroActions}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>📅 Mese {mese}</Text>
              <Text style={styles.badgeText}>· Anno {anno}</Text>
            </View>
            <Pressable style={styles.diarioBtn} onPress={() => router.push("/diario")}>
              <Text style={styles.diarioBtnEmoji}>📖</Text>
              <Text style={styles.diarioBtnLabel}>Diario</Text>
            </Pressable>
          </View>
        </View>
        <Pressable
          style={[styles.skipBtn, isLoading && styles.skipBtnDisabled]}
          onPress={avanzaMese}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.skipBtnText}>Caricamento...</Text>
            </>
          ) : (
            <>
              <Text style={styles.skipBtnEmoji}>⏭️</Text>
              <Text style={styles.skipBtnText}>Skip Mese</Text>
            </>
          )}
        </Pressable>
      </View>

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
          <Pressable style={[styles.navCard, isDesktop && styles.navCardWide]} onPress={() => router.push("/mappa")}>
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
  hero: {
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.12)",
    marginBottom: 18
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14
  },
  titleBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  heroEmoji: {
    fontSize: 42,
    textShadowColor: "rgba(251,191,36,0.3)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#f8fafc",
    letterSpacing: 0.5
  },
  heroSubtitle: {
    fontSize: 13,
    color: "rgba(248,250,252,0.65)",
    marginTop: 2
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30,41,59,0.8)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: 4
  },
  badgeText: {
    fontSize: 11,
    color: "rgba(248,250,252,0.85)",
    fontWeight: "600"
  },
  diarioBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(51,65,85,0.6)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    gap: 6
  },
  diarioBtnEmoji: { fontSize: 14 },
  diarioBtnLabel: { fontSize: 12, fontWeight: "600", color: "#e2e8f0" },
  skipBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.5)"
  },
  skipBtnDisabled: {
    backgroundColor: "rgba(37,99,235,0.5)",
    opacity: 0.9
  },
  skipBtnEmoji: { fontSize: 20 },
  skipBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },

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
