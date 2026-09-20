import React, { useMemo, useSyncExternalStore } from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import {
  getGiornoGiocoSnapshot,
  subscribeGiornoGioco
} from "../src/game/orologioGiocoSession";
import {
  calcolaPunteggioSoddisfazione,
  fasciaDaPunteggio
} from "../src/game/soddisfazione";

export default function SoddisfazioneScreen() {
  const router = useRouter();
  const { abitanti, edifici, mese, anno } = useGameContext();
  const giornoGioco = useSyncExternalStore(
    subscribeGiornoGioco,
    getGiornoGiocoSnapshot,
    getGiornoGiocoSnapshot
  );

  const classifica = useMemo(() => {
    return [...abitanti]
      .filter((a) => a.razza !== "Golem")
      .map((a) => {
        const punteggio = calcolaPunteggioSoddisfazione(a, edifici, giornoGioco, mese, anno);
        return {
          abitante: a,
          punteggio,
          fascia: fasciaDaPunteggio(punteggio)
        };
      })
      .sort((x, y) => y.punteggio - x.punteggio);
  }, [abitanti, edifici, giornoGioco, mese, anno]);

  const n = classifica.length;
  const media =
    n > 0 ? Math.round((classifica.reduce((s, row) => s + row.punteggio, 0) / n) * 10) / 10 : 0;
  const fasciaMedia = fasciaDaPunteggio(media);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight != null ? { maxHeight, overflow: "hidden" as const } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>😌 Soddisfazione</Text>
        <Text style={styles.rulesLink} onPress={() => router.push("/regole-soddisfazione")}>
          Regole
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          <Text style={styles.sectionTitle}>Totale</Text>
          <View style={styles.totaleCard}>
            <Text style={styles.totaleLabel}>Soddisfazione media (regno)</Text>
            <Text style={styles.totaleValue}>{media}</Text>
            <Text style={styles.totaleSubtext}>
              Fascia media: {fasciaMedia} · su {n} abitanti non Golem
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Classifica abitanti</Text>
          <View style={styles.classificaCard}>
            {classifica.length === 0 ? (
              <Text style={styles.classificaVuota}>Nessun abitante</Text>
            ) : (
              classifica.map(({ abitante, punteggio, fascia }, i) => (
                <View key={abitante.id} style={styles.rigaAbitante}>
                  <Text style={styles.rigaPos}>{i + 1}.</Text>
                  <Text style={styles.rigaEmoji}>{getEmojiAbitante(abitante)}</Text>
                  <View style={styles.rigaTesto}>
                    <Text style={styles.rigaNome} numberOfLines={1}>
                      {abitante.nome}
                    </Text>
                    <Text style={styles.rigaValore}>
                      {punteggio} · {fascia}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
      </View>
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
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.6)"
  },
  back: {
    color: "#93c5fd",
    fontSize: 12
  },
  rulesLink: {
    color: "#93c5fd",
    fontSize: 12,
    width: 50,
    textAlign: "right"
  },
  title: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700"
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 16,
    flexGrow: 1
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8
  },
  totaleCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    alignItems: "center"
  },
  totaleLabel: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  totaleValue: {
    color: "#4ade80",
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 4
  },
  totaleSubtext: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    textAlign: "center"
  },
  classificaCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  classificaVuota: {
    color: "rgba(203,213,245,0.4)",
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12
  },
  rigaAbitante: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.2)"
  },
  rigaPos: {
    color: "rgba(203,213,245,0.6)",
    fontSize: 10,
    width: 20,
    marginRight: 4
  },
  rigaEmoji: { fontSize: 16, marginRight: 6 },
  rigaTesto: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  rigaNome: { color: "#e5e7eb", fontSize: 11, fontWeight: "500", flex: 1 },
  rigaValore: { color: "#4ade80", fontSize: 11, fontWeight: "600", marginLeft: 8 }
});
