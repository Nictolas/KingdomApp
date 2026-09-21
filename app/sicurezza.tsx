import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

const SOGLIA_SODDISFAZIONE_BLOCCO_GUERRA = 70;

export default function SicurezzaScreen() {
  const router = useRouter();
  const { soddisfazioneFazioni } = useGameContext();
  const soddisfazione = soddisfazioneFazioni["Sicurezza"] ?? 80;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🚔 Sicurezza</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Soddisfazione */}
        <View style={styles.soddisfazioneCard}>
          <Text style={styles.soddisfazioneLabel}>Soddisfazione</Text>
          <Text style={styles.soddisfazioneValore}>{soddisfazione}/100</Text>
          <Text style={styles.soddisfazioneHint}>
            Con Caserma (almeno 3 addetti) e Soddisfazione ≥ {SOGLIA_SODDISFAZIONE_BLOCCO_GUERRA} si blocca l'evento Guerra Civile.
          </Text>
        </View>

        {/* Descrizione */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chi Sono</Text>
          <Text style={styles.text}>
            La fazione Sicurezza rappresenta le forze di ordine e difesa del regno: guardie, polizia e militari.
            Garantiscono la protezione dei coloni e il rispetto delle leggi.
          </Text>
        </View>

        {/* Cosa Vuole */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✅ Cosa Vuole</Text>
          <View style={styles.listItem}>
            <Text style={styles.listEmoji}>⚖️</Text>
            <Text style={styles.listText}>Leggi severe e pena di morte per scoraggiare il crimine</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listEmoji}>💰</Text>
            <Text style={styles.listText}>Risorse sufficienti per pattugliamenti e tribunali</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listEmoji}>🔒</Text>
            <Text style={styles.listText}>Controllo su immigrazione e divieti di espatrio se necessario</Text>
          </View>
        </View>

        {/* Cosa Non Vuole */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>❌ Cosa Non Vuole</Text>
          <View style={styles.listItem}>
            <Text style={styles.listEmoji}>🕴️</Text>
            <Text style={styles.listText}>Impunità della Mafia e corruzione delle istituzioni</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listEmoji}>🔓</Text>
            <Text style={styles.listText}>Legalizzazione delle droghe senza controllo</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listEmoji}>📉</Text>
            <Text style={styles.listText}>Tagli al budget per tribunale e forze dell'ordine</Text>
          </View>
        </View>

        {/* Caserma e Guerra Civile */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏰 Caserma e Guerra Civile</Text>
          <Text style={styles.text}>
            Assegna almeno 3 abitanti alla Caserma (pagina Edifici). Con Soddisfazione Sicurezza ≥ {SOGLIA_SODDISFAZIONE_BLOCCO_GUERRA}%
            l'evento Guerra Civile non scatta quando i Lealisti sono maggioranza. Se scatta comunque, la Caserma piena mitiga
            gli effetti (malus ridotti, una sola vittima invece di due).
          </Text>
        </View>

        {/* Effetti */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Effetti</Text>
          <View style={styles.effettoCard}>
            <Text style={styles.effettoEmoji}>😌</Text>
            <View style={styles.effettoContent}>
              <Text style={styles.effettoTitolo}>Stabilità</Text>
              <Text style={styles.effettoDescrizione}>
                Un regno con leggi chiare e forze di sicurezza efficienti riduce la paura e il crimine, aumentando
                la lealtà dei cittadini.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
      </View>
      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>← Fazioni</Text>
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
  soddisfazioneCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 12
  },
  soddisfazioneLabel: {
    color: "rgba(148,163,184,0.9)",
    fontSize: 10,
    marginBottom: 2
  },
  soddisfazioneValore: {
    color: "#e5e7eb",
    fontSize: 18,
    fontWeight: "700"
  },
  soddisfazioneHint: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    marginTop: 6
  },
  section: {
    marginBottom: 12
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8
  },
  text: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 6,
    padding: 8
  },
  listEmoji: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 2
  },
  listText: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14,
    flex: 1
  },
  effettoCard: {
    flexDirection: "row",
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  effettoEmoji: {
    fontSize: 32,
    marginRight: 10
  },
  effettoContent: {
    flex: 1
  },
  effettoTitolo: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4
  },
  effettoDescrizione: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14
  }
});
