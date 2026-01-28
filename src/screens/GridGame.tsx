import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { formatGameTime, useGameClock } from "../game/gameClock";
import { abitantiData, ministriData, fazioniData, leggiData, risorseData } from "../kingdomData";
import type { Abitante, Ministro, Fazione, Legge, Risorsa } from "../types";

export default function GridGame() {
  const { gameTime } = useGameClock(6, 0);
  const router = useRouter();

  const abitanti = abitantiData;
  const ministri = ministriData;
  const fazioni = fazioniData;
  const leggi = leggiData;
  const risorse = risorseData;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.gameTitle}>MyKingdom</Text>
          <Text style={styles.subtitle}>Gestisci il tuo regno</Text>
        </View>
        <View style={styles.clockContainer}>
          <Text style={styles.clockLabel}>Ora del regno</Text>
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Abitanti */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Abitanti</Text>
          <Text style={styles.sectionDescription}>
            Elenco delle persone che vivono nel tuo regno.
          </Text>
          <View style={styles.cardsContainer}>
            {abitanti.map((a: Abitante) => (
              <View key={a.id} style={styles.card}>
                <Text style={styles.cardTitle}>{a.nome}</Text>
                <Text style={styles.cardLine}>Ruolo: {a.ruolo}</Text>
                <Text style={styles.cardLine}>Età: {a.eta}</Text>
                <Text style={styles.cardLine}>Fazione: {a.fazione}</Text>
                {a.èMinistro && <Text style={styles.tag}>Ministro</Text>}
              </View>
            ))}
          </View>
        </View>

        {/* Ministri */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ministri</Text>
          <Text style={styles.sectionDescription}>
            I tuoi collaboratori più fidati che gestiscono i vari aspetti del regno.
          </Text>
          <View style={styles.cardsContainer}>
            {ministri.map((m: Ministro) => (
              <View key={m.id} style={styles.card}>
                <Text style={styles.cardTitle}>{m.nome}</Text>
                <Text style={styles.cardLine}>Ministero: {m.ministero}</Text>
                <Text style={styles.cardLine}>Fazione: {m.fazione}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Fazioni */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fazioni</Text>
          <Text style={styles.sectionDescription}>
            Gruppi di interesse che influenzano la politica del regno.
          </Text>
          <View style={styles.cardsContainer}>
            {fazioni.map((f: Fazione) => (
              <View key={f.id} style={styles.card}>
                <Text style={styles.cardTitle}>{f.nome}</Text>
                <Text style={styles.cardLine}>{f.descrizione}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Leggi */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Leggi</Text>
          <Text style={styles.sectionDescription}>
            Decisioni politiche che determinano la vita nel regno.
          </Text>
          <View style={styles.cardsContainer}>
            {leggi.map((l: Legge) => (
              <View key={l.id} style={styles.card}>
                <Text style={styles.cardTitle}>{l.titolo}</Text>
                <Text style={styles.cardLine}>{l.descrizione}</Text>
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
              </View>
            ))}
          </View>
        </View>

        {/* Risorse */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Risorse</Text>
          <Text style={styles.sectionDescription}>
            Ricchezze materiali e immateriali su cui si regge il regno.
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
  card: {
    backgroundColor: "rgba(15,23,42,0.9)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4
  },
  cardLine: {
    color: "#cbd5f5",
    fontSize: 13
  },
  tag: {
    marginTop: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(56,189,248,0.18)",
    color: "#e0f2fe",
    fontSize: 11,
    fontWeight: "600"
  },
  chip: {
    marginTop: 6,
    color: "#e5e7eb",
    fontSize: 13
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

