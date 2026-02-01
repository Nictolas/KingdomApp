import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

type Fattore = {
  id: string;
  emoji: string;
  titolo: string;
  descrizione: string;
  punti: number;
  attivo: boolean;
};

export default function SanzioniScreen() {
  const router = useRouter();
  const {
    punteggioSanzioni,
    abitanti,
    penaDiMorteAttiva,
    razzaCampoLavoro,
    razzaCampoSterminio,
    etaMinimaLavoro,
    divietoEspatrioAttivo
  } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const haSchiavitu = abitanti.some((a) => a.ruoloSchiavitu === "schiavista" || a.ruoloSchiavitu === "schiavo");
  const etaBassa = etaMinimaLavoro <= 13;

  const fattori: Fattore[] = [
    { id: "base", emoji: "📋", titolo: "Punteggio base", descrizione: "Valore iniziale", punti: 1, attivo: true },
    { id: "schiavitu", emoji: "🔗", titolo: "Schiavitù", descrizione: "Presenza di schiavisti o schiavi", punti: 1, attivo: haSchiavitu },
    { id: "pena", emoji: "⚰️", titolo: "Pena di morte", descrizione: "Pena di morte attiva", punti: 1, attivo: penaDiMorteAttiva },
    { id: "campoLavoro", emoji: "⛏️", titolo: "Campo di lavoro", descrizione: "Legge razziale: lavoro forzato per una razza", punti: 1, attivo: razzaCampoLavoro !== null },
    { id: "campoSterminio", emoji: "☠️", titolo: "Campo di sterminio", descrizione: "Legge razziale: sterminio per una razza", punti: 1, attivo: razzaCampoSterminio !== null },
    { id: "eta", emoji: "👶", titolo: "Età minima lavoro ≤13", descrizione: "Lavoro minorile sotto i 14 anni", punti: 1, attivo: etaBassa },
    { id: "espatrio", emoji: "🚫", titolo: "Divieto di espatrio", descrizione: "Divieto di espatrio attivo", punti: 1, attivo: divietoEspatrioAttivo }
  ];

  const attivi = fattori.filter((f) => f.attivo);
  const nonAttivi = fattori.filter((f) => !f.attivo);

  const haSanzioni = punteggioSanzioni >= 5;
  const livelloRischio =
    punteggioSanzioni >= 8 ? "Critico" : punteggioSanzioni >= 5 ? "Alto" : punteggioSanzioni >= 3 ? "Medio" : "Basso";
  const coloreRischio =
    punteggioSanzioni >= 8 ? "#ef4444" : punteggioSanzioni >= 5 ? "#f97316" : punteggioSanzioni >= 3 ? "#fde047" : "#4ade80";

  const renderFattore = (f: Fattore) => (
    <View key={f.id} style={[styles.fattoreRow, f.attivo && styles.fattoreRowAttivo]}>
      <Text style={styles.fattoreEmoji}>{f.emoji}</Text>
      <View style={styles.fattoreContent}>
        <Text style={styles.fattoreTitolo}>{f.titolo}</Text>
        <Text style={styles.fattoreDescrizione}>{f.descrizione}</Text>
      </View>
      <Text style={styles.fattorePunti}>+{f.punti}</Text>
      {f.attivo ? <Text style={styles.fattoreAttivo}>●</Text> : <Text style={styles.fattoreInattivo}>○</Text>}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>Sanzioni</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.punteggioCard}>
          <Text style={styles.punteggioTitle}>Punteggio Sanzioni</Text>
          <View style={styles.punteggioContainer}>
            <Text style={[styles.punteggioValue, { color: coloreRischio }]}>{punteggioSanzioni}</Text>
            <Text style={styles.punteggioMax}>/ 10</Text>
          </View>
          <Text style={[styles.livelloRischio, { color: coloreRischio }]}>Livello: {livelloRischio}</Text>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(punteggioSanzioni / 10) * 100}%`, backgroundColor: coloreRischio }]} />
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Sistema di Sanzioni</Text>
          <Text style={styles.infoText}>
            La Comunità Interplanetaria monitora le politiche della colonia. <Text style={styles.infoBold}>Soglia critica: 5 punti</Text> → sanzioni economiche e diplomatiche.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fattori che influenzano il punteggio</Text>
          <View style={styles.twoColumns}>
            <View style={styles.column}>
              <Text style={styles.columnTitle}>Attivi ({attivi.length})</Text>
              {attivi.length > 0 ? attivi.map(renderFattore) : <Text style={styles.emptyColumn}>Nessuno</Text>}
            </View>
            <View style={styles.column}>
              <Text style={styles.columnTitle}>Non attivi ({nonAttivi.length})</Text>
              {nonAttivi.length > 0 ? nonAttivi.map(renderFattore) : <Text style={styles.emptyColumn}>Nessuno</Text>}
            </View>
          </View>
        </View>

        {haSanzioni && (
          <View style={[styles.sanzioniCard, { borderColor: "#ef4444" }]}>
            <Text style={[styles.sanzioniTitle, { color: "#ef4444" }]}>⚠️ Sanzioni Attive</Text>
            <Text style={styles.sanzioniText}>
              Sanzioni imposte per politiche contrarie ai diritti fondamentali.
            </Text>
            <Text style={styles.sanzioniEffetti}>
              <Text style={styles.sanzioniEffettiTitle}>Effetti:</Text> −20% risorse • Blocco scambi • Isolamento diplomatico
            </Text>
          </View>
        )}
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)"
  },
  back: {
    color: "#93c5fd",
    fontSize: 11
  },
  title: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700"
  },
  content: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    paddingBottom: 6,
    flex: 1
  },
  punteggioCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 6,
    alignItems: "center"
  },
  punteggioTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  punteggioContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 2
  },
  punteggioValue: {
    fontSize: 28,
    fontWeight: "800"
  },
  punteggioMax: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 2
  },
  livelloRischio: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  progressContainer: {
    marginBottom: 8
  },
  progressBar: {
    height: 6,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderRadius: 3,
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 3
  },
  infoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 8
  },
  infoTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  infoText: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    lineHeight: 12
  },
  infoBold: {
    color: "#ffffff",
    fontWeight: "700"
  },
  section: {
    marginBottom: 8
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8
  },
  twoColumns: {
    flexDirection: "row",
    gap: 10
  },
  column: {
    flex: 1,
    minWidth: 0
  },
  columnTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  emptyColumn: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 9,
    fontStyle: "italic"
  },
  fattoreRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    marginBottom: 4
  },
  fattoreRowAttivo: {
    borderLeftWidth: 3,
    borderLeftColor: "#4ade80"
  },
  fattoreEmoji: {
    fontSize: 16,
    marginRight: 6
  },
  fattoreContent: {
    flex: 1
  },
  fattoreTitolo: {
    color: "#e5e7eb",
    fontSize: 10,
    fontWeight: "700"
  },
  fattoreDescrizione: {
    color: "rgba(203,213,245,0.6)",
    fontSize: 8,
    lineHeight: 11
  },
  fattorePunti: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    fontWeight: "600",
    marginRight: 6
  },
  fattoreAttivo: {
    color: "#4ade80",
    fontSize: 10,
    fontWeight: "700"
  },
  fattoreInattivo: {
    color: "rgba(148,163,184,0.4)",
    fontSize: 10
  },
  sanzioniCard: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 2,
    marginTop: 4
  },
  sanzioniTitle: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4
  },
  sanzioniText: {
    color: "rgba(203,213,245,0.9)",
    fontSize: 9,
    lineHeight: 12,
    marginBottom: 4
  },
  sanzioniEffetti: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 8,
    lineHeight: 12
  },
  sanzioniEffettiTitle: {
    color: "#ffffff",
    fontWeight: "700"
  }
});
