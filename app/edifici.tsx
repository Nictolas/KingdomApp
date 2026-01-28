import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { edificiData } from "../src/kingdomData";
import type { Edificio } from "../src/types";

export default function EdificiScreen() {
  const router = useRouter();
  const edifici = edificiData;

  const getStatoColor = (stato: Edificio["stato"]) => {
    switch (stato) {
      case "Operativo":
        return "#4ade80";
      case "In costruzione":
        return "#fde047";
      case "In manutenzione":
        return "#fb923c";
      case "Danneggiato":
        return "#f97373";
      default:
        return "#cbd5f5";
    }
  };

  const formatCrediti = (valore: number) => `${valore} crediti`;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>Edifici</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {edifici.map((e: Edificio) => (
          <View key={e.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{e.nome}</Text>
              <View
                style={[
                  styles.statoBadge,
                  { backgroundColor: getStatoColor(e.stato) + "20" }
                ]}
              >
                <Text style={[styles.statoText, { color: getStatoColor(e.stato) }]}>
                  {e.stato}
                </Text>
              </View>
            </View>

            <Text style={styles.tipo}>{e.tipo}</Text>
            <Text style={styles.descrizione}>{e.descrizione}</Text>

            {/* Informazioni base */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Informazioni</Text>
              <Text style={styles.line}>Livello: {e.livello}</Text>
              <Text style={styles.line}>
                Occupazione: {e.occupazione}/{e.capacità}
              </Text>
              <Text style={styles.line}>Efficienza: {e.efficienza}%</Text>
              <Text style={styles.line}>
                Manutenzione: {formatCrediti(e.manutenzione)}/mese
              </Text>
            </View>

            {/* Produzione e consumo */}
            {(e.produzione || e.consumo) && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Risorse</Text>
                {e.produzione && (
                  <Text style={styles.line}>
                    <Text style={styles.label}>Produce: </Text>
                    {e.produzione}
                  </Text>
                )}
                {e.consumo && (
                  <Text style={styles.line}>
                    <Text style={styles.label}>Consuma: </Text>
                    {e.consumo}
                  </Text>
                )}
              </View>
            )}
          </View>
        ))}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)"
  },
  back: {
    color: "#93c5fd",
    fontSize: 14
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700"
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 32,
    gap: 12
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 20,
    fontWeight: "700",
    flex: 1
  },
  statoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8
  },
  statoText: {
    fontSize: 11,
    fontWeight: "600"
  },
  tipo: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  descrizione: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18
  },
  section: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.2)"
  },
  sectionLabel: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  line: {
    color: "#cbd5f5",
    fontSize: 13,
    marginBottom: 4
  },
  label: {
    color: "rgba(203,213,245,0.7)",
    fontWeight: "500"
  }
});
