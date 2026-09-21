import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { REGOLE_GENERAZIONE_PARTITA } from "../src/game/generazionePartita";

export default function GenerazionePartitaScreen() {
  const router = useRouter();
  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🎲 Generazione Partita</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={true}>
        <Text style={styles.intro}>
          Ogni partita il regno iniziale è generato a caso. Di seguito le regole di distribuzione attualmente in uso.
        </Text>

        <View style={[styles.griglia, isDesktop && styles.grigliaDesktop]}>
          {REGOLE_GENERAZIONE_PARTITA.map((sezione) => (
            <View key={sezione.titolo} style={styles.sezione}>
              <Text style={styles.sezioneTitolo}>{sezione.titolo}</Text>
              {sezione.punti.map((punto, idx) => (
                <View key={idx} style={styles.punto}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.puntoTesto}>{punto}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
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
    padding: 20,
    paddingBottom: 32,
    flexGrow: 1
  },
  intro: {
    color: "rgba(203,213,245,0.9)",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 24,
    maxWidth: 720
  },
  griglia: {
    flexDirection: "column",
    gap: 0
  },
  grigliaDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    justifyContent: "flex-start"
  },
  sezione: {
    marginBottom: 20,
    padding: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.3)",
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    minWidth: 260,
    flex: 1,
    flexBasis: "31%",
    maxWidth: 380
  },
  sezioneTitolo: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  punto: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8
  },
  bullet: {
    color: "#93c5fd",
    fontSize: 12,
    marginRight: 8
  },
  puntoTesto: {
    color: "#e5e7eb",
    fontSize: 12,
    flex: 1,
    lineHeight: 18
  }
});
