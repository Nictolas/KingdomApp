import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";

export default function FelicitaScreen() {
  const router = useRouter();
  const { abitanti, calcolaFelicitàModificata } = useGameContext();

  const abitantiConFelicità = abitanti.filter((a) => a.razza !== "Golem");
  const n = abitantiConFelicità.length;
  const felicitàMedia = n ? Math.round(abitantiConFelicità.reduce((s, a) => s + calcolaFelicitàModificata(a), 0) / n) : 0;

  const classificaAbitanti = [...abitanti]
    .filter((a) => a.razza !== "Golem")
    .map((a) => ({ abitante: a, felicità: calcolaFelicitàModificata(a) }))
    .sort((x, y) => y.felicità - x.felicità);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>😊 Felicità</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={true}>
        <View style={[styles.mainRow, !isDesktop && styles.mainRowStack]}>
          {/* Sinistra: Totale + Classifica abitanti */}
          <View style={[styles.leftCol, !isDesktop && styles.leftColFull]}>
            <Text style={styles.sectionTitle}>Totale</Text>
            <View style={styles.totaleCard}>
              <Text style={styles.totaleLabel}>Felicità media (regno)</Text>
              <Text style={styles.totaleValue}>{felicitàMedia}%</Text>
              <Text style={styles.totaleSubtext}>
                Calcolata sulla felicità modificata degli abitanti non Golem ({n} abitanti).
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Classifica abitanti</Text>
            <View style={styles.classificaCard}>
              {classificaAbitanti.length === 0 ? (
                <Text style={styles.classificaVuota}>Nessun abitante</Text>
              ) : (
                classificaAbitanti.map(({ abitante, felicità }, i) => (
                  <View key={abitante.id} style={styles.rigaAbitante}>
                    <Text style={styles.rigaPos}>{i + 1}.</Text>
                    <Text style={styles.rigaEmoji}>{getEmojiAbitante(abitante)}</Text>
                    <View style={styles.rigaTesto}>
                      <Text style={styles.rigaNome} numberOfLines={1}>
                        {abitante.nome}
                      </Text>
                      <Text style={styles.rigaValore}>{felicità}%</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>

          {/* Destra: Modificatori */}
          <View style={[styles.rightCol, !isDesktop && styles.rightColFull]}>
            <Text style={styles.sectionTitle}>Modificatori di Felicità (nel codice)</Text>
            <Text style={styles.sectionIntro}>
              La felicità di ogni abitante è un valore base 1–100. I seguenti modificatori si applicano in base a politica religiosa, leggi e eventi.
            </Text>

            <View style={styles.modCard}>
          <Text style={styles.modTitle}>1. Politica religiosa (useGameState → calcolaFelicitàModificata)</Text>
          <View style={styles.modItem}>
            <Text style={styles.modBullet}>•</Text>
            <Text style={styles.modText}><Text style={styles.modBold}>Ateismo di Stato:</Text> abitanti con religione "Ateo" +10% felicità.</Text>
          </View>
          <View style={styles.modItem}>
            <Text style={styles.modBullet}>•</Text>
            <Text style={styles.modText}><Text style={styles.modBold}>Libertà di culto:</Text> abitanti "Deista" +10% felicità.</Text>
          </View>
          <View style={styles.modItem}>
            <Text style={styles.modBullet}>•</Text>
            <Text style={styles.modText}><Text style={styles.modBold}>Religione di Stato:</Text> abitanti della religione di stato +20% felicità; tutti gli altri -10%.</Text>
          </View>
        </View>

        <View style={styles.modCard}>
          <Text style={styles.modTitle}>2. Mafia e legge droghe (useGameState → calcolaFelicitàModificata)</Text>
          <View style={styles.modItem}>
            <Text style={styles.modBullet}>•</Text>
            <Text style={styles.modText}>Abitanti in fazione <Text style={styles.modBold}>Mafia</Text> +10% felicità se la legge droghe è <Text style={styles.modBold}>"vietate"</Text>.</Text>
          </View>
        </View>

        <View style={styles.modCard}>
          <Text style={styles.modTitle}>3. Limite (useGameState → calcolaFelicitàModificata)</Text>
          <View style={styles.modItem}>
            <Text style={styles.modBullet}>•</Text>
            <Text style={styles.modText}>La felicità modificata è sempre compresa tra <Text style={styles.modBold}>1 e 100</Text>.</Text>
          </View>
        </View>

        <View style={styles.modCard}>
          <Text style={styles.modTitle}>4. Eventi (eventi.ts)</Text>
          <View style={styles.modItem}>
            <Text style={styles.modBullet}>•</Text>
            <Text style={styles.modText}><Text style={styles.modBold}>Proteste degli Autoctoni:</Text> ogni mese per la durata dell’evento, tutti gli abitanti -3 felicità (sulla base, non sulla modificata). Si attiva se la felicità media (base) è &lt; 45%.</Text>
          </View>
          <View style={styles.modItem}>
            <Text style={styles.modBullet}>•</Text>
            <Text style={styles.modText}><Text style={styles.modBold}>Assimilazione:</Text> l’evento può attivarsi solo se la felicità media (base) degli abitanti è &gt; 80%.</Text>
          </View>
        </View>

        <View style={styles.modCard}>
          <Text style={styles.modTitle}>5. Emigrazione (avanzaMese.ts)</Text>
          <View style={styles.modItem}>
            <Text style={styles.modBullet}>•</Text>
            <Text style={styles.modText}>Se la <Text style={styles.modBold}>felicità modificata</Text> è ≤ 10 e l’abitante ha almeno 100 crediti, e il divieto di espatrio non è attivo, c’è il 50% di probabilità ogni mese che l’abitante emigri (venga rimosso dal regno).</Text>
          </View>
        </View>
          </View>
        </View>
      </ScrollView>
    </View>
    <View style={styles.footer}>
      <Text style={styles.back} onPress={() => router.back()}>← Home</Text>
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
  mainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16
  },
  mainRowStack: { flexDirection: "column" },
  leftCol: { width: 260, minWidth: 220 },
  leftColFull: { width: "100%" },
  rightCol: { flex: 1, minWidth: 0 },
  rightColFull: { width: "100%" },
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
  rigaTesto: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rigaNome: { color: "#e5e7eb", fontSize: 11, fontWeight: "500", flex: 1 },
  rigaValore: { color: "#4ade80", fontSize: 11, fontWeight: "600" },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8
  },
  sectionIntro: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 11,
    marginBottom: 16,
    lineHeight: 16
  },
  modCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  modTitle: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 10
  },
  modItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6
  },
  modBullet: {
    color: "#93c5fd",
    fontSize: 12,
    marginRight: 8
  },
  modText: {
    color: "#e5e7eb",
    fontSize: 11,
    flex: 1,
    lineHeight: 16
  },
  modBold: {
    fontWeight: "700",
    color: "#f1f5f9"
  }
});
