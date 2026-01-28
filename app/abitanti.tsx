import React, { useState } from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import type { Abitante } from "../src/types";
import { AbitanteInfoModal } from "../src/ui/AbitanteInfoModal";

export default function AbitantiScreen() {
  const router = useRouter();
  const { abitanti, calcolaFelicitàModificata } = useGameContext();
  const [selectedAbitante, setSelectedAbitante] = useState<Abitante | null>(null);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const getAbitanteNome = (id: number) => {
    return abitanti.find((a) => a.id === id)?.nome || `ID ${id}`;
  };

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>Abitanti</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView 
        horizontal
        contentContainerStyle={styles.tableContainer}
        showsHorizontalScrollIndicator={true}
      >
        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={true}
        >
          {/* Header della tabella */}
          <View style={styles.tableHeader}>
            <View style={[styles.headerCell, styles.cellEmoji]}><Text style={styles.headerText}>Emoji</Text></View>
            <View style={[styles.headerCell, styles.cellNome]}><Text style={styles.headerText}>Nome</Text></View>
            <View style={[styles.headerCell, styles.cellSmall]}><Text style={styles.headerText}>Età</Text></View>
            <View style={[styles.headerCell, styles.cellLavoro]}><Text style={styles.headerText}>Lavoro</Text></View>
            <View style={[styles.headerCell, styles.cellSmall]}><Text style={styles.headerText}>Comp.</Text></View>
            <View style={[styles.headerCell, styles.cellSmall]}><Text style={styles.headerText}>Prod.</Text></View>
            <View style={[styles.headerCell, styles.cellSmall]}><Text style={styles.headerText}>Stan.</Text></View>
            <View style={[styles.headerCell, styles.cellSmall]}><Text style={styles.headerText}>Salute</Text></View>
            <View style={[styles.headerCell, styles.cellMedium]}><Text style={styles.headerText}>Crediti</Text></View>
            <View style={[styles.headerCell, styles.cellMedium]}><Text style={styles.headerText}>Reddito</Text></View>
            <View style={[styles.headerCell, styles.cellMedium]}><Text style={styles.headerText}>Spese</Text></View>
            <View style={[styles.headerCell, styles.cellSmall]}><Text style={styles.headerText}>Lealtà</Text></View>
            <View style={[styles.headerCell, styles.cellSmall]}><Text style={styles.headerText}>Paura</Text></View>
            <View style={[styles.headerCell, styles.cellSmall]}><Text style={styles.headerText}>Felicità</Text></View>
            <View style={[styles.headerCell, styles.cellReligione]}><Text style={styles.headerText}>Religione</Text></View>
            <View style={[styles.headerCell, styles.cellFazione]}><Text style={styles.headerText}>Fazione</Text></View>
          </View>

          {/* Righe della tabella */}
          {abitanti.map((a: Abitante) => {
            const felicitàModificata = calcolaFelicitàModificata(a);
            return (
              <Pressable
                key={a.id}
                style={styles.tableRow}
                onPress={() => setSelectedAbitante(a)}
              >
                <View style={[styles.cell, styles.cellEmoji]}>
                  <Text style={styles.cellEmojiText}>{a.emoji}</Text>
                </View>
                <View style={[styles.cell, styles.cellNome]}>
                  <Text style={styles.cellText}>{a.nome}</Text>
                </View>
                <View style={[styles.cell, styles.cellSmall]}>
                  <Text style={styles.cellText}>{a.eta}</Text>
                </View>
                <View style={[styles.cell, styles.cellLavoro]}>
                  <Text style={styles.cellTextSmall}>{a.lavoro}</Text>
                </View>
                <View style={[styles.cell, styles.cellSmall]}>
                  <Text style={styles.cellText}>{a.competenza}%</Text>
                </View>
                <View style={[styles.cell, styles.cellSmall]}>
                  <Text style={styles.cellText}>{a.produttività}%</Text>
                </View>
                <View style={[styles.cell, styles.cellSmall]}>
                  <Text style={styles.cellText}>{a.stanchezza}%</Text>
                </View>
                <View style={[styles.cell, styles.cellSmall]}>
                  <Text style={styles.cellText}>{a.salute}%</Text>
                </View>
                <View style={[styles.cell, styles.cellMedium]}>
                  <Text style={styles.cellText}>{a.crediti}</Text>
                </View>
                <View style={[styles.cell, styles.cellMedium]}>
                  <Text style={[styles.cellText, styles.cellTextPositive]}>{a.reddito}</Text>
                </View>
                <View style={[styles.cell, styles.cellMedium]}>
                  <Text style={[styles.cellText, styles.cellTextNegative]}>{a.spese}</Text>
                </View>
                <View style={[styles.cell, styles.cellSmall]}>
                  <Text style={styles.cellText}>{a.lealtà}%</Text>
                </View>
                <View style={[styles.cell, styles.cellSmall]}>
                  <Text style={styles.cellText}>{a.paura}%</Text>
                </View>
                <View style={[styles.cell, styles.cellSmall]}>
                  <Text style={[
                    styles.cellText,
                    felicitàModificata >= 70 ? styles.cellTextPositive : felicitàModificata >= 40 ? styles.cellTextNeutral : styles.cellTextNegative
                  ]}>
                    {felicitàModificata}%
                  </Text>
                </View>
                <View style={[styles.cell, styles.cellReligione]}>
                  <Text style={styles.cellTextSmall}>{a.religione}</Text>
                </View>
                <View style={[styles.cell, styles.cellFazione]}>
                  <Text style={styles.cellTextSmall}>{a.fazione}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </ScrollView>

      <AbitanteInfoModal
        visible={selectedAbitante !== null}
        abitante={selectedAbitante}
        onClose={() => setSelectedAbitante(null)}
        getAbitanteNome={getAbitanteNome}
        calcolaFelicitàModificata={calcolaFelicitàModificata}
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
  tableContainer: {
    flexGrow: 1
  },
  content: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    paddingBottom: 6
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "rgba(59,130,246,0.2)",
    borderBottomWidth: 2,
    borderBottomColor: "#3b82f6",
    marginBottom: 4
  },
  headerCell: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(148,163,184,0.3)",
    alignItems: "center",
    justifyContent: "center"
  },
  headerText: {
    color: "#93c5fd",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center"
  },
  tableRow: {
    flexDirection: "row",
    backgroundColor: "rgba(15,23,42,0.6)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.2)",
    minHeight: 32
  },
  cell: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(148,163,184,0.2)",
    justifyContent: "center",
    alignItems: "center"
  },
  cellEmoji: {
    width: 40,
    minWidth: 40
  },
  cellNome: {
    width: 140,
    minWidth: 140
  },
  cellLavoro: {
    width: 120,
    minWidth: 120
  },
  cellSmall: {
    width: 50,
    minWidth: 50
  },
  cellMedium: {
    width: 70,
    minWidth: 70
  },
  cellReligione: {
    width: 100,
    minWidth: 100
  },
  cellFazione: {
    width: 110,
    minWidth: 110
  },
  cellEmojiText: {
    fontSize: 20
  },
  cellText: {
    color: "#e5e7eb",
    fontSize: 9,
    textAlign: "center"
  },
  cellTextSmall: {
    color: "#e5e7eb",
    fontSize: 8,
    textAlign: "center"
  },
  cellTextPositive: {
    color: "#4ade80"
  },
  cellTextNegative: {
    color: "#ef4444"
  },
  cellTextNeutral: {
    color: "#fde047"
  }
});
