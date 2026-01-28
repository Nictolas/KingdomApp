import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { abitantiData } from "../src/kingdomData";
import type { Abitante } from "../src/types";

export default function AbitantiScreen() {
  const router = useRouter();
  const abitanti = abitantiData;

  const getAbitanteNome = (id: number) => {
    return abitanti.find((a) => a.id === id)?.nome || `ID ${id}`;
  };

  const formatPercentuale = (valore: number) => `${valore}%`;
  const formatMonete = (valore: number) => `${valore} monete`;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>Abitanti</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {abitanti.map((a: Abitante) => (
          <View key={a.id} style={styles.card}>
            <Text style={styles.cardTitle}>{a.nome}</Text>

            {/* Informazioni base */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Informazioni Base</Text>
              <Text style={styles.line}>Età: {a.eta} anni</Text>
              <Text style={styles.line}>Lavoro: {a.lavoro}</Text>
              <Text style={styles.line}>Fazione: {a.fazione}</Text>
              <Text style={styles.line}>Personalità: {a.personalità}</Text>
            </View>

            {/* Competenze e stato */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Competenze e Stato</Text>
              <Text style={styles.line}>Competenza: {formatPercentuale(a.competenza)}</Text>
              <Text style={styles.line}>Produttività: {formatPercentuale(a.produttività)}</Text>
              <Text style={styles.line}>Stanchezza: {formatPercentuale(a.stanchezza)}</Text>
              <Text style={styles.line}>Salute: {formatPercentuale(a.salute)}</Text>
            </View>

            {/* Relazioni */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Relazioni</Text>
              {a.amici.length > 0 ? (
                <Text style={styles.line}>
                  Amici: {a.amici.map((id) => getAbitanteNome(id)).join(", ")}
                </Text>
              ) : (
                <Text style={styles.lineMuted}>Nessun amico</Text>
              )}
              {a.rivali.length > 0 ? (
                <Text style={styles.line}>
                  Rivali: {a.rivali.map((id) => getAbitanteNome(id)).join(", ")}
                </Text>
              ) : (
                <Text style={styles.lineMuted}>Nessun rivale</Text>
              )}
            </View>

            {/* Economia */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Economia</Text>
              <Text style={styles.line}>Crediti: {formatMonete(a.crediti)}</Text>
              <Text style={styles.line}>Reddito: {formatMonete(a.reddito)}/mese</Text>
              <Text style={styles.line}>Spese: {formatMonete(a.spese)}/mese</Text>
              <Text style={styles.line}>
                Saldo mensile: {formatMonete(a.reddito - a.spese)}
              </Text>
            </View>

            {/* Sentimenti */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Sentimenti</Text>
              <Text style={styles.line}>Lealtà: {formatPercentuale(a.lealtà)}</Text>
              <Text style={styles.line}>Paura: {formatPercentuale(a.paura)}</Text>
            </View>
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
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12
  },
  section: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.2)"
  },
  sectionLabel: {
    color: "#93c5fd",
    fontSize: 13,
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
  lineMuted: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 13,
    marginBottom: 4,
    fontStyle: "italic"
  }
});

