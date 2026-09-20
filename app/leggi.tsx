import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { leggiData } from "../src/kingdomData";
import { useGameContext } from "../src/context/GameContext";
import { tassaIdDaTitoloLegge, tasseSbloccate } from "../src/game/tasseSblocco";
import { resolveStatoLegge } from "../src/game/statoLeggi";
import type { Legge } from "../src/types";

type LeggeConTema = Legge & { tema: string };

export default function LeggiScreen() {
  const router = useRouter();
  const {
    obiettiviCompletati,
    modalitaGioco,
    penaDiMorteAttiva,
    leggeRazzialeAttiva,
    divietoEspatrioAttivo,
    iusPrimaeNoctisAttivo,
    coprifuocoAttivo,
    tassaPatrimonioPercentuale,
    ivaPercentuale
  } = useGameContext();
  const unlockTasse = tasseSbloccate(obiettiviCompletati, modalitaGioco);

  const flagsStatoLeggi = {
    penaDiMorteAttiva,
    leggeRazzialeAttiva,
    divietoEspatrioAttivo,
    iusPrimaeNoctisAttivo,
    coprifuocoAttivo,
    tassaPatrimonioPercentuale,
    ivaPercentuale
  };

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  // Raggruppa le leggi per tema (4 colonne)
  const leggiPerTema: Record<string, LeggeConTema[]> = {
    Fiscale: [],
    "Diritti e Giustizia": [],
    "Società": [],
    "Risorse e Gestione": []
  };

  // Mappa emoji per le leggi
  const getEmojiLegge = (titolo: string): string => {
    const emojiMap: Record<string, string> = {
      "Imposta sul Valore Aggiunto": "📊",
      "Tassa sul Patrimonio": "💎",
      "Tassa sul Reddito": "💰",
      "Prelievo Forzoso": "👑",
      "Reddito di Cittadinanza": "🪙",
      "Carta dei Diritti dei Sudditi": "📜",
      "Età minima sul lavoro": "👶",
      "Età pensionabile": "👴",
      "Pena di Morte": "⚰️",
      "Legge sulle Nascite": "👨‍👩‍👧‍👦",
      "Religione": "🕊️",
      "Regolamento sull'Uso dell'Energia": "⚡",
      "Legge Razziale": "🚫",
      "Legge sulle Famiglie": "👨‍👩‍👧",
      "Legge sulle Droghe": "💊",
      "Divieto di espatrio": "🚧",
      "Ius primae noctis": "👑",
      "Sanità": "🏥",
      "Coprifuoco": "🌙"
    };
    return emojiMap[titolo] || "📋";
  };

  // Aggiungi le leggi ai rispettivi temi (riorganizzate logicamente)
  leggiData.forEach((legge) => {
    if (
      legge.titolo === "Imposta sul Valore Aggiunto" ||
      legge.titolo === "Tassa sul Patrimonio" ||
      legge.titolo === "Tassa sul Reddito" ||
      legge.titolo === "Prelievo Forzoso" ||
      legge.titolo === "Reddito di Cittadinanza"
    ) {
      leggiPerTema.Fiscale.push({ ...legge, tema: "Fiscale" });
    } else if (
      legge.titolo === "Carta dei Diritti dei Sudditi" ||
      legge.titolo === "Età minima sul lavoro" ||
      legge.titolo === "Età pensionabile" ||
      legge.titolo === "Pena di Morte" ||
      legge.titolo === "Legge Razziale"
    ) {
      leggiPerTema["Diritti e Giustizia"].push({ ...legge, tema: "Diritti e Giustizia" });
    } else if (
      legge.titolo === "Religione" ||
      legge.titolo === "Legge sulle Famiglie" ||
      legge.titolo === "Legge sulle Nascite" ||
      legge.titolo === "Divieto di espatrio" ||
      legge.titolo === "Ius primae noctis" ||
      legge.titolo === "Sanità" ||
      legge.titolo === "Coprifuoco"
    ) {
      leggiPerTema["Società"].push({ ...legge, tema: "Società" });
    } else if (
      legge.titolo === "Regolamento sull'Uso dell'Energia" ||
      legge.titolo === "Legge sulle Droghe"
    ) {
      leggiPerTema["Risorse e Gestione"].push({ ...legge, tema: "Risorse e Gestione" });
    }
  });

  // Aggiungi Schiavitu come gestione separata
  const gestioneSpeciale = {
    titolo: "Schiavitu",
    descrizione: "Gestisci schiavisti e schiavi nel Regno",
    tema: "Gestione"
  };

  const getNavigationPath = (titolo: string) => {
    if (titolo === "Prelievo Forzoso") return "/prelievo-forzoso";
    if (titolo === "Imposta sul Valore Aggiunto") return "/imposta-valore-aggiunto";
    if (titolo === "Tassa sul Patrimonio") return "/tassa-patrimonio";
    if (titolo === "Tassa sul Reddito") return "/tassa-reddito";
    if (titolo === "Legge sulle Nascite") return "/legge-nascite";
    if (titolo === "Pena di Morte") return "/pena-di-morte";
    if (titolo === "Religione") return "/religione";
    if (titolo === "Reddito di Cittadinanza") return "/reddito-cittadinanza";
    if (titolo === "Sanità") return "/sanita";
    if (titolo === "Legge Razziale") return "/legge-razziale";
    if (titolo === "Età minima sul lavoro") return "/eta-minima-lavoro";
    if (titolo === "Età pensionabile") return "/eta-pensionabile";
    if (titolo === "Legge sulle Droghe") return "/legge-droghe";
    if (titolo === "Legge sulle Famiglie") return "/legge-famiglie";
    if (titolo === "Divieto di espatrio") return "/divieto-espatrio";
    if (titolo === "Ius primae noctis") return "/ius-primae-noctis";
    if (titolo === "Schiavitu") return "/schiavitu";
    if (titolo === "Coprifuoco") return "/coprifuoco";
    return null;
  };

  const renderLeggeCard = (legge: LeggeConTema | typeof gestioneSpeciale) => {
    const isLegge = "id" in legge;
    const path = getNavigationPath(legge.titolo);
    const tassaId = isLegge ? tassaIdDaTitoloLegge(legge.titolo) : null;
    const tassaBloccata =
      tassaId != null && tassaId !== "prelievo" && !unlockTasse.has(tassaId);
    const statoEffettivo = isLegge
      ? resolveStatoLegge(legge.titolo, flagsStatoLeggi)
      : null;
    const isClickable = path !== null && !tassaBloccata;

    return (
      <Pressable
        key={isLegge ? legge.id : "schiavitu"}
        style={[styles.card, tassaBloccata && styles.cardLocked]}
        onPress={isClickable ? () => router.push(path) : undefined}
        disabled={!isClickable}
      >
        <Text style={styles.cardTitle}>
          <Text style={styles.cardEmoji}>{getEmojiLegge(legge.titolo)} </Text>
          {legge.titolo}
        </Text>
        <Text style={styles.line} numberOfLines={2}>
          {tassaBloccata ? "Sblocca avanzando negli Obiettivi del ramo fiscale." : legge.descrizione}
        </Text>
        {isLegge && (
          <Text style={styles.chip}>
            Stato:{" "}
            <Text
              style={[
                styles.chipValue,
                !tassaBloccata && statoEffettivo === "In vigore" && styles.chipActive,
                (tassaBloccata || statoEffettivo === "Proposta") && styles.chipProposed,
                !tassaBloccata && statoEffettivo === "Abrogata" && styles.chipRepealed
              ]}
            >
              {tassaBloccata ? "Bloccata" : statoEffettivo}
            </Text>
          </Text>
        )}
        {!isLegge && (
          <Text style={styles.chip}>
            <Text style={styles.chipValue}>Gestione</Text>
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Leggi</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.columnsContainer}>
          {/* Colonna 1: Fiscale */}
          <View style={styles.column}>
            <Text style={styles.temaTitle}>💰 Fiscale</Text>
            {leggiPerTema.Fiscale.map((legge) => renderLeggeCard(legge))}
          </View>

          {/* Colonna 2: Diritti e Giustizia */}
          <View style={styles.column}>
            <Text style={styles.temaTitle}>⚖️ Diritti e Giustizia</Text>
            {leggiPerTema["Diritti e Giustizia"].map((legge) => renderLeggeCard(legge))}
          </View>

          {/* Colonna 3: Società */}
          <View style={styles.column}>
            <Text style={styles.temaTitle}>👥 Società</Text>
            {leggiPerTema["Società"].map((legge) => renderLeggeCard(legge))}
          </View>

          {/* Colonna 4: Risorse e Gestione */}
          <View style={styles.column}>
            <Text style={styles.temaTitle}>🌍 Risorse e Gestione</Text>
            {leggiPerTema["Risorse e Gestione"].map((legge) => renderLeggeCard(legge))}
            {renderLeggeCard(gestioneSpeciale)}
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    paddingBottom: 6,
    flex: 1
  },
  columnsContainer: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start"
  },
  column: {
    flex: 1,
    minWidth: 0
  },
  temaTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 4,
    minHeight: 70
  },
  cardLocked: {
    opacity: 0.72,
    borderColor: "rgba(100,116,139,0.5)"
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 9,
    fontWeight: "700",
    marginBottom: 2
  },
  cardEmoji: {
    fontSize: 11
  },
  line: {
    color: "#cbd5f5",
    fontSize: 7,
    lineHeight: 10
  },
  chip: {
    marginTop: 4,
    color: "#e5e7eb",
    fontSize: 9
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
  }
});
