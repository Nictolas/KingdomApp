import React, { useState } from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import type { Edificio } from "../src/types";
import { EDIFICIO_COMPETENZA_RICHIESTA } from "../src/data/edificiCompetenze";
import { EdificioInfoModal } from "../src/ui/EdificioInfoModal";
import { CampoDiLavoroModal } from "../src/ui/CampoDiLavoroModal";

/** Colonne richieste: Produzione, Servizi, Punizione. Nomi come in edificiData. */
const COLONNA_PRODUZIONE: string[] = [
  "Serra",
  "Raffineria Mineraria", // Miniera
  "Laboratorio di Ricerca", // Laboratorio
  "Centrale Energetica", // Centrale
  "Impianto di Riciclo",
  "Dissalatore"
];
const COLONNA_SERVIZI: string[] = [
  "Centro di Comando",
  "Baracca", // Residenze (card mostrata come "Residenze")
  "Capanna", // Residenza solo Nativi
  "Bar",
  "Scuola",
  "Ospedale Coloniale", // Ospedale
  "Centrale",   // Polizia
  "Caserma",   // Militari
  "Spazioporto"
];
const COLONNA_PUNIZIONE: string[] = ["Tribunale", "Campo di Lavoro", "Campo di Sterminio"];

function getEdificiPerColonna(edifici: Edificio[], nomi: string[]): Edificio[] {
  return nomi
    .map((nome) => edifici.find((e) => e.nome === nome))
    .filter((e): e is Edificio => e != null);
}

function CardEdificio({
  e,
  titleOverride,
  onPress
}: {
  key?: number;
  e: Edificio;
  titleOverride?: string;
  onPress: () => void;
}) {
  const competenza = EDIFICIO_COMPETENZA_RICHIESTA[e.id];
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.emoji}>{e.emoji}</Text>
      <Text style={styles.cardTitle}>{titleOverride ?? e.nome}</Text>
      <Text style={styles.cardTipo}>{e.tipo}</Text>
      {competenza && (
        <Text style={styles.cardCompetenza} numberOfLines={1}>{competenza.nomeCompetenza} (≥{competenza.competenzaMinima}%)</Text>
      )}
    </Pressable>
  );
}

export default function EdificiScreen() {
  const router = useRouter();
  const { edifici, abitanti, aggiungiAlCampoDiLavoroTuttiQuelliChe } = useGameContext();
  const [selectedEdificio, setSelectedEdificio] = useState<Edificio | null>(null);

  const isCampoDiLavoro = selectedEdificio?.nome === "Campo di Lavoro";

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const produzione = getEdificiPerColonna(edifici, COLONNA_PRODUZIONE);
  const servizi = getEdificiPerColonna(edifici, COLONNA_SERVIZI);
  const punizione = getEdificiPerColonna(edifici, COLONNA_PUNIZIONE);

  const handlePress = (e: Edificio) => {
    if (e.nome === "Serra") {
      router.push("/serra");
    } else if (e.nome === "Centrale Energetica") {
      router.push("/centrale-energetica");
    } else if (e.nome === "Raffineria Mineraria") {
      router.push("/raffineria-mineraria");
    } else if (e.nome === "Impianto di Riciclo") {
      router.push("/impianto-riciclo");
    } else if (e.nome === "Baracca" || e.nome === "Capanna") {
      router.push("/residenze");
    } else if (e.nome === "Scuola") {
      router.push("/scuola");
    } else if (e.nome === "Ospedale Coloniale") {
      router.push("/ospedale");
    } else if (e.nome === "Centrale") {
      router.push("/centrale");
    } else if (e.nome === "Tribunale") {
      router.push("/tribunale");
    } else if (e.nome === "Centro di Comando") {
      router.push("/ministri");
    } else if (e.nome === "Dissalatore") {
      router.push("/dissalatore");
    } else if (e.nome === "Laboratorio di Ricerca") {
      router.push("/laboratorio");
    } else if (e.nome === "Bar") {
      router.push("/bar");
    } else if (e.nome === "Caserma") {
      router.push("/caserma");
    } else if (e.nome === "Spazioporto") {
      router.push("/spazioporto");
    } else {
      setSelectedEdificio(e);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Edifici</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} style={isDesktop ? styles.scrollFlex : undefined}>
        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.columnTitle}>Produzione</Text>
            <Text style={styles.columnSubtitle}>Serra, Miniera, Laboratorio, Centrale, Impianto di Riciclo</Text>
            <View style={styles.cardGrid}>
              {produzione.map((e) => (
                <CardEdificio key={e.id} e={e} onPress={() => handlePress(e)} />
              ))}
            </View>
          </View>
          <View style={styles.column}>
            <Text style={styles.columnTitle}>Servizi</Text>
            <Text style={styles.columnSubtitle}>Centro di Comando, Residenze, Scuola, Ospedale, Centrale (polizia), Caserma (militari)</Text>
            <View style={styles.cardGrid}>
              {servizi.map((e) => (
                <CardEdificio
                  key={e.id}
                  e={e}
                  titleOverride={e.nome === "Baracca" ? "Residenze" : undefined}
                  onPress={() => handlePress(e)}
                />
              ))}
            </View>
          </View>
          <View style={styles.column}>
            <Text style={styles.columnTitle}>Punizione</Text>
            <Text style={styles.columnSubtitle}>Tribunale, Campo di Lavoro, Campo di Sterminio</Text>
            <View style={styles.cardGrid}>
              {punizione.map((e) => (
                <CardEdificio key={e.id} e={e} onPress={() => handlePress(e)} />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {isCampoDiLavoro ? (
        <CampoDiLavoroModal
          visible={selectedEdificio !== null}
          edificio={selectedEdificio}
          abitanti={abitanti}
          aggiungiAlCampoDiLavoroTuttiQuelliChe={aggiungiAlCampoDiLavoroTuttiQuelliChe}
          onClose={() => setSelectedEdificio(null)}
        />
      ) : (
        <EdificioInfoModal
          visible={selectedEdificio !== null}
          edificio={selectedEdificio}
          onClose={() => setSelectedEdificio(null)}
        />
      )}
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
    paddingBottom: 12,
    flex: 1
  },
  scrollFlex: {
    flex: 1
  },
  columns: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16
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
    gap: 6
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    minWidth: 90
  },
  emoji: {
    fontSize: 24,
    marginBottom: 2
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 1,
    textAlign: "center"
  },
  cardTipo: {
    color: "#93c5fd",
    fontSize: 8,
    textAlign: "center"
  },
  cardCompetenza: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 7,
    textAlign: "center",
    marginTop: 2
  }
});
