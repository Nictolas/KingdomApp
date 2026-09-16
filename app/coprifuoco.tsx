import React, { useMemo } from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { formatOraDaMinuti } from "../src/game/coprifuoco";

const ORE = Array.from({ length: 24 }, (_, i) => i);

export default function CoprifuocoScreen() {
  const router = useRouter();
  const {
    coprifuocoAttivo,
    setCoprifuocoAttivo,
    coprifuocoInizioMinuti,
    setCoprifuocoInizioMinuti,
    coprifuocoFineMinuti,
    setCoprifuocoFineMinuti
  } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const oraInizio = Math.floor(coprifuocoInizioMinuti / 60) % 24;
  const oraFine = Math.floor(coprifuocoFineMinuti / 60) % 24;

  const fasciaLabel = useMemo(
    () => `${formatOraDaMinuti(coprifuocoInizioMinuti)} → ${formatOraDaMinuti(coprifuocoFineMinuti)}`,
    [coprifuocoInizioMinuti, coprifuocoFineMinuti]
  );

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🌙 Coprifuoco</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Stato attuale</Text>
            <Text style={styles.infoText}>
              {coprifuocoAttivo
                ? `Coprifuoco attivo: ${fasciaLabel}. In quella fascia nessuno può stare «In giro», tranne chi lavora alla Centrale (occupazione Sicurezza).`
                : "Il coprifuoco non è attivo."}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attiva / disattiva</Text>
            <Pressable
              style={[styles.toggleButton, coprifuocoAttivo && styles.toggleButtonActive]}
              onPress={() => setCoprifuocoAttivo(!coprifuocoAttivo)}
            >
              <Text style={[styles.toggleText, coprifuocoAttivo && styles.toggleTextActive]}>
                {coprifuocoAttivo ? "✓ Attivo" : "Disattivo"}
              </Text>
            </Pressable>
          </View>

          {coprifuocoAttivo && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Fascia oraria</Text>
              <Text style={styles.hint}>
                Dalle ore di inizio (incluse) fino alle ore di fine (escluse). Se l’inizio è dopo la fine, la fascia
                attraversa la mezzanotte.
              </Text>

              <Text style={styles.pickerLabel}>Dalle ore</Text>
              <View style={styles.oreRow}>
                {ORE.map((h) => {
                  const selected = h === oraInizio;
                  return (
                    <Pressable
                      key={`in-${h}`}
                      style={[styles.oraChip, selected && styles.oraChipSelected]}
                      onPress={() => setCoprifuocoInizioMinuti(h * 60)}
                    >
                      <Text style={[styles.oraChipText, selected && styles.oraChipTextSelected]}>
                        {String(h).padStart(2, "0")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.pickerLabel}>Alle ore</Text>
              <View style={styles.oreRow}>
                {ORE.map((h) => {
                  const selected = h === oraFine;
                  return (
                    <Pressable
                      key={`fi-${h}`}
                      style={[styles.oraChip, selected && styles.oraChipSelected]}
                      onPress={() => setCoprifuocoFineMinuti(h * 60)}
                    >
                      <Text style={[styles.oraChipText, selected && styles.oraChipTextSelected]}>
                        {String(h).padStart(2, "0")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fasciaPreview}>Fascia: {fasciaLabel}</Text>
            </View>
          )}

          <View style={styles.effettiCard}>
            <Text style={styles.effettiTitle}>Effetti</Text>
            <View style={styles.effettoRow}>
              <Text style={styles.effettoEmoji}>🚶</Text>
              <Text style={styles.effettoText}>
                Durante il coprifuoco gli abitanti non possono restare «In giro» sulla mappa.
              </Text>
            </View>
            <View style={styles.effettoRow}>
              <Text style={styles.effettoEmoji}>🚔</Text>
              <Text style={styles.effettoText}>
                Esenti: chi lavora alla Centrale (occupazione Sicurezza).
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Leggi
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050816" },
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
  back: { color: "#93c5fd", fontSize: 12 },
  title: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  content: { paddingHorizontal: 12, paddingVertical: 6, paddingBottom: 8, flexGrow: 1 },
  infoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 10
  },
  infoTitle: { color: "#93c5fd", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  infoText: { color: "rgba(203,213,245,0.85)", fontSize: 10, lineHeight: 14 },
  section: { marginBottom: 12 },
  sectionTitle: { color: "#e5e7eb", fontSize: 12, fontWeight: "700", marginBottom: 6 },
  hint: { color: "rgba(203,213,245,0.65)", fontSize: 9, lineHeight: 13, marginBottom: 8 },
  toggleButton: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center"
  },
  toggleButtonActive: {
    borderColor: "#60a5fa",
    backgroundColor: "rgba(30,58,138,0.35)"
  },
  toggleText: { color: "#94a3b8", fontSize: 13, fontWeight: "700" },
  toggleTextActive: { color: "#93c5fd" },
  pickerLabel: { color: "#93c5fd", fontSize: 10, fontWeight: "600", marginBottom: 4, marginTop: 4 },
  oreRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 6 },
  oraChip: {
    width: 36,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.45)",
    backgroundColor: "rgba(15,23,42,0.9)",
    alignItems: "center"
  },
  oraChipSelected: {
    borderColor: "#60a5fa",
    backgroundColor: "rgba(30,58,138,0.45)"
  },
  oraChipText: { color: "#94a3b8", fontSize: 10, fontWeight: "600" },
  oraChipTextSelected: { color: "#93c5fd" },
  fasciaPreview: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "center"
  },
  effettiCard: {
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 8,
    padding: 10,
    marginTop: 4
  },
  effettiTitle: { color: "#ffffff", fontSize: 11, fontWeight: "700", marginBottom: 8 },
  effettoRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  effettoEmoji: { fontSize: 14, marginRight: 8, marginTop: 1 },
  effettoText: { color: "rgba(203,213,245,0.75)", fontSize: 10, lineHeight: 14, flex: 1 }
});
