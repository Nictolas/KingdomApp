import React, { useState } from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import type { Abitante } from "../src/types";

export default function TassaRedditoScreen() {
  const router = useRouter();
  const {
    abitanti,
    tipoTassaReddito,
    flatTaxPercentuale,
    scaglioniConfig,
    setTipoTassaReddito,
    setFlatTaxPercentuale,
    setScaglioniConfig
  } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  // Calcola la tassa in base al tipo selezionato
  const calcolaTassa = (reddito: number): number => {
    if (tipoTassaReddito === "flat") {
      return Math.floor(reddito * (flatTaxPercentuale / 100));
    } else {
      // Scaglioni progressivi: ogni scaglione tassa solo la parte del reddito che vi appartiene
      let tassaTotale = 0;
      let redditoProcessato = 0;

      for (const scaglione of scaglioniConfig) {
        if (reddito <= redditoProcessato) break;

        // Calcola quanto del reddito cade in questo scaglione
        const inizioScaglione = Math.max(scaglione.min - 1, redditoProcessato);
        const fineScaglione = scaglione.max === Infinity ? reddito : Math.min(scaglione.max, reddito);
        
        if (fineScaglione > inizioScaglione) {
          const redditoInScaglione = fineScaglione - inizioScaglione;
          tassaTotale += Math.floor(redditoInScaglione * (scaglione.percentuale / 100));
          redditoProcessato = fineScaglione;
        }
      }

      return tassaTotale;
    }
  };

  // Calcola tasse per tutti gli abitanti
  const tasseAbitanti = abitanti.map((abitante) => {
    const tassa = calcolaTassa(abitante.reddito);
    return {
      abitante,
      tassa,
      redditoNetto: abitante.reddito - tassa
    };
  });

  // Calcola totali
  const totaleRedditi = abitanti.reduce((sum, a) => sum + a.reddito, 0);
  const totaleTasse = tasseAbitanti.reduce((sum, t) => sum + t.tassa, 0);
  const totaleRedditiNetto = totaleRedditi - totaleTasse;

  // Funzione per aggiornare uno scaglione
  const aggiornaScaglione = (index: number, campo: "min" | "max" | "percentuale", valore: string) => {
    const nuovoValore = campo === "percentuale" ? parseFloat(valore) || 0 : parseInt(valore) || 0;
    const nuoviScaglioni = [...scaglioniConfig];
    nuoviScaglioni[index] = {
      ...nuoviScaglioni[index],
      [campo]: nuovoValore
    };
    setScaglioniConfig(nuoviScaglioni);
  };

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Tassa sul Reddito</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Selettore tipo tassa */}
        <View style={styles.selectorCard}>
          <Text style={styles.selectorTitle}>Tipo di Tassazione</Text>
          <View style={styles.selectorRow}>
            <Pressable
              style={[styles.selectorButton, tipoTassaReddito === "flat" && styles.selectorButtonActive]}
              onPress={() => setTipoTassaReddito("flat")}
            >
              <Text style={[styles.selectorButtonText, tipoTassaReddito === "flat" && styles.selectorButtonTextActive]}>
                Flat Tax
              </Text>
            </Pressable>
            <Pressable
              style={[styles.selectorButton, tipoTassaReddito === "scaglioni" && styles.selectorButtonActive]}
              onPress={() => setTipoTassaReddito("scaglioni")}
            >
              <Text
                style={[styles.selectorButtonText, tipoTassaReddito === "scaglioni" && styles.selectorButtonTextActive]}
              >
                A Scaglioni
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Configurazione Flat Tax */}
        {tipoTassaReddito === "flat" && (
          <View style={styles.configCard}>
            <Text style={styles.configTitle}>Configurazione Flat Tax</Text>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Percentuale:</Text>
              <TextInput
                style={styles.input}
                value={flatTaxPercentuale.toString()}
                onChangeText={(text) => {
                  const val = parseInt(text) || 0;
                  if (val >= 0 && val <= 100) {
                    setFlatTaxPercentuale(val);
                  }
                }}
                keyboardType="numeric"
                placeholder="15"
              />
              <Text style={styles.inputUnit}>%</Text>
            </View>
            <Text style={styles.configInfo}>
              Tutti i redditi vengono tassati con la stessa percentuale: {flatTaxPercentuale}%
            </Text>
          </View>
        )}

        {/* Configurazione Scaglioni */}
        {tipoTassaReddito === "scaglioni" && (
          <View style={styles.configCard}>
            <Text style={styles.configTitle}>Configurazione Scaglioni</Text>
            {scaglioniConfig.map((scaglione, index) => (
              <View key={index} style={styles.scaglioneConfigRow}>
                <View style={styles.scaglioneInputs}>
                  <TextInput
                    style={styles.scaglioneInput}
                    value={scaglione.min.toString()}
                    onChangeText={(text) => aggiornaScaglione(index, "min", text)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={styles.scaglioneSeparator}>-</Text>
                  <TextInput
                    style={styles.scaglioneInput}
                    value={scaglione.max === Infinity ? "∞" : scaglione.max.toString()}
                    onChangeText={(text) => {
                      if (text === "∞" || text.toLowerCase() === "inf") {
                        aggiornaScaglione(index, "max", "Infinity");
                      } else {
                        aggiornaScaglione(index, "max", text);
                      }
                    }}
                    keyboardType="numeric"
                    placeholder="300"
                  />
                  <Text style={styles.scaglioneSeparator}>:</Text>
                  <TextInput
                    style={styles.scaglioneInput}
                    value={scaglione.percentuale.toString()}
                    onChangeText={(text) => aggiornaScaglione(index, "percentuale", text)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={styles.inputUnit}>%</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Lista abitanti con tasse */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tassazione per Abitante</Text>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {tasseAbitanti.map(({ abitante, tassa, redditoNetto }) => (
              <View key={abitante.id} style={styles.item}>
                <Text style={styles.emoji}>{getEmojiAbitante(abitante)}</Text>
                <View style={styles.itemContent}>
                  <Text style={styles.nome}>{abitante.nome}</Text>
                  <View style={styles.itemRow}>
                    <Text style={styles.label}>Reddito:</Text>
                    <Text style={styles.valore}>{abitante.reddito} crediti</Text>
                  </View>
                  <View style={styles.itemRow}>
                    <Text style={styles.label}>Tassa:</Text>
                    <Text style={styles.valoreTassa}>-{tassa} crediti</Text>
                  </View>
                  <View style={styles.itemRow}>
                    <Text style={styles.label}>Reddito netto:</Text>
                    <Text style={styles.valoreNetto}>{redditoNetto} crediti</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Totali */}
        <View style={styles.totaleContainer}>
          <View style={styles.totaleRow}>
            <Text style={styles.totaleLabel}>Totale redditi:</Text>
            <Text style={styles.totaleValore}>{totaleRedditi} crediti</Text>
          </View>
          <View style={styles.totaleRow}>
            <Text style={styles.totaleLabel}>Totale tasse:</Text>
            <Text style={styles.totaleTasse}>-{totaleTasse} crediti</Text>
          </View>
          <View style={styles.totaleRowFinale}>
            <Text style={styles.totaleLabelFinale}>Entrate nette dalla colonia:</Text>
            <Text style={styles.totaleNetto}>{totaleRedditiNetto} crediti</Text>
          </View>
        </View>
      </ScrollView>
    </View>
    <View style={styles.footer}>
      <Text style={styles.back} onPress={() => router.back()}>← Leggi</Text>
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
    paddingVertical: 6,
    paddingBottom: 8,
    flex: 1
  },
  selectorCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 8
  },
  selectorTitle: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  selectorRow: {
    flexDirection: "row",
    gap: 8
  },
  selectorButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    backgroundColor: "rgba(15,23,42,0.6)",
    alignItems: "center"
  },
  selectorButtonActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6"
  },
  selectorButtonText: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    fontWeight: "600"
  },
  selectorButtonTextActive: {
    color: "#ffffff"
  },
  configCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 8
  },
  configTitle: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6
  },
  inputLabel: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(5,8,22,0.8)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    color: "#ffffff",
    fontSize: 10,
    minWidth: 60
  },
  inputUnit: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600"
  },
  configInfo: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 9,
    fontStyle: "italic"
  },
  scaglioneConfigRow: {
    marginBottom: 6
  },
  scaglioneInputs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  scaglioneInput: {
    flex: 1,
    backgroundColor: "rgba(5,8,22,0.8)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    color: "#ffffff",
    fontSize: 9,
    minWidth: 50
  },
  scaglioneSeparator: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10
  },
  section: {
    marginBottom: 8
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6
  },
  list: {
    maxHeight: 200,
    marginBottom: 4
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: "rgba(15,23,42,0.6)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)"
  },
  emoji: {
    fontSize: 20,
    marginRight: 8
  },
  itemContent: {
    flex: 1
  },
  nome: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 3
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2
  },
  label: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9
  },
  valore: {
    color: "#4ade80",
    fontSize: 9,
    fontWeight: "600"
  },
  valoreTassa: {
    color: "#ef4444",
    fontSize: 9,
    fontWeight: "600"
  },
  valoreNetto: {
    color: "#93c5fd",
    fontSize: 9,
    fontWeight: "600"
  },
  totaleContainer: {
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.3)",
    marginTop: 4
  },
  totaleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  totaleRowFinale: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.3)",
    marginTop: 4
  },
  totaleLabel: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600"
  },
  totaleLabelFinale: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700"
  },
  totaleValore: {
    color: "#4ade80",
    fontSize: 11,
    fontWeight: "700"
  },
  totaleTasse: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "700"
  },
  totaleNetto: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "700"
  }
});
