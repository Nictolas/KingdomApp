import React, { useState } from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import type { Abitante } from "../src/types";
import { ReligioneFedeliModal } from "../src/ui/ReligioneFedeliModal";

export default function ReligioneScreen() {
  const router = useRouter();
  const { abitanti, politicaReligiosa, religioneDiStato, setPoliticaReligiosa, setReligioneDiStato } = useGameContext();
  const [selectedReligione, setSelectedReligione] = useState<string | null>(null);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const politiche = [
    {
      id: "ateismo-stato" as const,
      titolo: "Ateismo di Stato",
      descrizione: "Lo stato promuove attivamente l'ateismo e scoraggia le pratiche religiose. Le religioni sono vietate.",
      emoji: "🚫",
      effettoFelicità: "Atei +10% felici"
    },
    {
      id: "religione-stato" as const,
      titolo: "Religione di Stato",
      descrizione: "Una religione ufficiale viene promossa dallo stato. Le altre religioni sono tollerate ma non supportate.",
      emoji: "⛪",
      effettoFelicità: "Tutti -10% felici, religione di stato +20% felici"
    },
    {
      id: "liberta-culto" as const,
      titolo: "Libertà di Culto",
      descrizione: "Tutti gli abitanti sono liberi di praticare qualsiasi religione o essere atei senza interferenze dello stato.",
      emoji: "🕊️",
      effettoFelicità: "Deisti +10% felici"
    }
  ];

  // Calcola percentuali per ogni religione
  const religioni = ["Ateo", "Deista", "Agnostico", "Culto del Sole", "Culto degli Alieni"];
  const totaleAbitanti = abitanti.length;
  
  const religioniConPercentuali = religioni.map((religione) => {
    const fedeli = abitanti.filter((a: Abitante) => a.religione === religione);
    const percentuale = totaleAbitanti > 0 ? Math.round((fedeli.length / totaleAbitanti) * 100) : 0;
    return {
      nome: religione,
      emoji: religione === "Ateo" ? "🚫" : religione === "Deista" ? "🤔" : religione === "Agnostico" ? "❓" : religione === "Culto del Sole" ? "☀️" : "👽",
      count: fedeli.length,
      percentuale
    };
  });

  const religioniDisponibili = ["Ateo", "Deista", "Agnostico", "Culto del Sole", "Culto degli Alieni"] as const;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Leggi
        </Text>
        <Text style={styles.title}>Religione</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Layout a due colonne per ottimizzare lo spazio */}
        <View style={styles.twoColumnsLayout}>
          {/* Colonna sinistra */}
          <View style={styles.leftColumn}>
            {/* Informazioni */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Politica Attuale</Text>
              <Text style={styles.infoText}>
                {politiche.find((p) => p.id === politicaReligiosa)?.titolo || "Nessuna"}
              </Text>
              {politicaReligiosa === "religione-stato" && religioneDiStato && (
                <Text style={styles.infoSubtext}>Religione di Stato: {religioneDiStato}</Text>
              )}
            </View>

            {/* Selettore politiche */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Seleziona Politica</Text>
              <View style={styles.politicheRow}>
                {politiche.map((politica) => {
                  const isSelected = politicaReligiosa === politica.id;
                  return (
                    <Pressable
                      key={politica.id}
                      style={[styles.politicaCardInline, isSelected && styles.politicaCardSelected]}
                      onPress={() => {
                        setPoliticaReligiosa(politica.id);
                        if (politica.id !== "religione-stato") {
                          setReligioneDiStato(null);
                        }
                      }}
                    >
                  <Text style={styles.politicaEmojiInline}>{politica.emoji}</Text>
                  <Text style={[styles.politicaTitoloInline, isSelected && styles.politicaTitoloSelected]}>
                    {politica.titolo}
                  </Text>
                  <Text style={styles.politicaEffetto}>{politica.effettoFelicità}</Text>
                  {isSelected && <Text style={styles.selectedCheck}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>

            {/* Selettore religione di stato */}
            {politicaReligiosa === "religione-stato" && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Religione di Stato</Text>
                <View style={styles.religioniStatoRow}>
                  {religioniDisponibili.map((religione) => {
                    const isSelected = religioneDiStato === religione;
                    return (
                      <Pressable
                        key={religione}
                        style={[styles.religioneStatoCard, isSelected && styles.religioneStatoCardSelected]}
                        onPress={() => setReligioneDiStato(isSelected ? null : religione)}
                      >
                        <Text style={styles.religioneStatoEmoji}>
                          {religione === "Ateo" ? "🚫" : religione === "Deista" ? "🤔" : religione === "Agnostico" ? "❓" : religione === "Culto del Sole" ? "☀️" : "👽"}
                        </Text>
                        <Text style={[styles.religioneStatoNome, isSelected && styles.religioneStatoNomeSelected]}>
                          {religione}
                        </Text>
                        {isSelected && <Text style={styles.selectedCheck}>✓</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* Colonna destra */}
          <View style={styles.rightColumn}>
            {/* Religioni disponibili */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Religioni Disponibili</Text>
              <View style={styles.religioniGrid}>
                {religioniConPercentuali.map((religione) => (
                  <Pressable
                    key={religione.nome}
                    style={styles.religioneCard}
                    onPress={() => setSelectedReligione(religione.nome)}
                  >
                    <Text style={styles.religioneEmoji}>{religione.emoji}</Text>
                    <Text style={styles.religioneNome}>{religione.nome}</Text>
                    <Text style={styles.religionePercentuale}>{religione.percentuale}%</Text>
                    <Text style={styles.religioneCount}>({religione.count})</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Edifici religiosi */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Edifici Religiosi</Text>
              <View style={styles.edificiRow}>
                <Pressable style={styles.edificioCardInline} onPress={() => router.push("/culto-sole")}>
                  <Text style={styles.edificioEmojiInline}>☀️</Text>
                  <Text style={styles.edificioNomeInline}>Culto del Sole</Text>
                </Pressable>
                <Pressable style={styles.edificioCardInline} onPress={() => router.push("/culto-alieni")}>
                  <Text style={styles.edificioEmojiInline}>👽</Text>
                  <Text style={styles.edificioNomeInline}>Culto degli Alieni</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <ReligioneFedeliModal
        visible={selectedReligione !== null}
        religione={selectedReligione || ""}
        abitanti={abitanti}
        onClose={() => setSelectedReligione(null)}
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    paddingBottom: 6,
    flex: 1
  },
  twoColumnsLayout: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start"
  },
  leftColumn: {
    flex: 1,
    minWidth: 0
  },
  rightColumn: {
    flex: 1,
    minWidth: 0
  },
  infoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 8
  },
  infoTitle: {
    color: "#93c5fd",
    fontSize: 9,
    fontWeight: "600",
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  infoText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600"
  },
  infoSubtext: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    marginTop: 3
  },
  section: {
    marginBottom: 8
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 6
  },
  politicheRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 0
  },
  politicaCardInline: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    minHeight: 60
  },
  politicaCardSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "rgba(59,130,246,0.1)"
  },
  politicaEmojiInline: {
    fontSize: 16,
    marginBottom: 3
  },
  politicaTitoloInline: {
    color: "#e5e7eb",
    fontSize: 8,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 2
  },
  politicaEffetto: {
    color: "rgba(203,213,245,0.6)",
    fontSize: 7,
    textAlign: "center",
    marginTop: 2
  },
  selectedCheck: {
    color: "#3b82f6",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2
  },
  religioniStatoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4
  },
  religioneStatoCard: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    minHeight: 60
  },
  religioneStatoCardSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "rgba(59,130,246,0.1)"
  },
  religioneStatoEmoji: {
    fontSize: 18,
    marginBottom: 3
  },
  religioneStatoNome: {
    color: "#e5e7eb",
    fontSize: 8,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 2
  },
  religioneStatoNomeSelected: {
    color: "#93c5fd"
  },
  religioniGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4
  },
  religioneCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    width: "48%",
    minWidth: 100
  },
  religioneEmoji: {
    fontSize: 24,
    marginBottom: 3
  },
  religioneNome: {
    color: "#e5e7eb",
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 2
  },
  religionePercentuale: {
    color: "#4ade80",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 1
  },
  religioneCount: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 8
  },
  edificiRow: {
    flexDirection: "row",
    gap: 4
  },
  edificioCardInline: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    minHeight: 70
  },
  edificioEmojiInline: {
    fontSize: 24,
    marginBottom: 4
  },
  edificioNomeInline: {
    color: "#e5e7eb",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center"
  }
});
