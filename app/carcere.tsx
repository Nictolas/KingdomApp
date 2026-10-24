import { BuildingResidentAvatar } from "../src/ui/BuildingResidentAvatar";
import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useGameContext } from "../src/context/GameContext";
import type { Abitante } from "../src/types";

export default function CarcereScreen() {
  const { abitanti, edifici } = useGameContext();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const carcere = edifici.find((e) => e.nome === "Carcere");
  const detenutiIds = carcere?.abitantiAssegnati ?? [];
  const detenuti = detenutiIds
    .map((id) => abitanti.find((a) => a.id === id))
    .filter((a): a is Abitante => a != null);

  if (!carcere) return null;

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🔒 Carcere</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.infoTitle}>Stato Carcere</Text>
          <Text style={styles.infoText}>
            Detenuti: {detenuti.length}/{carcere.capacità} · Stato: {carcere.stato}
          </Text>
          <Text style={styles.hint}>
            Struttura di detenzione 2×2 sulla mappa. I condannati dal Tribunale possono essere assegnati qui.
          </Text>

          <Text style={styles.sectionTitle}>Detenuti</Text>
          {detenuti.length === 0 ? (
            <Text style={styles.empty}>Nessun detenuto assegnato al Carcere.</Text>
          ) : (
            detenuti.map((a) => (
              <View key={a.id} style={styles.row}>
                <BuildingResidentAvatar abitante={a} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowNome}>{a.nome}</Text>
                  <Text style={styles.rowInfo}>
                    {a.lavoro}
                    {a.anniCarcereResidui != null && a.anniCarcereResidui > 0
                      ? ` · ${a.anniCarcereResidui} ${a.anniCarcereResidui === 1 ? "anno" : "anni"} residui`
                      : ""}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
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
  content: { paddingHorizontal: 12, paddingVertical: 8, paddingBottom: 12, gap: 8 },
  infoTitle: { color: "#e5e7eb", fontSize: 12, fontWeight: "700" },
  infoText: { color: "rgba(203,213,245,0.85)", fontSize: 11, lineHeight: 16 },
  hint: { color: "rgba(203,213,245,0.65)", fontSize: 10, lineHeight: 14, marginBottom: 4 },
  sectionTitle: { color: "#ffffff", fontSize: 12, fontWeight: "700", marginTop: 8 },
  empty: { color: "rgba(203,213,245,0.7)", fontSize: 11, fontStyle: "italic" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  rowEmoji: { fontSize: 28 },
  rowBody: { flex: 1 },
  rowNome: { color: "#e5e7eb", fontSize: 12, fontWeight: "700" },
  rowInfo: { color: "rgba(203,213,245,0.75)", fontSize: 10, marginTop: 2 }
});
