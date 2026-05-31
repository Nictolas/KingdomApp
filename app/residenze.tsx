import React, { useState } from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import { RESIDENZE_CATALOGO } from "../src/data/residenzeData";
import { AbitanteInfoModal } from "../src/ui/AbitanteInfoModal";
import type { Abitante } from "../src/types";

export default function ResidenzeScreen() {
  const router = useRouter();
  const { edifici, abitanti, prezzoResidenze, setPrezzoResidenza, calcolaFelicitàModificata, etaMinimaLavoro } = useGameContext();
  const [selectedAbitante, setSelectedAbitante] = useState<Abitante | null>(null);
  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const edificiResidenza = edifici.filter((e) => e.tipo === "Residenza");

  const getAbitanteById = (id: number) => abitanti.find((a) => a.id === id);
  const getEdificioByName = (nome: string) => edificiResidenza.find((e) => e.nome === nome);
  const getAbitanteNome = (id: number) => abitanti.find((a) => a.id === id)?.nome ?? `ID ${id}`;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Residenze</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={true}>
        <Text style={styles.intro}>
          Costi in crediti ed energia sono mensili (ogni Skip Mese). L'energia è consumata per ogni residente (es. Baracca 0, Dormitorio 1 MW/abitante). Colonia e catalogo unificati.
        </Text>

        <View style={styles.sezione}>
          <View style={styles.gridSeiColonne}>
            {RESIDENZE_CATALOGO.map((r) => {
              const ed = getEdificioByName(r.nome);
              let assegnati = ed
                ? (ed.abitantiAssegnati ?? []).map((id) => getAbitanteById(id)).filter((a): a is NonNullable<typeof a> => a != null)
                : [];
              if (r.fazioneRichiesta != null) {
                assegnati = assegnati.filter((a) => a.fazioni?.includes(r.fazioneRichiesta!));
              }
              const numAbitanti = assegnati.length;
              const energiaConsumata = r.energiaPerAbitante * numAbitanti;
              return (
                <View key={r.id} style={[styles.colonna, isDesktop && styles.colonnaDesktop]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardEmoji}>{r.emoji}</Text>
                    <Text style={styles.cardNome}>{r.nomePlurale}</Text>
                    {r.fazioneRichiesta != null && (
                      <Text style={styles.fazioneRichiesta}>Solo {r.fazioneRichiesta}</Text>
                    )}
                    {ed != null && (
                      <Text style={styles.occupazione}>
                        {ed.occupazione}/{ed.capacità} posti
                      </Text>
                    )}
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Felicità</Text>
                    <Text style={styles.cardValorePositivo}>+{r.felicità}</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Prezzo (cr/mese)</Text>
                  </View>
                  <View style={styles.prezzoRow}>
                    {r.nome === "Baracca" || r.nome === "Capanna" ? (
                      <Text style={styles.prezzoFisso}>0 (fisso)</Text>
                    ) : (
                      <TextInput
                        style={styles.prezzoInput}
                        value={String(prezzoResidenze[r.nome] ?? r.costoMensile)}
                        keyboardType="number-pad"
                        placeholder={String(r.costoMensile)}
                        placeholderTextColor="rgba(203,213,245,0.4)"
                        onChangeText={(text) => {
                          const n = parseInt(text.replace(/[^0-9]/g, ""), 10);
                          setPrezzoResidenza(r.nome, isNaN(n) ? 0 : n);
                        }}
                      />
                    )}
                    <Text style={styles.prezzoUnit}>cr/mese</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Energia richiesta</Text>
                    <Text style={styles.cardValore}>{r.energiaPerAbitante} MW/abitante</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Energia consumata</Text>
                    <Text style={styles.cardValore}>{energiaConsumata} MW/mese</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Posti per unità</Text>
                    <Text style={styles.cardValore}>{r.postiIllimitati ? "∞" : r.abitanti}</Text>
                  </View>
                  {ed != null && (
                    <>
                      <Text style={styles.abitantiLabel}>Assegnati in colonia</Text>
                      <ScrollView style={styles.abitantiLista} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                        {assegnati.length === 0 ? (
                          <Text style={styles.abitantiVuoto}>Nessuno</Text>
                        ) : (
                          assegnati.map((a) => (
                            <Pressable
                              key={a.id}
                              style={styles.abitanteRiga}
                              onPress={() => setSelectedAbitante(a)}
                            >
                              <Text style={styles.abitanteEmoji}>{getEmojiAbitante(a)}</Text>
                              <Text style={styles.abitanteNome} numberOfLines={1}>
                                {a.nome}
                              </Text>
                            </Pressable>
                          ))
                        )}
                      </ScrollView>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
      </View>

      <AbitanteInfoModal
        visible={selectedAbitante !== null}
        abitante={selectedAbitante}
        onClose={() => setSelectedAbitante(null)}
        getAbitanteNome={getAbitanteNome}
        calcolaFelicitàModificata={calcolaFelicitàModificata}
        etaMinimaLavoro={etaMinimaLavoro}
      />
      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>← Edifici</Text>
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingBottom: 28,
    flexGrow: 1
  },
  intro: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 11,
    marginBottom: 14,
    fontStyle: "italic"
  },
  sezione: {
    marginBottom: 22
  },
  sezioneTitolo: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  gridSeiColonne: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  colonna: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    minWidth: 100,
    flex: 1,
    flexBasis: "48%",
    maxWidth: 220,
    overflow: "hidden"
  },
  colonnaDesktop: {
    flexBasis: "16%"
  },
  cardHeader: {
    alignItems: "center",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.3)"
  },
  occupazione: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    marginTop: 2
  },
  fazioneRichiesta: {
    color: "rgba(203,213,245,0.6)",
    fontSize: 10,
    marginTop: 2,
    fontStyle: "italic"
  },
  abitantiLabel: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  abitantiLista: {
    maxHeight: 120,
    overflow: "hidden"
  },
  abitantiVuoto: {
    color: "rgba(203,213,245,0.4)",
    fontSize: 11,
    fontStyle: "italic",
    paddingVertical: 6
  },
  abitanteRiga: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.2)"
  },
  abitanteEmoji: { fontSize: 16, marginRight: 8 },
  abitanteNome: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "500",
    flex: 1,
    textDecorationLine: "underline"
  },
  vuoto: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 11,
    fontStyle: "italic",
    paddingVertical: 8
  },
  cardEmoji: {
    fontSize: 26,
    marginBottom: 6,
    textAlign: "center"
  },
  cardNome: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center"
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5
  },
  cardLabel: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10
  },
  cardValore: {
    color: "#e5e7eb",
    fontSize: 10,
    fontWeight: "600"
  },
  cardValorePositivo: {
    color: "#4ade80",
    fontSize: 10,
    fontWeight: "700"
  },
  prezzoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 6
  },
  prezzoInput: {
    backgroundColor: "rgba(30,41,59,0.9)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    color: "#e5e7eb",
    fontSize: 11,
    minWidth: 56,
    maxWidth: 80
  },
  prezzoUnit: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10
  },
  prezzoFisso: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600"
  }
});
