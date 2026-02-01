import React from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";

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
  const { edifici, abitanti } = useGameContext();
  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const edificiResidenza = edifici.filter((e) => e.tipo === "Residenza");

  const getAbitanteById = (id: number) => abitanti.find((a) => a.id === id);

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Edifici
        </Text>
        <Text style={styles.title}>Residenze</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={true}>
        <Text style={styles.intro}>
          Costi in crediti ed energia sono mensili (ogni Skip Mese).
        </Text>

        {/* Edifici residenza nella colonia con abitanti */}
        <View style={styles.sezione}>
          <Text style={styles.sezioneTitolo}>Edifici residenza nella colonia</Text>
          <View style={[styles.edificiGrid, isDesktop && styles.edificiGridDesktop]}>
            {edificiResidenza.length === 0 ? (
              <Text style={styles.vuoto}>Nessun edificio residenza in colonia.</Text>
            ) : (
              edificiResidenza.map((ed) => {
                const assegnati = (ed.abitantiAssegnati ?? [])
                  .map((id) => getAbitanteById(id))
                  .filter((a): a is NonNullable<typeof a> => a != null);
                return (
                  <View key={ed.id} style={styles.edificioCard}>
                    <View style={styles.edificioHeader}>
                      <Text style={styles.edificioEmoji}>{ed.emoji}</Text>
                      <View style={styles.edificioTitoloWrap}>
                        <Text style={styles.edificioNome}>{ed.nome}</Text>
                        <Text style={styles.edificioOccupazione}>
                          {ed.occupazione}/{ed.capacità} posti
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.abitantiLabel}>Abitanti assegnati</Text>
                    <View style={styles.abitantiLista}>
                      {assegnati.length === 0 ? (
                        <Text style={styles.abitantiVuoto}>Nessun abitante assegnato</Text>
                      ) : (
                        assegnati.map((a) => (
                          <View key={a.id} style={styles.abitanteRiga}>
                            <Text style={styles.abitanteEmoji}>{getEmojiAbitante(a)}</Text>
                            <Text style={styles.abitanteNome} numberOfLines={1}>
                              {a.nome} {a.cognome}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* Tipi di residenza (catalogo) */}
        <View style={styles.sezione}>
          <Text style={styles.sezioneTitolo}>Tipi di residenza (catalogo)</Text>
          {CATEGORIE.map((cat) => (
            <View key={cat.titolo} style={styles.categoria}>
              <Text style={styles.categoriaTitolo}>{cat.titolo}</Text>
              <View style={[styles.grid, isDesktop && styles.gridDesktop]}>
                {cat.residenze.map((r) => (
                  <View key={r.id} style={[styles.card, isDesktop && styles.cardDesktop]}>
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
        </View>
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingBottom: 28,
    flexGrow: 1
  },
  intro: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 11,
    marginBottom: 14,
    fontStyle: "italic"
  },
  sezione: {
    marginBottom: 22
  },
  sezioneTitolo: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  edificiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  edificiGridDesktop: {
    gap: 16
  },
  edificioCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    minWidth: 200,
    flex: 1,
    maxWidth: 360
  },
  edificioHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.3)"
  },
  edificioEmoji: {
    fontSize: 28,
    marginRight: 10
  },
  edificioTitoloWrap: { flex: 1, minWidth: 0 },
  edificioNome: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "700"
  },
  edificioOccupazione: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 11,
    marginTop: 2
  },
  abitantiLabel: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  abitantiLista: {
    maxHeight: 200
  },
  abitantiVuoto: {
    color: "rgba(203,213,245,0.4)",
    fontSize: 11,
    fontStyle: "italic",
    paddingVertical: 6
  },
  abitanteRiga: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.2)"
  },
  abitanteEmoji: { fontSize: 16, marginRight: 8 },
  abitanteNome: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "500",
    flex: 1
  },
  vuoto: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 11,
    fontStyle: "italic",
    paddingVertical: 8
  },
  categoria: {
    marginBottom: 16
  },
  categoriaTitolo: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  gridDesktop: {
    gap: 14
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    minWidth: 150,
    width: "47%"
  },
  cardDesktop: {
    flex: 1,
    minWidth: 160,
    maxWidth: 220
  },
  cardEmoji: {
    fontSize: 26,
    marginBottom: 6,
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
    marginBottom: 5
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
