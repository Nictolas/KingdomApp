import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

export default function SanitaScreen() {
  const router = useRouter();
  const { modalitaSanita, setModalitaSanita } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Sanità</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Modalità sistema sanitario</Text>
          <Text style={styles.sectionSubtitle}>
            Scegli se il sistema sanitario della colonia è <Text style={styles.bold}>Privato</Text> o{" "}
            <Text style={styles.bold}>Pubblico</Text>.
          </Text>

          <Pressable
            style={[styles.option, modalitaSanita === "privata" && styles.optionActive]}
            onPress={() => setModalitaSanita("privata")}
          >
            <Text style={styles.optionTitle}>Sanità Privata</Text>
            <Text style={styles.optionText}>
              Gli stipendi dell&apos;Ospedale non pesano sul bilancio della colonia. Le cure sono a carico
              dei singoli (potrai in futuro modellare costi Salute sugli abitanti).
            </Text>
          </Pressable>

          <Pressable
            style={[styles.option, modalitaSanita === "pubblica" && styles.optionActive]}
            onPress={() => setModalitaSanita("pubblica")}
          >
            <Text style={styles.optionTitle}>Sanità Pubblica</Text>
            <Text style={styles.optionText}>
              Gli stipendi dell&apos;Ospedale vengono pagati dalla colonia e compaiono tra i costi in
              Crediti. In cambio, le cure possono essere considerate gratuite per gli abitanti.
            </Text>
          </Pressable>

          <Text style={styles.helperText}>
            Stato attuale:{" "}
            <Text style={styles.bold}>
              {modalitaSanita === "privata" ? "Sanità Privata" : "Sanità Pubblica"}
            </Text>
          </Text>
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
    paddingVertical: 8,
    paddingBottom: 12,
    flexGrow: 1
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  sectionTitle: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  sectionSubtitle: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 10,
    marginBottom: 8
  },
  bold: {
    fontWeight: "700"
  },
  option: {
    backgroundColor: "rgba(15,23,42,0.9)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    marginBottom: 6
  },
  optionActive: {
    borderColor: "#4ade80"
  },
  optionTitle: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2
  },
  optionText: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 9
  },
  helperText: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 9,
    marginTop: 8
  }
});

