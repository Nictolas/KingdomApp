import React, { useMemo } from "react";
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { elencoPostazioniLavoroOrdinato } from "../src/game/edificiLavoro";

function titoloEdificio(nome: string, edificioId: number, duplicatiPerNome: Map<string, number>): string {
  const count = duplicatiPerNome.get(nome) ?? 1;
  if (count <= 1) return nome;
  if (nome === "Serra") return edificioId === 2 ? "Serra (unità 1)" : edificioId === 21 ? "Serra (unità 2)" : `${nome} (#${edificioId})`;
  return `${nome} (#${edificioId})`;
}

export default function PostazioniLavoroScreen() {
  const router = useRouter();
  const { edifici } = useGameContext();

  const { righe, duplicatiPerNome } = useMemo(() => {
    const lista = elencoPostazioniLavoroOrdinato(edifici);
    const counts = new Map<string, number>();
    for (const r of lista) {
      counts.set(r.nome, (counts.get(r.nome) ?? 0) + 1);
    }
    return { righe: lista, duplicatiPerNome: counts };
  }, [edifici]);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Postazioni di lavoro</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          <Text style={styles.intro}>
            Posti coperti / posti totali per ogni edificio. In cima quelli con più posti liberi.
          </Text>

          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, styles.colEdificio]}>Edificio</Text>
            <Text style={[styles.headerCell, styles.colRatio, styles.headerRatio]}>Posti</Text>
          </View>

          {righe.length === 0 ? (
            <Text style={styles.vuoto}>Nessun edificio con postazioni di lavoro operativo.</Text>
          ) : (
            righe.map((r) => (
              <View key={r.edificioId} style={styles.row}>
                <View style={styles.colEdificio}>
                  <Text style={styles.emoji}>{r.emoji}</Text>
                  <Text style={styles.nomeEdificio} numberOfLines={1}>
                    {titoloEdificio(r.nome, r.edificioId, duplicatiPerNome)}
                  </Text>
                </View>
                <Text style={[styles.ratio, styles.colRatio]}>
                  {r.coperti}/{r.massimi}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Indietro
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
  intro: {
    color: "rgba(203,213,245,0.75)",
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: "rgba(59,130,246,0.2)",
    borderRadius: 8,
    marginBottom: 4
  },
  headerCell: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.2)",
    backgroundColor: "rgba(15,23,42,0.5)"
  },
  colEdificio: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0
  },
  colRatio: {
    width: 56,
    textAlign: "right"
  },
  headerRatio: {
    textAlign: "right"
  },
  emoji: {
    fontSize: 18
  },
  nomeEdificio: {
    flex: 1,
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "600"
  },
  ratio: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"]
  },
  vuoto: {
    color: "rgba(203,213,225,0.7)",
    fontSize: 12,
    fontStyle: "italic",
    paddingVertical: 16,
    textAlign: "center"
  }
});
