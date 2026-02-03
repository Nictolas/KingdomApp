import React, { useState } from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { fazioniData } from "../src/kingdomData";
import type { Fazione } from "../src/types";
import { FazioneInfoModal } from "../src/ui/FazioneInfoModal";

/** Colonne tematiche: nome colonna + nomi fazioni (come in fazioniData). */
const COLONNA_GOVERNO = ["Amministrazione", "Cittadini", "Reazionari", "Sicurezza"];
const COLONNA_LAVORO = ["Lavoratori", "Scienziati", "Esploratori"];
const COLONNA_MARGINI = ["Mafia", "Schiavi", "Nativi", "Robots"];
const COLONNA_RELIGIONE = ["Culto del Sole", "Culto degli Alieni"];

function getFazioniPerColonna(nomi: string[]): Fazione[] {
  return nomi
    .map((nome) => fazioniData.find((f) => f.nome === nome))
    .filter((f): f is Fazione => f != null);
}

function handleFazionePress(
  f: Fazione,
  router: ReturnType<typeof useRouter>,
  setSelectedFazione: (f: Fazione | null) => void
) {
  if (f.nome === "Mafia") router.push("/mafia");
  else if (f.nome === "Schiavi") router.push("/schiavi");
  else if (f.nome === "Nativi") router.push("/nativi");
  else if (f.nome === "Amministrazione") router.push("/ministri");
  else if (f.nome === "Culto del Sole") router.push("/culto-sole");
  else if (f.nome === "Culto degli Alieni") router.push("/culto-alieni");
  else if (f.nome === "Sicurezza") router.push("/sicurezza");
  else setSelectedFazione(f);
}

export default function FazioniScreen() {
  const router = useRouter();
  const { abitanti } = useGameContext();
  const [selectedFazione, setSelectedFazione] = useState<Fazione | null>(null);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const governo = getFazioniPerColonna(COLONNA_GOVERNO);
  const lavoro = getFazioniPerColonna(COLONNA_LAVORO);
  const margini = getFazioniPerColonna(COLONNA_MARGINI);
  const religione = getFazioniPerColonna(COLONNA_RELIGIONE);

  const renderColumn = (title: string, subtitle: string, fazioniCol: Fazione[]) => (
    <View key={title} style={styles.column}>
      <Text style={styles.columnTitle}>{title}</Text>
      <Text style={styles.columnSubtitle}>{subtitle}</Text>
      <View style={styles.cardGrid}>
        {fazioniCol.map((f) => (
          <Pressable
            key={f.id}
            style={styles.card}
            onPress={() => handleFazionePress(f, router, setSelectedFazione)}
          >
            <Text style={styles.emoji}>{f.emoji}</Text>
            <Text style={styles.cardTitle}>{f.nome}</Text>
            <Text style={styles.cardDescrizione} numberOfLines={2}>
              {f.descrizione}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>Fazioni</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        style={isDesktop ? styles.scrollFlex : undefined}
      >
        <View style={styles.columns}>
          {renderColumn("Governo e società", "Amministrazione, Cittadini, Reazionari, Sicurezza", governo)}
          {renderColumn("Lavoro e professione", "Lavoratori, Scienziati, Esploratori", lavoro)}
          {renderColumn("Margini e coercizione", "Mafia, Schiavi, Nativi, Robots", margini)}
          {renderColumn("Religione", "Culto del Sole, Culto degli Alieni", religione)}
        </View>
      </ScrollView>

      <FazioneInfoModal
        visible={selectedFazione !== null}
        fazione={selectedFazione}
        abitanti={abitanti}
        onClose={() => setSelectedFazione(null)}
      />
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
    paddingVertical: 10,
    paddingBottom: 12,
    flex: 1
  },
  scrollFlex: {
    flex: 1
  },
  columns: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20
  },
  column: {
    minWidth: 180,
    flex: 1
  },
  columnTitle: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2
  },
  columnSubtitle: {
    color: "rgba(148,163,184,0.8)",
    fontSize: 9,
    marginBottom: 8
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    minWidth: 120,
    flex: 1
  },
  emoji: {
    fontSize: 28,
    marginBottom: 4
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
    textAlign: "center"
  },
  cardDescrizione: {
    color: "#cbd5f5",
    fontSize: 9,
    textAlign: "center"
  }
});

