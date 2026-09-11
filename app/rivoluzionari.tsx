import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

const SOGLIA_SODDISFAZIONE = 70;

export default function RivoluzionariScreen() {
  const router = useRouter();
  const { soddisfazioneFazioni } = useGameContext();
  const soddisfazione = soddisfazioneFazioni["Rivoluzionari"] ?? 80;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🔴 Rivoluzionari</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Soddisfazione */}
        <View style={[styles.soddisfazioneCard, soddisfazione < SOGLIA_SODDISFAZIONE && styles.soddisfazioneBassa]}>
          <Text style={styles.soddisfazioneLabel}>Soddisfazione</Text>
          <Text style={styles.soddisfazioneValore}>{soddisfazione}/100</Text>
          {soddisfazione < SOGLIA_SODDISFAZIONE && (
            <Text style={styles.soddisfazioneAvviso}>
              Sotto {SOGLIA_SODDISFAZIONE} può scattare l'evento «Rivoluzionari delusi».
            </Text>
          )}
        </View>

        {/* Descrizione */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chi Sono</Text>
          <Text style={styles.text}>
            I Rivoluzionari sono il Re e i tre abitanti che hanno sostenuto la Rivoluzione contro la Madre
            Patria. La loro soddisfazione parte da 80 e riflette il consenso sulle tue scelte.
          </Text>
        </View>

        {/* Grazia Ex Governatore */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚖️ Grazia all'Ex Governatore</Text>
          <Text style={styles.text}>
            Se al Tribunale grazi l'Ex Governatore, la Soddisfazione dei Rivoluzionari scende di 20 punti. Sono i tuoi
            ex alleati: perdonare il vecchio regime li delude.
          </Text>
        </View>

        {/* Evento negativo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>❌ Rivoluzionari delusi</Text>
          <Text style={styles.text}>
            Se la Soddisfazione scende sotto {SOGLIA_SODDISFAZIONE}, può attivarsi l'evento «Rivoluzionari delusi»:
            per due mesi i membri della fazione perdono Felicità ogni mese.
          </Text>
        </View>

        {/* Effetti */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Effetti</Text>
          <View style={styles.effettoCard}>
            <Text style={styles.effettoEmoji}>🤝</Text>
            <View style={styles.effettoContent}>
              <Text style={styles.effettoTitolo}>Base della Rivoluzione</Text>
              <Text style={styles.effettoDescrizione}>
                Mantenere i Rivoluzionari soddisfatti riduce il rischio di tensioni e eventi negativi legati ai tuoi
                ex alleati.
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
  soddisfazioneBassa: {
    borderColor: "#f97316"
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
  soddisfazioneAvviso: {
    color: "#f97316",
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
