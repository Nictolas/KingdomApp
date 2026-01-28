import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { leggiData } from "../src/kingdomData";
import type { Legge } from "../src/types";

type LeggeConTema = Legge & { tema: string };

export default function LeggiScreen() {
  const router = useRouter();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  // Raggruppa le leggi per tema
  const leggiPerTema: Record<string, LeggeConTema[]> = {
    Fiscale: [],
    "Diritti e Giustizia": [],
    "Società e Demografia": [],
    "Ambiente e Risorse": []
  };

  // Aggiungi le leggi ai rispettivi temi
  leggiData.forEach((legge) => {
    if (
      legge.titolo === "Tassa sulla Produzione" ||
      legge.titolo === "Tassa sul Patrimonio" ||
      legge.titolo === "Tassa sul Reddito"
    ) {
      leggiPerTema.Fiscale.push({ ...legge, tema: "Fiscale" });
    } else if (
      legge.titolo === "Carta dei Diritti dei Coloni" ||
      legge.titolo === "Età minima sul lavoro" ||
      legge.titolo === "Pena di Morte"
    ) {
      leggiPerTema["Diritti e Giustizia"].push({ ...legge, tema: "Diritti e Giustizia" });
    } else if (legge.titolo === "Legge sulle Nascite" || legge.titolo === "Religione") {
      leggiPerTema["Società e Demografia"].push({ ...legge, tema: "Società e Demografia" });
    } else if (legge.titolo === "Regolamento sull'Uso dell'Energia") {
      leggiPerTema["Ambiente e Risorse"].push({ ...legge, tema: "Ambiente e Risorse" });
    }
  });

  // Aggiungi Schiavitu come gestione separata
  const gestioneSpeciale = {
    titolo: "Schiavitu",
    descrizione: "Gestisci schiavisti e schiavi nella colonia",
    tema: "Gestione"
  };

  const getNavigationPath = (titolo: string) => {
    if (titolo === "Tassa sul Reddito") return "/tassa-reddito";
    if (titolo === "Legge sulle Nascite") return "/legge-nascite";
    if (titolo === "Pena di Morte") return "/pena-di-morte";
    if (titolo === "Religione") return "/religione";
    if (titolo === "Schiavitu") return "/schiavitu";
    return null;
  };

  const renderLeggeCard = (legge: LeggeConTema | typeof gestioneSpeciale) => {
    const isLegge = "id" in legge;
    const path = getNavigationPath(legge.titolo);
    const isClickable = path !== null;

    return (
      <Pressable
        key={isLegge ? legge.id : "schiavitu"}
        style={styles.card}
        onPress={isClickable ? () => router.push(path) : undefined}
        disabled={!isClickable}
      >
        <Text style={styles.cardTitle}>{legge.titolo}</Text>
        <Text style={styles.line} numberOfLines={2}>
          {legge.descrizione}
        </Text>
        {isLegge && (
          <Text style={styles.chip}>
            Stato:{" "}
            <Text
              style={[
                styles.chipValue,
                legge.stato === "In vigore" && styles.chipActive,
                legge.stato === "Proposta" && styles.chipProposed,
                legge.stato === "Abrogata" && styles.chipRepealed
              ]}
            >
              {legge.stato}
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
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>Leggi</Text>
        <View style={{ width: 50 }} />
      </View>

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
            {renderLeggeCard(gestioneSpeciale)}
          </View>

          {/* Colonna 3: Società e Ambiente */}
          <View style={styles.column}>
            <Text style={styles.temaTitle}>👥 Società e Demografia</Text>
            {leggiPerTema["Società e Demografia"].map((legge) => renderLeggeCard(legge))}
            <Text style={styles.temaTitle}>🌍 Ambiente e Risorse</Text>
            {leggiPerTema["Ambiente e Risorse"].map((legge) => renderLeggeCard(legge))}
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    paddingBottom: 8,
    flex: 1
  },
  columnsContainer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start"
  },
  column: {
    flex: 1,
    minWidth: 0
  },
  temaTitle: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 6,
    minHeight: 80
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 3
  },
  line: {
    color: "#cbd5f5",
    fontSize: 8,
    lineHeight: 11
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
