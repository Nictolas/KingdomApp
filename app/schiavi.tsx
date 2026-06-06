import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getCastaAbitante } from "../src/game/casta";
import {
  getProprietarioSchiavoId,
  PREZZO_SCHIAVO_DEFAULT,
  puoUccidereSchiavo
} from "../src/game/schiavituCommercio";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import type { Abitante } from "../src/types";

export default function SchiaviScreen() {
  const router = useRouter();
  const { abitanti, trasferisciProprietaSchiavo, uccidiSchiavo } = useGameContext();

  const serviDellaGleba = abitanti.filter((a) => getCastaAbitante(a) === "Servo della gleba");
  const schiaviPrivati = abitanti.filter((a) => getCastaAbitante(a) === "Schiavo");

  const compratori = [
    { id: null as number | null, nome: "Colonia" },
    ...abitanti
      .filter((a) => getCastaAbitante(a) !== "Schiavo" && getCastaAbitante(a) !== "Servo della gleba" && a.razza !== "Robot")
      .map((a) => ({ id: a.id as number | null, nome: a.nome }))
  ];

  const getPadroneNome = (schiavistaId?: number): string => {
    if (schiavistaId == null) return "Colonia";
    const padrone = abitanti.find((a) => a.id === schiavistaId);
    return padrone ? padrone.nome : `ID ${schiavistaId}`;
  };

  const handleCompra = (schiavoId: number, acquirenteId: number | null) => {
    trasferisciProprietaSchiavo(schiavoId, acquirenteId, PREZZO_SCHIAVO_DEFAULT);
  };

  const handleUccidi = (uccisoreId: number | null, schiavoId: number) => {
    uccidiSchiavo(uccisoreId, schiavoId);
  };

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const renderCard = (schiavo: Abitante, variant: "stato" | "privato") => {
    const prop = getProprietarioSchiavoId(schiavo);
    const acquirentiValidi = compratori.filter((c) => c.id !== prop);
    const padroniUccisori = abitanti.filter((a) => puoUccidereSchiavo(a.id, schiavo, abitanti));

    return (
      <View key={schiavo.id} style={[styles.card, variant === "stato" ? styles.cardStato : styles.cardPrivato]}>
        <Text style={styles.emoji}>{getEmojiAbitante(schiavo)}</Text>
        <Text style={styles.cardTitle}>{schiavo.nome}</Text>
        <Text style={styles.cardLavoro}>{schiavo.lavoro}</Text>
        <Text style={variant === "stato" ? styles.badgeStato : styles.cardPadrone}>
          Padrone: {variant === "stato" ? "Colonia" : getPadroneNome(schiavo.schiavistaId)}
        </Text>
        {acquirentiValidi.length > 0 && (
          <View style={styles.azioni}>
            {acquirentiValidi.slice(0, 3).map((c) => (
              <Pressable key={c.id ?? "colonia"} style={styles.btnCompra} onPress={() => handleCompra(schiavo.id, c.id)}>
                <Text style={styles.btnCompraText}>{c.nome} ({PREZZO_SCHIAVO_DEFAULT}💰)</Text>
              </Pressable>
            ))}
          </View>
        )}
        {(puoUccidereSchiavo(null, schiavo, abitanti) || padroniUccisori.length > 0) && (
          <View style={styles.azioni}>
            {puoUccidereSchiavo(null, schiavo, abitanti) && (
              <Pressable style={styles.btnUccidi} onPress={() => handleUccidi(null, schiavo.id)}>
                <Text style={styles.btnUccidiText}>Colonia uccide</Text>
              </Pressable>
            )}
            {padroniUccisori.map((p) => (
              <Pressable key={p.id} style={styles.btnUccidi} onPress={() => handleUccidi(p.id, schiavo.id)}>
                <Text style={styles.btnUccidiText}>{p.nome} uccide</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>⛓️ Schiavi</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.subtitle}>
            Servi della gleba (colonia) e Schiavi privati. Compravendita a {PREZZO_SCHIAVO_DEFAULT} monete.
            Il reddito degli Schiavi privati va al padrone; uccidere il proprio schiavo non genera reati.
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Servi della gleba ({serviDellaGleba.length})</Text>
            <Text style={styles.sectionDesc}>Proprietà della colonia · assegnabili da Postazioni di lavoro</Text>
            {serviDellaGleba.length > 0 ? (
              <View style={styles.grid}>{serviDellaGleba.map((s) => renderCard(s, "stato"))}</View>
            ) : (
              <Text style={styles.emptyText}>Nessun Servo della gleba</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Schiavi privati ({schiaviPrivati.length})</Text>
            <Text style={styles.sectionDesc}>Proprietà di un abitante · compaiono nel suo inventario</Text>
            {schiaviPrivati.length > 0 ? (
              <View style={styles.grid}>{schiaviPrivati.map((s) => renderCard(s, "privato"))}</View>
            ) : (
              <Text style={styles.emptyText}>Nessuno schiavo privato</Text>
            )}
          </View>
        </ScrollView>
      </View>
      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>← Fazioni</Text>
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
  content: { paddingHorizontal: 12, paddingVertical: 6, paddingBottom: 8, flex: 1 },
  subtitle: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 12
  },
  section: { marginBottom: 14 },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4
  },
  sectionDesc: {
    color: "rgba(203,213,245,0.6)",
    fontSize: 10,
    marginBottom: 8
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    width: "48%",
    minWidth: 140,
    alignItems: "center"
  },
  cardStato: {
    borderColor: "rgba(59,130,246,0.6)",
    backgroundColor: "rgba(15,23,42,0.98)"
  },
  cardPrivato: {
    borderColor: "rgba(148,163,184,0.6)"
  },
  emoji: { fontSize: 32, marginBottom: 4 },
  cardTitle: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginBottom: 2, textAlign: "center" },
  cardLavoro: { color: "#93c5fd", fontSize: 9, marginBottom: 4, textAlign: "center" },
  badgeStato: {
    color: "#3b82f6",
    fontSize: 9,
    fontWeight: "600",
    marginBottom: 6
  },
  cardPadrone: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    textAlign: "center",
    marginBottom: 6
  },
  azioni: {
    width: "100%",
    gap: 4,
    marginTop: 4
  },
  btnCompra: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: "rgba(59,130,246,0.2)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.35)"
  },
  btnCompraText: {
    color: "#93c5fd",
    fontSize: 8,
    fontWeight: "600",
    textAlign: "center"
  },
  btnUccidi: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)"
  },
  btnUccidiText: {
    color: "#fca5a5",
    fontSize: 8,
    fontWeight: "600",
    textAlign: "center"
  },
  emptyText: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 10,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12
  }
});
