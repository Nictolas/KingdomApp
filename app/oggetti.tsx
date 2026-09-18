import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { formatValoreOggetto, OGGETTI_CATALOGO } from "../src/data/oggettiCatalogo";

const COLS = [
  { key: "oggetto", label: "Oggetto", width: 240 },
  { key: "tipologia", label: "Tipologia", width: 130 },
  { key: "valore", label: "Valore", width: 90 }
] as const;

const TABLE_MIN_WIDTH = COLS.reduce((s, c) => s + c.width, 0);

export default function OggettiScreen() {
  const router = useRouter();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🎒 Oggetti</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          <Text style={styles.subtitle}>
            Catalogo oggetti: tipologia (cibo vegetale/animale o altro) e valore di mercato.
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
            <View style={[styles.table, { minWidth: TABLE_MIN_WIDTH }]}>
              <View style={[styles.row, styles.headerRow]}>
                {COLS.map((col) => (
                  <View key={col.key} style={[styles.cell, { width: col.width }]}>
                    <Text
                      style={[
                        styles.headerCellText,
                        col.key === "valore" && styles.headerCellRight
                      ]}
                    >
                      {col.label}
                    </Text>
                  </View>
                ))}
              </View>

              {OGGETTI_CATALOGO.map((o, index) => (
                <View key={o.id} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
                  <View style={[styles.cell, { width: COLS[0].width }]}>
                    <Text style={styles.oggettoCell}>
                      {o.emoji} {o.nome}
                    </Text>
                  </View>
                  <View style={[styles.cell, { width: COLS[1].width }]}>
                    <Text
                      style={[
                        styles.tipologiaText,
                        o.tipologia === "Cibo vegetale" && styles.tipologiaVegetale,
                        o.tipologia === "Cibo animale" && styles.tipologiaAnimale
                      ]}
                    >
                      {o.tipologia}
                    </Text>
                  </View>
                  <View style={[styles.cell, { width: COLS[2].width }]}>
                    <Text style={styles.valoreCell}>{formatValoreOggetto(o)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
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
  content: { paddingHorizontal: 12, paddingVertical: 8, paddingBottom: 16 },
  subtitle: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 12
  },
  table: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(15,23,42,0.95)"
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.35)"
  },
  rowAlt: { backgroundColor: "rgba(30,41,59,0.55)" },
  headerRow: {
    backgroundColor: "rgba(30,41,59,0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.55)"
  },
  cell: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(148,163,184,0.25)"
  },
  headerCellText: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3
  },
  headerCellRight: { textAlign: "right" },
  oggettoCell: { color: "#f8fafc", fontSize: 12, fontWeight: "700" },
  tipologiaText: {
    color: "rgba(226,232,240,0.9)",
    fontSize: 11,
    fontWeight: "600"
  },
  tipologiaVegetale: { color: "#86efac" },
  tipologiaAnimale: { color: "#fca5a5" },
  valoreCell: {
    color: "#fde68a",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
    fontVariant: ["tabular-nums"]
  }
});
