import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

export default function LeggeFamiglieScreen() {
  const router = useRouter();
  const { tipologieFamigliaAccettate, setTipologieFamigliaAccettate } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const tipologie = [
    {
      chiave: "tradizionale" as const,
      emoji: "👨‍👩‍👧‍👦",
      titolo: "Famiglia Tradizionale",
      descrizione: "Famiglia composta da due genitori di sesso diverso e i loro figli."
    },
    {
      chiave: "interrazziale" as const,
      emoji: "🌍",
      titolo: "Famiglia Interrazziale",
      descrizione: "Famiglia composta da genitori di razze diverse (es. Umano, Grigi, Nordici, Rettiliani, Insettoidi, Marini, Ferini)."
    },
    {
      chiave: "arcobaleno" as const,
      emoji: "🌈",
      titolo: "Famiglia Arcobaleno",
      descrizione: "Famiglia composta da genitori dello stesso sesso."
    },
    {
      chiave: "monogenitoriale" as const,
      emoji: "👤",
      titolo: "Famiglia Monogenitoriale",
      descrizione: "Famiglia composta da un solo genitore e i suoi figli."
    },
    {
      chiave: "matrimonioUmanoRobot" as const,
      emoji: "🤖💒",
      titolo: "Matrimonio Umano-Robot",
      descrizione: "Consenti il matrimonio tra abitanti umani (o altre razze) e Robot: le coppie miste possono sposarsi."
    }
  ];

  const toggleTipologia = (chiave: keyof typeof tipologieFamigliaAccettate) => {
    setTipologieFamigliaAccettate({
      ...tipologieFamigliaAccettate,
      [chiave]: !tipologieFamigliaAccettate[chiave]
    });
  };

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Leggi
        </Text>
        <Text style={styles.title}>👨‍👩‍👧 Legge sulle Famiglie</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.descrizione}>
          Seleziona quali tipologie di famiglia sono accettate e riconosciute legalmente nella colonia.
        </Text>

        <View style={styles.opzioniContainer}>
          {tipologie.map((tipologia) => {
            const isAccettata = tipologieFamigliaAccettate[tipologia.chiave];
            return (
              <Pressable
                key={tipologia.chiave}
                style={[styles.opzioneCard, isAccettata && styles.opzioneCardSelected]}
                onPress={() => toggleTipologia(tipologia.chiave)}
              >
                <View style={styles.opzioneHeader}>
                  <Text style={styles.opzioneEmoji}>{tipologia.emoji}</Text>
                  <View style={styles.opzioneTitoloContainer}>
                    <Text style={[styles.opzioneTitolo, isAccettata && styles.opzioneTitoloSelected]}>
                      {tipologia.titolo}
                    </Text>
                  </View>
                  <View style={[styles.checkbox, isAccettata && styles.checkboxSelected]}>
                    {isAccettata && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </View>
                <Text style={[styles.opzioneDescrizione, isAccettata && styles.opzioneDescrizioneSelected]}>
                  {tipologia.descrizione}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Informazioni */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Stato Attuale</Text>
          <Text style={styles.infoText}>
            {Object.values(tipologieFamigliaAccettate).every((v) => v)
              ? "Tutte le tipologie di famiglia sono accettate."
              : Object.values(tipologieFamigliaAccettate).some((v) => v)
                ? "Alcune tipologie di famiglia sono accettate."
                : "Nessuna tipologia di famiglia è accettata."}
          </Text>
        </View>
      </ScrollView>
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    paddingBottom: 8,
    flex: 1
  },
  descrizione: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 12
  },
  opzioniContainer: {
    gap: 8,
    marginBottom: 12
  },
  opzioneCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  opzioneCardSelected: {
    borderColor: "#3b82f6",
    borderWidth: 2,
    backgroundColor: "rgba(59,130,246,0.1)"
  },
  opzioneHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6
  },
  opzioneEmoji: {
    fontSize: 24,
    marginRight: 10
  },
  opzioneTitoloContainer: {
    flex: 1
  },
  opzioneTitolo: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "700"
  },
  opzioneTitoloSelected: {
    color: "#93c5fd"
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  checkboxSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "#3b82f6"
  },
  checkmark: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700"
  },
  opzioneDescrizione: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14,
    marginLeft: 34
  },
  opzioneDescrizioneSelected: {
    color: "rgba(203,213,245,0.9)"
  },
  infoSection: {
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 8,
    padding: 10,
    marginTop: 8
  },
  infoTitle: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  infoText: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14
  }
});
