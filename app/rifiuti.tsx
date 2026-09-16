import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";

export default function RifiutiScreen() {
  const router = useRouter();
  const { risorse, edifici } = useGameContext();

  const risorsaRifiuti = risorse.find((r) => r.nome.toLowerCase().includes("rifiuti"));
  const scortaAttuale = risorsaRifiuti?.quantità ?? 0;
  const unità = risorsaRifiuti?.unità ?? "tonnellate";

  const edificiProducono = edifici.filter(
    (e) => e.produzione?.toLowerCase().includes("rifiuti")
  );
  const edificiConsumano = edifici.filter(
    (e) => e.consumo?.toLowerCase().includes("rifiuti")
  );

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🗑️ Rifiuti</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.mediaCard}>
          <Text style={styles.mediaLabel}>Scorta attuale (colonia)</Text>
          <Text style={styles.mediaValue}>
            {scortaAttuale} <Text style={styles.mediaUnit}>{unità}</Text>
          </Text>
          <Text style={styles.mediaSubtext}>
            Quantità di rifiuti attualmente in magazzino. Prodotta dagli edifici residenziali e consumata dall&apos;Impianto di Riciclo.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Produzione e consumo (nel codice)</Text>
        <Text style={styles.sectionIntro}>
          I rifiuti sono una risorsa tracciata in stato (risorseData / useGameState). Alcuni edifici li producono, altri li consumano.
        </Text>

        <View style={styles.modCard}>
          <Text style={styles.modTitle}>1. Edifici che producono Rifiuti (edificiData → produzione)</Text>
          {edificiProducono.length > 0 ? (
            edificiProducono.map((e) => (
              <View key={e.id} style={styles.modItem}>
                <Text style={styles.modBullet}>•</Text>
                <Text style={styles.modText}>
                  <Text style={styles.modBold}>{e.emoji} {e.nome}</Text> — {e.descrizione}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.modItem}>
              <Text style={styles.modBullet}>•</Text>
              <Text style={styles.modText}>Nessun edificio con produzione &quot;Rifiuti&quot; nello stato attuale.</Text>
            </View>
          )}
        </View>

        <View style={styles.modCard}>
          <Text style={styles.modTitle}>2. Edifici che consumano Rifiuti (edificiData → consumo)</Text>
          {edificiConsumano.length > 0 ? (
            edificiConsumano.map((e) => (
              <View key={e.id} style={styles.modItem}>
                <Text style={styles.modBullet}>•</Text>
                <Text style={styles.modText}>
                  <Text style={styles.modBold}>{e.emoji} {e.nome}</Text> — {e.descrizione}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.modItem}>
              <Text style={styles.modBullet}>•</Text>
              <Text style={styles.modText}>Nessun edificio con consumo &quot;Rifiuti&quot; nello stato attuale.</Text>
            </View>
          )}
        </View>

        <View style={styles.modCard}>
          <Text style={styles.modTitle}>3. Mercato (mercato.ts)</Text>
          <View style={styles.modItem}>
            <Text style={styles.modBullet}>•</Text>
            <Text style={styles.modText}>
              I rifiuti possono essere <Text style={styles.modBold}>acquistati</Text> o <Text style={styles.modBold}>venduti</Text> dal Mercato (prezzi definiti in mercato.ts). Emoji: 🗑️
            </Text>
          </View>
        </View>

        <View style={styles.modCard}>
          <Text style={styles.modTitle}>4. Dove viene usata</Text>
          <View style={styles.modItem}>
            <Text style={styles.modBullet}>•</Text>
            <Text style={styles.modText}>
              La risorsa Rifiuti è mostrata in <Text style={styles.modBold}>Home</Text> nella sezione Risorse (card con quantità e unità). Tocca la card &quot;Rifiuti&quot; per aprire questa pagina.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
    <View style={styles.footer}>
      <Text style={styles.back} onPress={() => router.back()}>← Home</Text>
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
    padding: 16,
    paddingBottom: 24
  },
  mediaCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    alignItems: "center"
  },
  mediaLabel: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  mediaValue: {
    color: "#4ade80",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4
  },
  mediaUnit: {
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(203,213,245,0.8)"
  },
  mediaSubtext: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    textAlign: "center"
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8
  },
  sectionIntro: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 11,
    marginBottom: 16,
    lineHeight: 16
  },
  modCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  modTitle: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 10
  },
  modItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6
  },
  modBullet: {
    color: "#93c5fd",
    fontSize: 12,
    marginRight: 8
  },
  modText: {
    color: "#e5e7eb",
    fontSize: 11,
    flex: 1,
    lineHeight: 16
  },
  modBold: {
    fontWeight: "700",
    color: "#f1f5f9"
  }
});
