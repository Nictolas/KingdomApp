import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { formatGameTime, useGameClock } from "../game/gameClock";
import { abitantiData, ministriData, fazioniData, leggiData, risorseData, edificiData } from "../kingdomData";
import type { Risorsa } from "../types";

export default function GridGame() {
  const { gameTime } = useGameClock(6, 0);
  const router = useRouter();

  const abitanti = abitantiData;
  const ministri = ministriData;
  const fazioni = fazioniData;
  const leggi = leggiData;
  const risorse = risorseData;
  const edifici = edificiData;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.gameTitle}>MyKingdom</Text>
          <Text style={styles.subtitle}>Gestisci la tua colonia</Text>
        </View>
        <View style={styles.clockContainer}>
          <Text style={styles.clockLabel}>Ora coloniale</Text>
          <Text style={styles.clockValue}>🕐 {formatGameTime(gameTime)}</Text>
        </View>
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
          <Text style={styles.navCount}>{ministri.length} in carica</Text>
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
        <View style={styles.navButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Risorse */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Risorse</Text>
          <Text style={styles.sectionDescription}>
            Risorse materiali ed energetiche essenziali per la sopravvivenza della colonia.
          </Text>
          <View style={styles.cardsContainer}>
            {risorse.map((r: Risorsa) => (
              <View key={r.id} style={styles.resourceRow}>
                <Text style={styles.resourceName}>{r.nome}</Text>
                <Text style={styles.resourceValue}>
                  {r.quantità} <Text style={styles.resourceUnit}>{r.unità}</Text>
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 12
  },
  navButton: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  navEmoji: {
    fontSize: 22,
    marginBottom: 4
  },
  navLabel: {
    color: "#e5e7eb",
    fontSize: 15,
    fontWeight: "700"
  },
  navCount: {
    color: "rgba(148,163,184,0.9)",
    fontSize: 12,
    marginTop: 2
  },
  header: {
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#050816"
  },
  gameTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800"
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    marginTop: 2
  },
  clockContainer: {
    alignItems: "flex-end"
  },
  clockLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12
  },
  clockValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32
  },
  section: {
    marginBottom: 20
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4
  },
  sectionDescription: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginBottom: 10
  },
  cardsContainer: {
    gap: 10
  },
  resourceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.4)"
  },
  resourceName: {
    color: "#e5e7eb",
    fontSize: 14
  },
  resourceValue: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "700"
  },
  resourceUnit: {
    color: "rgba(148,163,184,0.9)",
    fontWeight: "500"
  }
});

