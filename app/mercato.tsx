import React, { useState } from "react";
import {
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import type { Risorsa } from "../src/types";

const CREDITI_ID = 1;

const PREZZI: Record<string, { compra: number; vendi: number; emoji: string }> = {
  Cibo: { compra: 5, vendi: 3, emoji: "🍱" },
  Metalli: { compra: 8, vendi: 5, emoji: "⛏️" },
  Energia: { compra: 12, vendi: 7, emoji: "⚡" },
  "Acqua potabile": { compra: 6, vendi: 4, emoji: "💧" },
  "Materiale Edile": { compra: 7, vendi: 4, emoji: "🧱" },
  Medicine: { compra: 14, vendi: 8, emoji: "💊" },
  Combustibile: { compra: 10, vendi: 6, emoji: "⛽" },
  Rifiuti: { compra: 2, vendi: 1, emoji: "🗑️" }
};

export default function MercatoScreen() {
  const router = useRouter();
  const { risorse, ordiniMercato, aggiungiOrdineMercato, rimuoviOrdineMercato } = useGameContext();
  const [quantitàInput, setQuantitàInput] = useState<Record<number, string>>({});

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const crediti = risorse.find((r) => r.id === CREDITI_ID);
  const risorseCommerciabili = risorse.filter((r) => r.id !== CREDITI_ID);
  const creditiImpegnati = ordiniMercato
    .filter((o) => o.tipo === "compra")
    .reduce((s, o) => s + o.quantità * o.prezzoUnitario, 0);
  const creditiDisponibili = crediti ? crediti.quantità - creditiImpegnati : 0;

  const handleAggiungiOrdine = (tipo: "compra" | "vendi", risorsa: Risorsa) => {
    const q = Math.floor(Number(quantitàInput[risorsa.id]) || 0);
    const prezzi = PREZZI[risorsa.nome];
    if (!prezzi || q <= 0) return;
    const prezzo = tipo === "compra" ? prezzi.compra : prezzi.vendi;
    const ok = aggiungiOrdineMercato(tipo, risorsa.id, q, prezzo);
    if (ok) setQuantitàInput((prev) => ({ ...prev, [risorsa.id]: "" }));
  };

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>🏪 Mercato</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.saldoCard}>
          <Text style={styles.saldoLabel}>💰 Crediti disponibili</Text>
          <Text style={styles.saldoValue}>
            {crediti ? `${crediti.quantità} ${crediti.unità}` : "—"}
          </Text>
          <Text style={styles.saldoHint}>Gli ordini si applicano quando fai Skip Mese (anteprima in Home).</Text>
        </View>

        {ordiniMercato.length > 0 && (
          <View style={styles.ordiniSection}>
            <Text style={styles.sectionTitle}>Ordini in sospeso ({ordiniMercato.length})</Text>
            {ordiniMercato.map((ordine) => {
              const risorsa = risorse.find((r) => r.id === ordine.risorsaId);
              const nome = risorsa?.nome ?? "?";
              const prezzi = risorsa ? PREZZI[risorsa.nome] : null;
              const emoji = prezzi?.emoji ?? "📦";
              const costo = ordine.quantità * ordine.prezzoUnitario;
              return (
                <View key={ordine.id} style={styles.ordineRow}>
                  <Text style={styles.ordineText}>
                    {ordine.tipo === "compra" ? "🛒" : "💰"} {emoji} {ordine.tipo === "compra" ? "Acquisto" : "Vendita"} {ordine.quantità} {nome}
                    {ordine.tipo === "compra" ? ` (−${costo} 💰)` : ` (+${costo} 💰)`}
                  </Text>
                  <Pressable style={styles.rimuoviOrdineBtn} onPress={() => rimuoviOrdineMercato(ordine.id)}>
                    <Text style={styles.rimuoviOrdineText}>Elimina</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.sectionTitle}>Aggiungi ordini (eseguiti al Skip Mese)</Text>

        {risorseCommerciabili.map((risorsa) => {
          const prezzi = PREZZI[risorsa.nome] ?? { compra: 10, vendi: 6, emoji: "📦" };
          const qStr = quantitàInput[risorsa.id] ?? "";
          const q = Math.floor(Number(qStr) || 0);
          const costoCompra = q * prezzi.compra;
          const ricavoVendita = q * prezzi.vendi;
          const qtàGiàInVendita = ordiniMercato
            .filter((o) => o.tipo === "vendi" && o.risorsaId === risorsa.id)
            .reduce((s, o) => s + o.quantità, 0);
          const puòComprare = crediti != null && creditiDisponibili >= costoCompra && q > 0;
          const puòVendere = risorsa.quantità - qtàGiàInVendita >= q && q > 0;

          return (
            <View key={risorsa.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.emoji}>{prezzi.emoji}</Text>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.risorsaNome}>{risorsa.nome}</Text>
                  <Text style={styles.risorsaQuantità}>
                    Disponibili: {risorsa.quantità} {risorsa.unità}
                  </Text>
                </View>
              </View>
              <View style={styles.prezziRow}>
                <Text style={styles.prezzoText}>Compra: {prezzi.compra} crediti/{risorsa.unità}</Text>
                <Text style={styles.prezzoText}>Vendi: {prezzi.vendi} crediti/{risorsa.unità}</Text>
              </View>
              <View style={styles.azioniRow}>
                <TextInput
                  style={styles.input}
                  value={qStr}
                  onChangeText={(t) =>
                    setQuantitàInput((prev) => ({ ...prev, [risorsa.id]: t.replace(/\D/g, "") }))
                  }
                  placeholder="Qtà"
                  keyboardType="number-pad"
                  placeholderTextColor="rgba(203,213,245,0.4)"
                />
                <Pressable
                  style={[styles.btn, styles.btnCompra, !puòComprare && styles.btnDisabled]}
                  onPress={() => handleAggiungiOrdine("compra", risorsa)}
                  disabled={!puòComprare}
                >
                  <Text style={styles.btnText}>Ordine acquisto</Text>
                  {q > 0 && (
                    <Text style={styles.btnSubtext}>−{costoCompra} 💰</Text>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.btnVendi, !puòVendere && styles.btnDisabled]}
                  onPress={() => handleAggiungiOrdine("vendi", risorsa)}
                  disabled={!puòVendere}
                >
                  <Text style={styles.btnText}>Ordine vendita</Text>
                  {q > 0 && (
                    <Text style={styles.btnSubtext}>+{ricavoVendita} 💰</Text>
                  )}
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
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
  back: { color: "#93c5fd", fontSize: 12 },
  title: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  content: { paddingHorizontal: 12, paddingVertical: 8, paddingBottom: 16, flex: 1 },
  saldoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 12,
    alignItems: "center"
  },
  saldoLabel: { color: "rgba(203,213,245,0.8)", fontSize: 11, marginBottom: 4 },
  saldoValue: { color: "#4ade80", fontSize: 18, fontWeight: "700" },
  saldoHint: { color: "rgba(203,213,245,0.5)", fontSize: 9, marginTop: 6, textAlign: "center" },
  ordiniSection: { marginBottom: 12 },
  ordineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)"
  },
  ordineText: { color: "#e5e7eb", fontSize: 11, flex: 1 },
  rimuoviOrdineBtn: { backgroundColor: "#ef4444", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  rimuoviOrdineText: { color: "#ffffff", fontSize: 10, fontWeight: "600" },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 10
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  emoji: { fontSize: 28, marginRight: 10 },
  cardHeaderText: { flex: 1 },
  risorsaNome: { color: "#e5e7eb", fontSize: 13, fontWeight: "700", marginBottom: 2 },
  risorsaQuantità: { color: "rgba(203,213,245,0.7)", fontSize: 11 },
  prezziRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingVertical: 4
  },
  prezzoText: { color: "rgba(203,213,245,0.8)", fontSize: 10 },
  azioniRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  input: {
    width: 56,
    height: 36,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    color: "#e5e7eb",
    fontSize: 12,
    paddingHorizontal: 8,
    textAlign: "center"
  },
  btn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center"
  },
  btnCompra: { backgroundColor: "rgba(59,130,246,0.8)" },
  btnVendi: { backgroundColor: "rgba(34,197,94,0.8)" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#ffffff", fontSize: 11, fontWeight: "700" },
  btnSubtext: { color: "rgba(255,255,255,0.9)", fontSize: 9, marginTop: 2 }
});
