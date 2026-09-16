import React, { useMemo } from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getServiDellaGlebaPerAssegnazioneEdificio } from "../src/game/edificiLavoro";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import type { Abitante } from "../src/types";

export default function CentraleEnergeticaScreen() {
  const router = useRouter();
  const { abitanti, edifici, assegnaAbitanteAEdificio, rimuoviAbitanteDaEdificio, setStipendioEdificio } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const centrale = edifici.find((e) => e.nome === "Centrale Energetica");
  const abitantiAssegnati = centrale ? abitanti.filter((a) => centrale.abitantiAssegnati.includes(a.id)) : [];
  const abitantiDisponibili = useMemo(() => {
    if (!centrale) return [];
    return getServiDellaGlebaPerAssegnazioneEdificio(abitanti, edifici, centrale);
  }, [abitanti, edifici, centrale]);

  if (!centrale) {
    return null;
  }

  // Produzione energia: come in avanzaMese, floor(numAbitanti * produttivitàMedia/10)
  const produttivitàMedia =
    abitantiAssegnati.length > 0
      ? abitantiAssegnati.reduce((sum, a) => sum + a.produttività, 0) / abitantiAssegnati.length
      : 0;
  const produzioneMensile =
    abitantiAssegnati.length > 0
      ? Math.floor(abitantiAssegnati.length * (produttivitàMedia / 10)) || Math.floor(centrale.efficienza / 10)
      : 0;

  const puòAssegnare = abitantiDisponibili.length > 0 && abitantiAssegnati.length < centrale.capacità;

  const colContent = [
    <View key="produzione" style={styles.column}>
      <Text style={styles.sectionTitle}>Produzione</Text>
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Produzione Mensile</Text>
        <Text style={styles.produzioneValue}>
          {produzioneMensile} <Text style={styles.produzioneUnit}>MW</Text>
        </Text>
        <Text style={styles.infoSubtext}>
          {abitantiAssegnati.length} abitante{abitantiAssegnati.length !== 1 ? "i" : ""} assegnato
          {abitantiAssegnati.length !== 1 ? "i" : ""}
        </Text>
        <Text style={styles.infoSubtext}>
          Capacità: {abitantiAssegnati.length}/{centrale.capacità}
        </Text>
        <Text style={styles.infoSubtext}>Consumo: Combustibile</Text>
      </View>
      <View style={styles.stipendioCard}>
        <Text style={styles.stipendioLabel}>Stipendio mensile per lavoratore (crediti)</Text>
        <TextInput
          style={styles.stipendioInput}
          value={String(centrale.stipendioPerLavoratore ?? 0)}
          keyboardType="number-pad"
          onChangeText={(text) => {
            const n = parseInt(text.replace(/[^0-9]/g, ""), 10);
            setStipendioEdificio(centrale.id, isNaN(n) ? 0 : Math.max(0, n));
          }}
        />
        <Text style={styles.infoSubtext}>
          Totale: {(centrale.stipendioPerLavoratore ?? 0) * abitantiAssegnati.length} crediti/mese
        </Text>
      </View>
    </View>,
    <View key="assegnati" style={styles.column}>
      <Text style={styles.sectionTitle}>Abitanti Assegnati</Text>
      {abitantiAssegnati.length > 0 ? (
        <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
          {abitantiAssegnati.map((a: Abitante) => (
            <View key={a.id} style={styles.card}>
              <Text style={styles.cardEmoji}>{getEmojiAbitante(a)}</Text>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{a.nome}</Text>
                <Text style={styles.cardLavoro}>{a.lavoro}</Text>
                <Text style={styles.cardExtra}>Produttività: {a.produttività}%</Text>
              </View>
              <Pressable
                style={styles.removeButton}
                onPress={() => rimuoviAbitanteDaEdificio(a.id, centrale.id)}
              >
                <Text style={styles.removeButtonText}>Rimuovi</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.emptyText}>Nessun abitante assegnato</Text>
      )}
    </View>,
    <View key="disponibili" style={styles.column}>
      <Text style={styles.sectionTitle}>Abitanti Disponibili</Text>
      <Text style={styles.sectionSubtitle}>Lavoro: Disoccupato</Text>
      {abitantiDisponibili.length > 0 ? (
        <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
          {abitantiDisponibili.map((a: Abitante) => (
            <View key={a.id} style={styles.card}>
              <Text style={styles.cardEmoji}>{getEmojiAbitante(a)}</Text>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{a.nome}</Text>
                <Text style={styles.cardExtra}>Produttività: {a.produttività}%</Text>
                <Text style={styles.cardExtra}>Competenza: {a.competenza}%</Text>
                <Text style={styles.cardExtra}>Personalità: {a.personalità}</Text>
              </View>
              {puòAssegnare && (
                <Pressable
                  style={styles.addButton}
                  onPress={() => assegnaAbitanteAEdificio(a.id, centrale.id)}
                >
                  <Text style={styles.addButtonText}>Assegna</Text>
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.emptyText}>Nessun disoccupato disponibile</Text>
      )}
    </View>
  ];

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Centrale Energetica</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView
        style={isDesktop ? styles.scrollViewFlex : undefined}
        horizontal={!isDesktop}
        contentContainerStyle={[styles.content, isDesktop && styles.contentRow]}
        showsHorizontalScrollIndicator={false}
      >
        {colContent}
      </ScrollView>
    </View>
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
  scrollViewFlex: {
    flex: 1
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 12,
    flex: 1
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
    flexGrow: 1
  },
  column: {
    flex: 1,
    minWidth: 220,
    maxWidth: 360
  },
  listScroll: {
    flex: 1,
    maxHeight: 400
  },
  sectionSubtitle: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    marginBottom: 6
  },
  infoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center"
  },
  infoTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  produzioneValue: {
    color: "#4ade80",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 1
  },
  produzioneUnit: {
    color: "rgba(74,222,128,0.7)",
    fontSize: 9,
    fontWeight: "500"
  },
  infoSubtext: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    marginTop: 1
  },
  stipendioCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  stipendioLabel: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4
  },
  stipendioInput: {
    backgroundColor: "rgba(30,41,59,0.9)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    borderRadius: 4,
    padding: 6,
    color: "#e5e7eb",
    fontSize: 14,
    minWidth: 80
  },
  section: {
    marginTop: 4
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    alignSelf: "stretch"
  },
  cardEmoji: {
    fontSize: 24,
    marginBottom: 2
  },
  cardContent: {
    width: "100%",
    alignItems: "center"
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 1,
    textAlign: "center"
  },
  cardLavoro: {
    color: "#93c5fd",
    fontSize: 9,
    marginBottom: 1,
    textAlign: "center"
  },
  cardExtra: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 8,
    textAlign: "center",
    marginTop: 1
  },
  addButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
    width: "100%",
    alignItems: "center"
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "600"
  },
  removeButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
    width: "100%",
    alignItems: "center"
  },
  removeButtonText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "600"
  },
  emptyText: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 10,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8
  }
});
