import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

export default function FelicitaScreen() {
  const router = useRouter();
  const { abitanti, calcolaFelicitàModificata } = useGameContext();

  const n = abitanti.length;
  const felicitàMedia = n ? Math.round(abitanti.reduce((s, a) => s + calcolaFelicitàModificata(a), 0) / n) : 0;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>😊 Felicità</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.mediaCard}>
          <Text style={styles.mediaLabel}>Felicità media (colonia)</Text>
          <Text style={styles.mediaValue}>{felicitàMedia}%</Text>
          <Text style={styles.mediaSubtext}>
            Calcolata sulla felicità modificata di ogni abitante ({n} abitanti).
          </Text>
        </View>

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
            <Text style={styles.modText}>Se la <Text style={styles.modBold}>felicità modificata</Text> è ≤ 10 e l’abitante ha almeno 100 crediti, e il divieto di espatrio non è attivo, c’è il 50% di probabilità ogni mese che l’abitante emigri (venga rimosso dalla colonia).</Text>
          </View>
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
    padding: 16,
    paddingBottom: 24
  },
  mediaCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    alignItems: "center"
  },
  mediaLabel: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  mediaValue: {
    color: "#4ade80",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4
  },
  mediaSubtext: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10
  },
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
