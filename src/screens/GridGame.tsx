import React from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { fazioniData } from "../kingdomData";
import { useGameContext } from "../context/GameContext";
import type { Abitante } from "../types";
import { isOccupazioneRimossa } from "../game/lavoriCatalogo";
import { OGGETTI_CATALOGO } from "../data/oggettiCatalogo";
import { tornaAllaMappa } from "../navigation/tornaAllaMappa";

export default function GridGame() {
  const router = useRouter();
  const { abitanti, edifici, abitantiProposti, salvaPartita, saveStatus } = useGameContext();

  const criminali = abitanti.filter((a: Abitante) => (a.reati?.length ?? 0) > 0);
  const personalitàUniche = Array.from(new Set(abitanti.map((a: Abitante) => a.personalità))).filter(Boolean);
  const fazioni = fazioniData;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const isWide = width > 1100;
  const cardStyle = [
    styles.navCard,
    isWide ? styles.navCardXWide : isDesktop ? styles.navCardWide : null
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Navigazione: Regno */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>🏰 Regno</Text>
        <View style={[styles.navGrid, isDesktop && styles.navGridWide]}>
          <Pressable style={cardStyle} onPress={() => router.push("/fazioni")}>
            <Text style={styles.navEmoji}>⚔️</Text>
            <Text style={styles.navLabel}>Fazioni</Text>
            <Text style={styles.navMeta}>{fazioni.length}</Text>
          </Pressable>
          <Pressable style={cardStyle} onPress={() => router.push("/religioni")}>
            <Text style={styles.navEmoji}>⛪</Text>
            <Text style={styles.navLabel}>Religioni</Text>
          </Pressable>
          <Pressable style={cardStyle} onPress={() => router.push("/edifici")}>
            <Text style={styles.navEmoji}>🏗️</Text>
            <Text style={styles.navLabel}>Edifici</Text>
            <Text style={styles.navMeta}>{edifici.length}</Text>
          </Pressable>
          <Pressable style={cardStyle} onPress={() => router.push("/oggetti")}>
            <Text style={styles.navEmoji}>🎒</Text>
            <Text style={styles.navLabel}>Oggetti</Text>
            <Text style={styles.navMeta}>{OGGETTI_CATALOGO.length}</Text>
          </Pressable>
          <Pressable style={cardStyle} onPress={() => router.push("/ricchezza")}>
            <Text style={styles.navEmoji}>💎</Text>
            <Text style={styles.navLabel}>Ricchezza</Text>
            <Text style={styles.navMeta}>{abitanti.length}</Text>
          </Pressable>
          <Pressable style={cardStyle} onPress={() => router.push("/crediti")}>
            <Text style={styles.navEmoji}>📒</Text>
            <Text style={styles.navLabel}>Bilancio</Text>
          </Pressable>
          <Pressable style={cardStyle} onPress={() => router.push("/lavori")}>
            <Text style={styles.navEmoji}>💼</Text>
            <Text style={styles.navLabel}>Lavori</Text>
            <Text style={styles.navMeta}>
              {abitanti.filter((a) => a.razza !== "Golem" && (a.lavoro === "Disoccupato" || isOccupazioneRimossa(a.lavoro))).length} disoccupati
            </Text>
          </Pressable>
          <Pressable style={cardStyle} onPress={() => tornaAllaMappa(router)}>
            <Text style={styles.navEmoji}>🗺️</Text>
            <Text style={styles.navLabel}>Mappa</Text>
          </Pressable>
        </View>
      </View>

      {/* Navigazione: Leggi e ordine */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>📜 Leggi e ordine</Text>
        <View style={[styles.navGrid, isDesktop && styles.navGridWide]}>
          <Pressable style={cardStyle} onPress={() => router.push("/amministrazione")}>
            <Text style={styles.navEmoji}>🏛️</Text>
            <Text style={styles.navLabel}>Amministrazione</Text>
          </Pressable>
          <Pressable style={cardStyle} onPress={() => router.push("/crimine")}>
            <Text style={styles.navEmoji}>🕵️</Text>
            <Text style={styles.navLabel}>Crimine</Text>
            <Text style={styles.navMeta}>{criminali.length}</Text>
          </Pressable>
          <Pressable style={cardStyle} onPress={() => router.push("/regole")}>
            <Text style={styles.navEmoji}>📋</Text>
            <Text style={styles.navLabel}>Regole</Text>
          </Pressable>
        </View>
      </View>

      {/* Navigazione: Altro */}
      <View style={[styles.block, styles.blockLast]}>
        <Text style={styles.blockTitle}>🌐 Altro</Text>
        <View style={[styles.navGrid, isDesktop && styles.navGridWide]}>
          <Pressable style={cardStyle} onPress={() => router.push("/personalita")}>
            <Text style={styles.navEmoji}>🧠</Text>
            <Text style={styles.navLabel}>Personalità</Text>
            <Text style={styles.navMeta}>{personalitàUniche.length}</Text>
          </Pressable>
          <Pressable style={cardStyle} onPress={() => router.push("/casta")}>
            <Text style={styles.navEmoji}>🏛️</Text>
            <Text style={styles.navLabel}>Casta</Text>
          </Pressable>
          <Pressable style={cardStyle} onPress={() => router.push("/competenze")}>
            <Text style={styles.navEmoji}>📊</Text>
            <Text style={styles.navLabel}>Competenze</Text>
          </Pressable>
          <Pressable style={cardStyle} onPress={() => router.push("/eventi")}>
            <Text style={styles.navEmoji}>📌</Text>
            <Text style={styles.navLabel}>Eventi</Text>
          </Pressable>
          <Pressable style={cardStyle} onPress={() => router.push("/razze")}>
            <Text style={styles.navEmoji}>🧬</Text>
            <Text style={styles.navLabel}>Razze</Text>
            <Text style={styles.navMeta}>{new Set(abitanti.map((a) => a.razza ?? "Umano")).size}</Text>
          </Pressable>
          <Pressable style={cardStyle} onPress={() => router.push("/obiettivi")}>
            <Text style={styles.navEmoji}>🎯</Text>
            <Text style={styles.navLabel}>Obiettivi</Text>
            <Text style={styles.navMeta}>1</Text>
          </Pressable>
        </View>
      </View>
      <View style={[styles.block, styles.blockLast]}>
        <Text style={styles.blockTitle}>💾 Partita</Text>
        <Pressable style={cardStyle} onPress={() => void salvaPartita()} disabled={saveStatus === "saving"}>
          <Text style={styles.navEmoji}>💾</Text>
          <Text style={styles.navLabel}>{saveStatus === "saving" ? "Salvataggio…" : "Salva"}</Text>
          {saveStatus === "saved" && <Text style={styles.navMeta}>Partita salvata</Text>}
          {saveStatus === "error" && <Text style={[styles.navMeta, { color: "#fca5a5" }]}>Errore non bloccante</Text>}
        </Pressable>
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
    paddingHorizontal: 14,
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
  navCardXWide: {
    width: "18.5%"
  },
  navEmoji: { fontSize: 24, marginBottom: 4 },
  navLabel: { fontSize: 12, fontWeight: "700", color: "#e2e8f0" },
  navMeta: { fontSize: 10, color: "rgba(148,163,184,0.85)", marginTop: 2 },
  navMetaWarn: { color: "#f87171", fontWeight: "700" }
});
