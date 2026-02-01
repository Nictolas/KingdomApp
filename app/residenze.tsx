import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

type ResidenzaTipo = {
  id: string;
  nome: string;
  emoji: string;
  felicità: number;
  costoMensile: number;
  energiaMensile: number;
  abitanti: number;
};

const CATEGORIE: { titolo: string; residenze: ResidenzaTipo[] }[] = [
  {
    titolo: "Residenze Povere",
    residenze: [
      { id: "baracca", nome: "Baracca", emoji: "🛖", felicità: 5, costoMensile: 100, energiaMensile: 2, abitanti: 2 },
      { id: "dormitorio", nome: "Dormitorio", emoji: "🛏️", felicità: 10, costoMensile: 250, energiaMensile: 5, abitanti: 10 }
    ]
  },
  {
    titolo: "Residenze Ceto Medio",
    residenze: [
      { id: "modulo", nome: "Modulo", emoji: "📦", felicità: 30, costoMensile: 800, energiaMensile: 15, abitanti: 4 },
      { id: "villetta", nome: "Villetta", emoji: "🏡", felicità: 45, costoMensile: 1500, energiaMensile: 25, abitanti: 5 }
    ]
  },
  {
    titolo: "Residenze di Lusso",
    residenze: [
      { id: "attico", nome: "Attico", emoji: "🏢", felicità: 80, costoMensile: 5000, energiaMensile: 60, abitanti: 3 },
      { id: "villa", nome: "Villa", emoji: "🏰", felicità: 120, costoMensile: 12000, energiaMensile: 100, abitanti: 6 }
    ]
  }
];

export default function ResidenzeScreen() {
  const router = useRouter();
  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Edifici
        </Text>
        <Text style={styles.title}>Residenze</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Costi in crediti ed energia sono mensili (ogni Skip Mese).
        </Text>

        {CATEGORIE.map((cat) => (
          <View key={cat.titolo} style={styles.categoria}>
            <Text style={styles.categoriaTitolo}>{cat.titolo}</Text>
            <View style={styles.grid}>
              {cat.residenze.map((r) => (
                <View key={r.id} style={styles.card}>
                  <Text style={styles.cardEmoji}>{r.emoji}</Text>
                  <Text style={styles.cardNome}>{r.nome}</Text>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Felicità</Text>
                    <Text style={styles.cardValorePositivo}>+{r.felicità}</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Costo</Text>
                    <Text style={styles.cardValore}>{r.costoMensile} crediti/mese</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Energia</Text>
                    <Text style={styles.cardValore}>{r.energiaMensile}/mese</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Abitanti</Text>
                    <Text style={styles.cardValore}>{r.abitanti}</Text>
                  </View>
                </View>
              ))}
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
    paddingVertical: 8,
    paddingBottom: 24,
    flex: 1
  },
  intro: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 11,
    marginBottom: 12,
    fontStyle: "italic"
  },
  categoria: {
    marginBottom: 20
  },
  categoriaTitolo: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    minWidth: 140,
    width: "47%"
  },
  cardEmoji: {
    fontSize: 28,
    marginBottom: 4,
    textAlign: "center"
  },
  cardNome: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center"
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  cardLabel: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10
  },
  cardValore: {
    color: "#e5e7eb",
    fontSize: 10,
    fontWeight: "600"
  },
  cardValorePositivo: {
    color: "#4ade80",
    fontSize: 10,
    fontWeight: "700"
  }
});
