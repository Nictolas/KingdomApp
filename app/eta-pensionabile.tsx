import React, { useState, useEffect } from "react";
import {
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

export default function EtaPensionabileScreen() {
  const router = useRouter();
  const { etaPensionabile, setEtaPensionabile, assegnoPensionati, setAssegnoPensionati } = useGameContext();

  const [inputAssegno, setInputAssegno] = useState(String(assegnoPensionati));
  useEffect(() => setInputAssegno(String(assegnoPensionati)), [assegnoPensionati]);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const etaOptions = [55, 60, 65, 70, 75, 80, 85, 90];

  const sanzionePunti =
    etaPensionabile >= 81 ? 3 : etaPensionabile >= 71 ? 2 : etaPensionabile >= 61 ? 1 : 0;
  const haSanzione = sanzionePunti > 0;

  const applyAssegno = () => {
    const n = parseInt(inputAssegno, 10);
    if (!Number.isNaN(n) && n >= 0) setAssegnoPensionati(Math.min(9999, n));
    else setInputAssegno(String(assegnoPensionati));
  };

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Età pensionabile</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Configurazione attuale</Text>
          <Text style={styles.infoText}>Età pensionabile: {etaPensionabile} anni</Text>
          <Text style={styles.infoText}>Assegno mensile ai pensionati: {assegnoPensionati} crediti</Text>
          {haSanzione && (
            <Text style={styles.warningText}>
              ⚠️ Questa età pensionabile aumenta il punteggio sanzioni della Comunità Interplanetaria di +{sanzionePunti} punto/s.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seleziona età pensionabile</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.etaBarContainer}
          >
            {etaOptions.map((eta) => {
              const isSelected = etaPensionabile === eta;
              const punti =
                eta >= 81 ? 3 : eta >= 71 ? 2 : eta >= 61 ? 1 : 0;
              const haSanzioneEta = punti > 0;
              return (
                <Pressable
                  key={eta}
                  style={[
                    styles.etaButton,
                    isSelected && styles.etaButtonSelected,
                    haSanzioneEta && styles.etaButtonWarning
                  ]}
                  onPress={() => setEtaPensionabile(eta)}
                >
                  <Text style={[styles.etaValue, isSelected && styles.etaValueSelected]}>{eta}</Text>
                  <Text style={styles.etaLabel}>anni</Text>
                  {isSelected && <Text style={styles.selectedCheck}>✓</Text>}
                  {haSanzioneEta && (
                    <Text style={styles.sanzioneBadge}>+{punti} ⚠️</Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assegno mensile ai pensionati (crediti)</Text>
          <View style={styles.assegnoRow}>
            <TextInput
              style={styles.input}
              value={inputAssegno}
              onChangeText={setInputAssegno}
              onBlur={applyAssegno}
              keyboardType="number-pad"
              placeholder="0"
            />
            <Pressable style={styles.applyButton} onPress={applyAssegno}>
              <Text style={styles.applyButtonText}>Applica</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.descCard}>
          <Text style={styles.descTitle}>Descrizione</Text>
          <Text style={styles.descText}>
            Stabilisce a quale età gli abitanti passano automaticamente in pensione. I pensionati non lavorano e
            ricevono ogni mese l&apos;assegno che imposti. L&apos;età pensionabile troppo alta può comportare
            sanzioni dalla Comunità Interplanetaria.
          </Text>
        </View>

        <View style={styles.effettiCard}>
          <Text style={styles.effettiTitle}>Effetti</Text>
          <View style={styles.effettoRow}>
            <Text style={styles.effettoEmoji}>👴</Text>
            <Text style={styles.effettoText}>
              Oltre l&apos;età scelta, l&apos;abitante diventa &quot;Pensionato&quot; e non lavora più
            </Text>
          </View>
          <View style={styles.effettoRow}>
            <Text style={styles.effettoEmoji}>💰</Text>
            <Text style={styles.effettoText}>
              Ogni pensionato riceve mensilmente l&apos;assegno in crediti (costo per il regno)
            </Text>
          </View>
          <View style={styles.effettoRow}>
            <Text style={styles.effettoEmoji}>⚠️</Text>
            <Text style={styles.effettoText}>Età 61–70: +1 punto sanzioni • 71–80: +2 • 81+: +3</Text>
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
  infoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 10
  },
  infoTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  infoText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4
  },
  warningText: {
    color: "#f97316",
    fontSize: 9,
    marginTop: 4,
    fontStyle: "italic"
  },
  section: {
    marginBottom: 10
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6
  },
  etaBarContainer: {
    flexDirection: "row",
    paddingVertical: 4,
    gap: 6
  },
  etaButton: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
    position: "relative"
  },
  etaButtonSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "rgba(59,130,246,0.1)",
    borderWidth: 2
  },
  etaButtonWarning: {
    borderColor: "#f97316",
    backgroundColor: "rgba(249,115,22,0.05)"
  },
  etaValue: {
    color: "#e5e7eb",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2
  },
  etaValueSelected: {
    color: "#93c5fd"
  },
  etaLabel: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 8,
    marginBottom: 2
  },
  selectedCheck: {
    color: "#3b82f6",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2
  },
  sanzioneBadge: {
    color: "#f97316",
    fontSize: 8,
    fontWeight: "600",
    marginTop: 2
  },
  assegnoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  input: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    borderRadius: 6,
    color: "#e5e7eb",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    minWidth: 80
  },
  applyButton: {
    backgroundColor: "rgba(59,130,246,0.2)",
    borderWidth: 1,
    borderColor: "#3b82f6",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  applyButtonText: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600"
  },
  descCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 10
  },
  descTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  descText: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    lineHeight: 13
  },
  effettiCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  effettiTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  effettoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4
  },
  effettoEmoji: {
    fontSize: 14,
    marginRight: 6,
    marginTop: 1
  },
  effettoText: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    lineHeight: 13,
    flex: 1
  }
});
