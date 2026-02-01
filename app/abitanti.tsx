import React, { useState, useMemo } from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getEmojiRazza } from "../src/kingdomData";
import type { Abitante } from "../src/types";
import { AbitanteInfoModal } from "../src/ui/AbitanteInfoModal";

type SortField = "nome" | "eta" | "lavoro" | "razza" | "competenza" | "produttività" | "stanchezza" | "salute" | "crediti" | "reddito" | "spese" | "lealtà" | "paura" | "felicità" | "religione" | "fazioni" | null;
type SortDirection = "asc" | "desc";

const LAVORI_DA_MINORE = ["Studente", "Apprendista", "Tirocinante"];

function getEmojiDisplay(abitante: Abitante, etaMinimaLavoro: number): string {
  const razza = abitante.razza ?? "Umano";
  if (razza !== "Umano") return getEmojiRazza(razza);
  const maggiorenne = abitante.eta >= etaMinimaLavoro;
  const lavoroDaMinore = LAVORI_DA_MINORE.includes(abitante.lavoro);
  if (maggiorenne && lavoroDaMinore) return "👤";
  return abitante.emoji;
}

function getLavoroDisplay(abitante: Abitante, etaMinimaLavoro: number): string {
  const maggiorenne = abitante.eta >= etaMinimaLavoro;
  const lavoroDaMinore = LAVORI_DA_MINORE.includes(abitante.lavoro);
  if (maggiorenne && lavoroDaMinore) return "Disoccupato";
  return abitante.lavoro;
}

export default function AbitantiScreen() {
  const router = useRouter();
  const { abitanti, calcolaFelicitàModificata, etaMinimaLavoro } = useGameContext();
  const [selectedAbitante, setSelectedAbitante] = useState<Abitante | null>(null);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const getAbitanteNome = (id: number) => {
    return abitanti.find((a) => a.id === id)?.nome || `ID ${id}`;
  };

  // Ordina gli abitanti
  const abitantiOrdinati = useMemo(() => {
    if (!sortField) return abitanti;

    const sorted = [...abitanti].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      if (sortField === "felicità") {
        aValue = calcolaFelicitàModificata(a);
        bValue = calcolaFelicitàModificata(b);
      } else if (sortField === "fazioni") {
        aValue = (a.fazioni ?? []).join(", ");
        bValue = (b.fazioni ?? []).join(", ");
      } else if (sortField === "nome" || sortField === "religione") {
        aValue = a[sortField];
        bValue = b[sortField];
      } else if (sortField === "lavoro") {
        aValue = getLavoroDisplay(a, etaMinimaLavoro);
        bValue = getLavoroDisplay(b, etaMinimaLavoro);
      } else if (sortField === "razza") {
        aValue = a.razza ?? "Umano";
        bValue = b.razza ?? "Umano";
      } else {
        aValue = a[sortField as keyof Abitante] as number;
        bValue = b[sortField as keyof Abitante] as number;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortDirection === "asc"
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });

    return sorted;
  }, [abitanti, sortField, sortDirection, calcolaFelicitàModificata, etaMinimaLavoro]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Inverti la direzione se clicchi di nuovo sulla stessa colonna
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Nuova colonna, inizia con ordine crescente
      setSortField(field);
      setSortDirection("asc");
    }
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
            <View style={[styles.headerCell, styles.cellEmoji]}>
              <Text style={styles.headerText}>😊</Text>
            </View>
            <Pressable 
              style={[styles.headerCell, styles.cellNome, sortField === "nome" && styles.headerCellActive]}
              onPress={() => handleSort("nome")}
            >
              <Text style={styles.headerText}>👤 Nome</Text>
              {sortField === "nome" && (
                <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>
              )}
            </Pressable>
            <Pressable 
              style={[styles.headerCell, styles.cellSmall, sortField === "eta" && styles.headerCellActive]}
              onPress={() => handleSort("eta")}
            >
              <Text style={styles.headerText}>🎂 Età</Text>
              {sortField === "eta" && (
                <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>
              )}
            </Pressable>
            <Pressable 
              style={[styles.headerCell, styles.cellLavoro, sortField === "lavoro" && styles.headerCellActive]}
              onPress={() => handleSort("lavoro")}
            >
              <Text style={styles.headerText}>💼 Lavoro</Text>
              {sortField === "lavoro" && (
                <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>
              )}
            </Pressable>
            <Pressable 
              style={[styles.headerCell, styles.cellRazza, sortField === "razza" && styles.headerCellActive]}
              onPress={() => handleSort("razza")}
            >
              <Text style={styles.headerText}>🪐 Razza</Text>
              {sortField === "razza" && (
                <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>
              )}
            </Pressable>
            <Pressable 
              style={[styles.headerCell, styles.cellSmall, sortField === "competenza" && styles.headerCellActive]}
              onPress={() => handleSort("competenza")}
            >
              <Text style={styles.headerText}>⭐ Comp.</Text>
              {sortField === "competenza" && (
                <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>
              )}
            </Pressable>
            <Pressable 
              style={[styles.headerCell, styles.cellSmall, sortField === "produttività" && styles.headerCellActive]}
              onPress={() => handleSort("produttività")}
            >
              <Text style={styles.headerText}>⚡ Prod.</Text>
              {sortField === "produttività" && (
                <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>
              )}
            </Pressable>
            <Pressable 
              style={[styles.headerCell, styles.cellSmall, sortField === "stanchezza" && styles.headerCellActive]}
              onPress={() => handleSort("stanchezza")}
            >
              <Text style={styles.headerText}>😴 Stan.</Text>
              {sortField === "stanchezza" && (
                <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>
              )}
            </Pressable>
            <Pressable 
              style={[styles.headerCell, styles.cellSmall, sortField === "salute" && styles.headerCellActive]}
              onPress={() => handleSort("salute")}
            >
              <Text style={styles.headerText}>🏥 Salute</Text>
              {sortField === "salute" && (
                <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>
              )}
            </Pressable>
            <Pressable 
              style={[styles.headerCell, styles.cellMedium, sortField === "crediti" && styles.headerCellActive]}
              onPress={() => handleSort("crediti")}
            >
              <Text style={styles.headerText}>💰 Crediti</Text>
              {sortField === "crediti" && (
                <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>
              )}
            </Pressable>
            <Pressable 
              style={[styles.headerCell, styles.cellMedium, sortField === "reddito" && styles.headerCellActive]}
              onPress={() => handleSort("reddito")}
            >
              <Text style={styles.headerText}>📈 Reddito</Text>
              {sortField === "reddito" && (
                <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>
              )}
            </Pressable>
            <Pressable 
              style={[styles.headerCell, styles.cellMedium, sortField === "spese" && styles.headerCellActive]}
              onPress={() => handleSort("spese")}
            >
              <Text style={styles.headerText}>📉 Spese</Text>
              {sortField === "spese" && (
                <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>
              )}
            </Pressable>
            <Pressable 
              style={[styles.headerCell, styles.cellSmall, sortField === "lealtà" && styles.headerCellActive]}
              onPress={() => handleSort("lealtà")}
            >
              <Text style={styles.headerText}>❤️ Lealtà</Text>
              {sortField === "lealtà" && (
                <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>
              )}
            </Pressable>
            <Pressable 
              style={[styles.headerCell, styles.cellSmall, sortField === "paura" && styles.headerCellActive]}
              onPress={() => handleSort("paura")}
            >
              <Text style={styles.headerText}>😨 Paura</Text>
              {sortField === "paura" && (
                <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>
              )}
            </Pressable>
            <Pressable 
              style={[styles.headerCell, styles.cellSmall, sortField === "felicità" && styles.headerCellActive]}
              onPress={() => handleSort("felicità")}
            >
              <Text style={styles.headerText}>😊 Felicità</Text>
              {sortField === "felicità" && (
                <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>
              )}
            </Pressable>
            <Pressable 
              style={[styles.headerCell, styles.cellReligione, sortField === "religione" && styles.headerCellActive]}
              onPress={() => handleSort("religione")}
            >
              <Text style={styles.headerText}>🕊️ Religione</Text>
              {sortField === "religione" && (
                <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>
              )}
            </Pressable>
            <Pressable 
              style={[styles.headerCell, styles.cellFazione, sortField === "fazioni" && styles.headerCellActive]}
              onPress={() => handleSort("fazioni")}
            >
              <Text style={styles.headerText}>⚔️ Fazione</Text>
              {sortField === "fazioni" && (
                <Text style={styles.sortIndicator}>{sortDirection === "asc" ? "↑" : "↓"}</Text>
              )}
            </Pressable>
          </View>

          {/* Righe della tabella */}
          {abitantiOrdinati.map((a: Abitante) => {
            const felicitàModificata = calcolaFelicitàModificata(a);
            const emojiDisplay = getEmojiDisplay(a, etaMinimaLavoro);
            const lavoroDisplay = getLavoroDisplay(a, etaMinimaLavoro);
            return (
              <Pressable
                key={a.id}
                style={styles.tableRow}
                onPress={() => setSelectedAbitante(a)}
              >
                <View style={[styles.cell, styles.cellEmoji]}>
                  <Text style={styles.cellEmojiText}>{emojiDisplay}</Text>
                </View>
                <View style={[styles.cell, styles.cellNome]}>
                  <Text style={styles.cellText}>{a.nome}</Text>
                </View>
                <View style={[styles.cell, styles.cellSmall]}>
                  <Text style={styles.cellText}>{a.eta}</Text>
                </View>
                <View style={[styles.cell, styles.cellLavoro]}>
                  <Text style={[styles.cellTextSmall, lavoroDisplay === "Disoccupato" && styles.cellTextDisoccupato]}>{lavoroDisplay}</Text>
                </View>
                <View style={[styles.cell, styles.cellRazza]}>
                  <Text style={styles.cellEmojiText}>{getEmojiRazza(a.razza ?? "Umano")}</Text>
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
                  <Text style={styles.cellTextSmall}>{a.fazioni?.join(", ") ?? "—"}</Text>
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
        etaMinimaLavoro={etaMinimaLavoro}
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
    justifyContent: "center",
    flexDirection: "row",
    gap: 2
  },
  headerCellActive: {
    backgroundColor: "rgba(59,130,246,0.3)"
  },
  headerText: {
    color: "#93c5fd",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center"
  },
  sortIndicator: {
    color: "#3b82f6",
    fontSize: 10,
    fontWeight: "700"
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
  cellRazza: {
    width: 40,
    minWidth: 40
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
  cellTextDisoccupato: {
    color: "#ef4444",
    fontWeight: "700"
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
