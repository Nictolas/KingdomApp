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
import { pianetiData } from "../src/kingdomData";
import type { Risorsa } from "../src/types";

/** Emoji per risorsa (per UI). */
const RESOURCE_EMOJI: Record<string, string> = {
  Cibo: "🍱",
  Metalli: "⛏️",
  Energia: "⚡",
  "Acqua potabile": "💧",
  "Materiale Edile": "🧱",
  Medicine: "💊",
  Combustibile: "⛽",
  Rifiuti: "🗑️"
};

function getEmojiRisorsa(risorsa: Risorsa | undefined): string {
  return (risorsa && RESOURCE_EMOJI[risorsa.nome]) || "📦";
}

export default function MercatoScreen() {
  const router = useRouter();
  const { risorse, ordiniMercato, aggiungiOrdineMercato, rimuoviOrdineMercato, moneteGiocatore } =
    useGameContext();
  const [quantitàInput, setQuantitàInput] = useState<Record<string, string>>({});

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const padding = 20;
  const gap = 6;
  const numCols = width >= 720 ? 6 : width >= 480 ? 3 : 2;
  const colWidth = (width - padding - gap * (numCols - 1)) / numCols;

  const moneteImpegnate = ordiniMercato
    .filter((o) => o.tipo === "compra")
    .reduce((s, o) => s + o.quantità * o.prezzoUnitario, 0);
  const moneteDisponibili = moneteGiocatore - moneteImpegnate;

  const handleOrdinePianeta = (
    tipo: "compra" | "vendi",
    risorsaId: number,
    prezzoUnitario: number,
    key: string
  ) => {
    const q = Math.floor(Number(quantitàInput[key]) || 0);
    if (q <= 0) return;
    const ok = aggiungiOrdineMercato(tipo, risorsaId, q, prezzoUnitario);
    if (ok) setQuantitàInput((prev) => ({ ...prev, [key]: "" }));
  };

  return (
    <SafeAreaView style={[styles.safe, maxHeight && { maxHeight, overflow: "hidden" }]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>🏪 Mercato</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.saldoRow}>
          <View style={styles.saldoBadge}>
            <Text style={styles.saldoLabel}>Tesoro</Text>
            <Text style={styles.saldoValue}>{moneteGiocatore}</Text>
          </View>
          <Text style={styles.saldoHint}>Ordini eseguiti al Skip Mese</Text>
        </View>

        {ordiniMercato.length > 0 && (
          <View style={styles.ordiniSection}>
            <Text style={styles.ordiniTitle}>In coda ({ordiniMercato.length})</Text>
            {ordiniMercato.map((ordine) => {
              const risorsa = risorse.find((r) => r.id === ordine.risorsaId);
              const nome = risorsa?.nome ?? "?";
              const emoji = getEmojiRisorsa(risorsa);
              const costo = ordine.quantità * ordine.prezzoUnitario;
              return (
                <View key={ordine.id} style={styles.ordineRow}>
                  <Text style={styles.ordineText} numberOfLines={1}>
                    {ordine.tipo === "compra" ? "🛒" : "💰"} {emoji} {ordine.quantità} {nome}
                    {ordine.tipo === "compra" ? ` −${costo}` : ` +${costo}`} 💰
                  </Text>
                  <Pressable
                    style={styles.rimuoviOrdineBtn}
                    onPress={() => rimuoviOrdineMercato(ordine.id)}
                  >
                    <Text style={styles.rimuoviOrdineText}>✕</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.sectionBar}>
          <Text style={styles.sectionTitle}>🏰 Regni mercantili</Text>
          <Pressable onPress={() => router.push("/pianeti")} hitSlop={8}>
            <Text style={styles.link}>Tutti →</Text>
          </Pressable>
        </View>

        <View style={[styles.grid6, { gap }]}>
        {pianetiData.map((pianeta) => {
          const risorsaCheCompra = risorse.find((r) => r.id === pianeta.compraRisorsaId);
          const risorsaCheVende = risorse.find((r) => r.id === pianeta.vendiRisorsaId);
          const keyVendi = `p-${pianeta.id}-vendi`;
          const keyCompra = `p-${pianeta.id}-compra`;
          const qVendi = Math.floor(Number(quantitàInput[keyVendi]) || 0);
          const qCompra = Math.floor(Number(quantitàInput[keyCompra]) || 0);
          const qtàGiàInVendita =
            risorsaCheCompra &&
            ordiniMercato
              .filter((o) => o.tipo === "vendi" && o.risorsaId === pianeta.compraRisorsaId)
              .reduce((s, o) => s + o.quantità, 0);
          const puòVendere =
            risorsaCheCompra &&
            risorsaCheCompra.quantità - (qtàGiàInVendita ?? 0) >= qVendi &&
            qVendi > 0;
          const costoCompra = qCompra * pianeta.prezzoAcquisto;
          const puòComprare =
            risorsaCheVende &&
            moneteDisponibili >= costoCompra &&
            qCompra > 0;

          return (
            <View key={pianeta.id} style={[styles.planetCard, { width: colWidth }]}>
              <View style={styles.planetHeader}>
                <Text style={styles.planetEmoji}>{pianeta.emoji}</Text>
                <View style={styles.planetNomeWrap}>
                  <Text style={styles.planetNome} numberOfLines={2}>{pianeta.nome}</Text>
                  {risorsaCheCompra && (
                    <Text style={styles.disponibilitaInline}>
                      {risorsaCheCompra.quantità} {risorsaCheCompra.unità}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.trades}>
                <View style={styles.tradeRow}>
                  <Text style={styles.tradeShort} numberOfLines={1}>
                    {getEmojiRisorsa(risorsaCheCompra)} Vendi @{pianeta.prezzoVendita}
                  </Text>
                  <View style={styles.tradeActions}>
                    <TextInput
                      style={styles.input}
                      value={quantitàInput[keyVendi] ?? ""}
                      onChangeText={(t) =>
                        setQuantitàInput((prev) => ({ ...prev, [keyVendi]: t.replace(/\D/g, "") }))
                      }
                      placeholder="0"
                      keyboardType="number-pad"
                      placeholderTextColor="rgba(203,213,245,0.35)"
                    />
                    <Pressable
                      style={[styles.btn, styles.btnVendi, !puòVendere && styles.btnDisabled]}
                      onPress={() =>
                        risorsaCheCompra &&
                        handleOrdinePianeta("vendi", pianeta.compraRisorsaId, pianeta.prezzoVendita, keyVendi)
                      }
                      disabled={!puòVendere}
                    >
                      <Text style={styles.btnText}>Vendi{qVendi > 0 ? ` +${qVendi * pianeta.prezzoVendita}` : ""}</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.tradeRow}>
                  <Text style={styles.tradeShort} numberOfLines={1}>
                    {getEmojiRisorsa(risorsaCheVende)} Compra @{pianeta.prezzoAcquisto}
                  </Text>
                  <View style={styles.tradeActions}>
                    <TextInput
                      style={styles.input}
                      value={quantitàInput[keyCompra] ?? ""}
                      onChangeText={(t) =>
                        setQuantitàInput((prev) => ({ ...prev, [keyCompra]: t.replace(/\D/g, "") }))
                      }
                      placeholder="0"
                      keyboardType="number-pad"
                      placeholderTextColor="rgba(203,213,245,0.35)"
                    />
                    <Pressable
                      style={[styles.btn, styles.btnCompra, !puòComprare && styles.btnDisabled]}
                      onPress={() =>
                        handleOrdinePianeta("compra", pianeta.vendiRisorsaId, pianeta.prezzoAcquisto, keyCompra)
                      }
                      disabled={!puòComprare}
                    >
                      <Text style={styles.btnText}>Compra{qCompra > 0 ? ` −${costoCompra}` : ""}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
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
  safe: { flex: 1, backgroundColor: "#0a0e1a" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.2)"
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.6)"
  },
  back: { color: "#7dd3fc", fontSize: 12 },
  title: { color: "#f1f5f9", fontSize: 13, fontWeight: "700" },
  content: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    paddingBottom: 12
  },
  saldoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 8
  },
  saldoBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    backgroundColor: "rgba(34,197,94,0.12)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.35)"
  },
  saldoLabel: { color: "rgba(203,213,245,0.75)", fontSize: 10 },
  saldoValue: { color: "#4ade80", fontSize: 15, fontWeight: "800" },
  saldoHint: { color: "rgba(148,163,184,0.5)", fontSize: 9, flex: 1, textAlign: "right" },
  ordiniSection: { marginBottom: 6 },
  ordiniTitle: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  ordineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(30,41,59,0.6)",
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 3,
    borderLeftWidth: 2,
    borderLeftColor: "rgba(148,163,184,0.4)"
  },
  ordineText: { color: "#e2e8f0", fontSize: 10, flex: 1 },
  rimuoviOrdineBtn: {
    backgroundColor: "rgba(239,68,68,0.2)",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  rimuoviOrdineText: { color: "#f87171", fontSize: 12, fontWeight: "600" },
  sectionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4
  },
  sectionTitle: { color: "#f1f5f9", fontSize: 11, fontWeight: "700" },
  link: { color: "#7dd3fc", fontSize: 10 },
  grid6: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  planetCard: {
    backgroundColor: "rgba(30,41,59,0.5)",
    borderRadius: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)"
  },
  planetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
    gap: 4
  },
  planetEmoji: { fontSize: 18 },
  planetNomeWrap: { flex: 1, minWidth: 0 },
  planetNome: { color: "#e2e8f0", fontSize: 10, fontWeight: "700" },
  disponibilitaInline: {
    color: "rgba(148,163,184,0.55)",
    fontSize: 9
  },
  trades: { gap: 2 },
  tradeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 4,
    paddingVertical: 1
  },
  tradeShort: {
    color: "rgba(203,213,245,0.85)",
    fontSize: 9,
    flex: 1,
    minWidth: 0
  },
  tradeActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3
  },
  input: {
    width: 36,
    height: 24,
    backgroundColor: "rgba(15,23,42,0.7)",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    color: "#e2e8f0",
    fontSize: 11,
    paddingHorizontal: 4,
    textAlign: "center"
  },
  btn: {
    minWidth: 48,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  btnCompra: { backgroundColor: "rgba(59,130,246,0.75)" },
  btnVendi: { backgroundColor: "rgba(34,197,94,0.7)" },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: "#fff", fontSize: 9, fontWeight: "700" }
});
