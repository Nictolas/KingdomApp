import React from "react";
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { fazioniData, leggiData } from "../kingdomData";
import { useGameContext } from "../context/GameContext";
import type { Risorsa, Abitante } from "../types";

export default function GridGame() {
  const router = useRouter();
  const { abitanti, risorse, edifici, mese, anno, isLoading, avanzaMese } = useGameContext();

  const ministriAttuali = abitanti.filter((a: Abitante) => a.ministero);
  const fazioni = fazioniData;
  const leggi = leggiData;

  // Calcola dimensioni 16:9 su PC
  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <View style={[styles.container, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.gameTitle}>MyKingdom</Text>
          <Text style={styles.subtitle}>Gestisci la tua colonia</Text>
          <Text style={styles.meseLabel}>Mese {mese} - Anno {anno}</Text>
        </View>
      </View>

      <View style={styles.skipContainer}>
        <Pressable
          style={[styles.skipButton, isLoading && styles.skipButtonDisabled]}
          onPress={avanzaMese}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.skipButtonText}>Caricamento...</Text>
            </>
          ) : (
            <>
              <Text style={styles.skipEmoji}>⏭️</Text>
              <Text style={styles.skipButtonText}>Skip Mese</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.navRow}>
        <Pressable style={styles.navButton} onPress={() => router.push("/abitanti")}>
          <Text style={styles.navEmoji}>👥</Text>
          <Text style={styles.navLabel}>Abitanti</Text>
          <Text style={styles.navCount}>{abitanti.length} totali</Text>
        </Pressable>
        <Pressable style={styles.navButton} onPress={() => router.push("/ministri")}>
          <Text style={styles.navEmoji}>🏛️</Text>
          <Text style={styles.navLabel}>Ministri</Text>
          <Text style={styles.navCount}>{ministriAttuali.length} in carica</Text>
        </Pressable>
      </View>
      <View style={styles.navRow}>
        <Pressable style={styles.navButton} onPress={() => router.push("/fazioni")}>
          <Text style={styles.navEmoji}>⚔️</Text>
          <Text style={styles.navLabel}>Fazioni</Text>
          <Text style={styles.navCount}>{fazioni.length} attive</Text>
        </Pressable>
        <Pressable style={styles.navButton} onPress={() => router.push("/leggi")}>
          <Text style={styles.navEmoji}>📜</Text>
          <Text style={styles.navLabel}>Leggi</Text>
          <Text style={styles.navCount}>{leggi.length} totali</Text>
        </Pressable>
      </View>
      <View style={styles.navRow}>
        <Pressable style={styles.navButton} onPress={() => router.push("/edifici")}>
          <Text style={styles.navEmoji}>🏗️</Text>
          <Text style={styles.navLabel}>Edifici</Text>
          <Text style={styles.navCount}>{edifici.length} strutture</Text>
        </Pressable>
        <Pressable style={styles.navButton} onPress={() => router.push("/diario")}>
          <Text style={styles.navEmoji}>📖</Text>
          <Text style={styles.navLabel}>Diario</Text>
          <Text style={styles.navCount}>Storia</Text>
        </Pressable>
      </View>

      <View style={styles.scrollContent}>
        {/* Risorse */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Risorse</Text>
          <View style={styles.resourcesGrid}>
            {risorse.map((r: Risorsa) => (
              <View key={r.id} style={styles.resourceCard}>
                <Text style={styles.resourceName}>{r.nome}</Text>
                <Text style={styles.resourceValue}>
                  {r.quantità} <Text style={styles.resourceUnit}>{r.unità}</Text>
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050816"
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 2,
    gap: 8
  },
  navButton: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  navEmoji: {
    fontSize: 16,
    marginBottom: 2
  },
  navLabel: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700"
  },
  navCount: {
    color: "rgba(148,163,184,0.9)",
    fontSize: 9,
    marginTop: 1
  },
  header: {
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#050816"
  },
  gameTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800"
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    marginTop: 1
  },
  meseLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    marginTop: 2
  },
  skipContainer: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 2
  },
  skipButton: {
    backgroundColor: "rgba(59,130,246,0.9)",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  skipButtonDisabled: {
    backgroundColor: "rgba(59,130,246,0.5)",
    opacity: 0.7
  },
  skipEmoji: {
    fontSize: 14,
    marginRight: 6
  },
  skipButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700"
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
    flex: 1
  },
  section: {
    marginBottom: 6
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4
  },
  resourcesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  resourceCard: {
    flex: 1,
    minWidth: "48%",
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  resourceName: {
    color: "#e5e7eb",
    fontSize: 10,
    marginBottom: 2
  },
  resourceValue: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700"
  },
  resourceUnit: {
    color: "rgba(148,163,184,0.9)",
    fontWeight: "500"
  }
});

