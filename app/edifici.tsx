import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { EDIFICI_CATENA_PRODUTTIVA } from "../src/data/edificiCatenaProduttiva";

const COLS = [
  { key: "edificio", label: "Edificio", width: 170 },
  { key: "tipologia", label: "Tipologia", width: 100 },
  { key: "richiede", label: "Richiede", width: 200 },
  { key: "lavoratore", label: "Lavoratore", width: 140 },
  { key: "produce", label: "Produce", width: 170 },
  { key: "serveA", label: "Serve a", width: 180 }
] as const;

const TABLE_MIN_WIDTH = COLS.reduce((s, c) => s + c.width, 0);

export default function EdificiScreen() {
  const router = useRouter();

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight != null ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🏗️ Edifici</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          style={isDesktop ? styles.scrollFlex : undefined}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator
        >
          <Text style={styles.subtitle}>
            Catena produttiva: tipologia (Impresa = economia, Servizio = pubblico), input, lavoratori, output e destinatari.
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
            <View style={[styles.table, { minWidth: TABLE_MIN_WIDTH }]}>
              <View style={[styles.row, styles.headerRow]}>
                {COLS.map((col) => (
                  <View key={col.key} style={[styles.cell, { width: col.width }]}>
                    <Text style={styles.headerCellText}>{col.label}</Text>
                  </View>
                ))}
              </View>

              {EDIFICI_CATENA_PRODUTTIVA.map((row, index) => (
                <View
                  key={row.nome}
                  style={[styles.row, index % 2 === 1 && styles.rowAlt]}
                >
                  <View style={[styles.cell, { width: COLS[0].width }]}>
                    <Text style={styles.edificioCell}>
                      {row.emoji} {row.nome}
                    </Text>
                  </View>
                  <View style={[styles.cell, { width: COLS[1].width }]}>
                    <Text
                      style={[
                        styles.tipologiaText,
                        row.tipologia === "Impresa" ? styles.tipologiaImpresa : styles.tipologiaServizio
                      ]}
                    >
                      {row.tipologia}
                    </Text>
                  </View>
                  <View style={[styles.cell, { width: COLS[2].width }]}>
                    <Text style={styles.cellText}>{row.richiede}</Text>
                  </View>
                  <View style={[styles.cell, { width: COLS[3].width }]}>
                    <Text style={styles.cellText}>{row.lavoratore}</Text>
                  </View>
                  <View style={[styles.cell, { width: COLS[4].width }]}>
                    <Text style={styles.cellText}>{row.produce}</Text>
                  </View>
                  <View style={[styles.cell, { width: COLS[5].width }]}>
                    <Text style={styles.cellText}>{row.serveA}</Text>
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
    paddingBottom: 16
  },
  scrollFlex: {
    flex: 1
  },
  subtitle: {
    color: "rgba(203,213,245,0.75)",
    fontSize: 11,
    lineHeight: 15,
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
  rowAlt: {
    backgroundColor: "rgba(30,41,59,0.55)"
  },
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
  edificioCell: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700"
  },
  tipologiaText: {
    fontSize: 11,
    fontWeight: "700"
  },
  tipologiaImpresa: {
    color: "#86efac"
  },
  tipologiaServizio: {
    color: "#93c5fd"
  },
  cellText: {
    color: "#e2e8f0",
    fontSize: 11,
    lineHeight: 15
  }
});
