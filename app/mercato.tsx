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

const CREDITI_ID = 1;

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
  const { risorse, ordiniMercato, aggiungiOrdineMercato, rimuoviOrdineMercato } = useGameContext();
  const [quantitàInput, setQuantitàInput] = useState<Record<string, string>>({});

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const crediti = risorse.find((r) => r.id === CREDITI_ID);
  const creditiImpegnati = ordiniMercato
    .filter((o) => o.tipo === "compra")
    .reduce((s, o) => s + o.quantità * o.prezzoUnitario, 0);
  const creditiDisponibili = crediti ? crediti.quantità - creditiImpegnati : 0;

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
          <Text style={styles.saldoHint}>
            Gli ordini si applicano quando fai Skip Mese (anteprima in Home).
          </Text>
        </View>

        {ordiniMercato.length > 0 && (
          <View style={styles.ordiniSection}>
            <Text style={styles.sectionTitle}>Ordini in sospeso ({ordiniMercato.length})</Text>
            {ordiniMercato.map((ordine) => {
              const risorsa = risorse.find((r) => r.id === ordine.risorsaId);
              const nome = risorsa?.nome ?? "?";
              const emoji = getEmojiRisorsa(risorsa);
              const costo = ordine.quantità * ordine.prezzoUnitario;
              return (
                <View key={ordine.id} style={styles.ordineRow}>
                  <Text style={styles.ordineText}>
                    {ordine.tipo === "compra" ? "🛒" : "💰"} {emoji}{" "}
                    {ordine.tipo === "compra" ? "Acquisto" : "Vendita"} {ordine.quantità} {nome}
                    {ordine.tipo === "compra"
                      ? ` (−${costo} 💰)`
                      : ` (+${costo} 💰)`}
                  </Text>
                  <Pressable
                    style={styles.rimuoviOrdineBtn}
                    onPress={() => rimuoviOrdineMercato(ordine.id)}
                  >
                    <Text style={styles.rimuoviOrdineText}>Elimina</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🪐 Commercio con i pianeti</Text>
          <Pressable onPress={() => router.push("/pianeti")}>
            <Text style={styles.link}>Vedi tutti i pianeti →</Text>
          </Pressable>
        </View>
        <Text style={styles.sectionDesc}>
          Ogni pianeta compra una risorsa da te e ne vende un'altra. Aggiungi ordini qui sotto;
          si eseguono al Skip Mese.
        </Text>

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
            crediti != null &&
            creditiDisponibili >= costoCompra &&
            qCompra > 0;

          return (
            <View key={pianeta.id} style={styles.planetCard}>
              <View style={styles.planetHeader}>
                <Text style={styles.planetEmoji}>{pianeta.emoji}</Text>
                <View style={styles.planetHeaderText}>
                  <Text style={styles.planetNome}>{pianeta.nome}</Text>
                  <Text style={styles.planetRazza}>Razza: {pianeta.razza}</Text>
                </View>
              </View>

              <View style={styles.tradeRow}>
                <View style={styles.tradeLabel}>
                  <Text style={styles.tradeEmoji}>{getEmojiRisorsa(risorsaCheCompra)}</Text>
                  <Text style={styles.tradeText}>
                    Vendi {risorsaCheCompra?.nome ?? "?"} al pianeta · {pianeta.prezzoVendita} 💰/
                    {risorsaCheCompra?.unità ?? "u"}
                  </Text>
                </View>
                <View style={styles.tradeActions}>
                  <TextInput
                    style={styles.input}
                    value={quantitàInput[keyVendi] ?? ""}
                    onChangeText={(t) =>
                      setQuantitàInput((prev) => ({
                        ...prev,
                        [keyVendi]: t.replace(/\D/g, "")
                      }))
                    }
                    placeholder="Qtà"
                    keyboardType="number-pad"
                    placeholderTextColor="rgba(203,213,245,0.4)"
                  />
                  <Pressable
                    style={[styles.btn, styles.btnVendi, !puòVendere && styles.btnDisabled]}
                    onPress={() =>
                      risorsaCheCompra &&
                      handleOrdinePianeta(
                        "vendi",
                        pianeta.compraRisorsaId,
                        pianeta.prezzoVendita,
                        keyVendi
                      )
                    }
                    disabled={!puòVendere}
                  >
                    <Text style={styles.btnText}>Vendi</Text>
                    {qVendi > 0 && (
                      <Text style={styles.btnSubtext}>+{qVendi * pianeta.prezzoVendita} 💰</Text>
                    )}
                  </Pressable>
                </View>
              </View>

              <View style={styles.tradeRow}>
                <View style={styles.tradeLabel}>
                  <Text style={styles.tradeEmoji}>{getEmojiRisorsa(risorsaCheVende)}</Text>
                  <Text style={styles.tradeText}>
                    Compra {risorsaCheVende?.nome ?? "?"} dal pianeta · {pianeta.prezzoAcquisto} 💰/
                    {risorsaCheVende?.unità ?? "u"}
                  </Text>
                </View>
                <View style={styles.tradeActions}>
                  <TextInput
                    style={styles.input}
                    value={quantitàInput[keyCompra] ?? ""}
                    onChangeText={(t) =>
                      setQuantitàInput((prev) => ({
                        ...prev,
                        [keyCompra]: t.replace(/\D/g, "")
                      }))
                    }
                    placeholder="Qtà"
                    keyboardType="number-pad"
                    placeholderTextColor="rgba(203,213,245,0.4)"
                  />
                  <Pressable
                    style={[styles.btn, styles.btnCompra, !puòComprare && styles.btnDisabled]}
                    onPress={() =>
                      handleOrdinePianeta(
                        "compra",
                        pianeta.vendiRisorsaId,
                        pianeta.prezzoAcquisto,
                        keyCompra
                      )
                    }
                    disabled={!puòComprare}
                  >
                    <Text style={styles.btnText}>Compra</Text>
                    {qCompra > 0 && (
                      <Text style={styles.btnSubtext}>−{costoCompra} 💰</Text>
                    )}
                  </Pressable>
                </View>
              </View>

              {risorsaCheCompra && (
                <Text style={styles.disponibilita}>
                  Disponibili: {risorsaCheCompra.quantità} {risorsaCheCompra.unità}
                </Text>
              )}
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
  rimuoviOrdineBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  rimuoviOrdineText: { color: "#ffffff", fontSize: 10, fontWeight: "600" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 0
  },
  link: { color: "#93c5fd", fontSize: 11 },
  sectionDesc: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 10
  },
  planetCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    marginBottom: 12
  },
  planetHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  planetEmoji: { fontSize: 28, marginRight: 10 },
  planetHeaderText: { flex: 1 },
  planetNome: { color: "#e5e7eb", fontSize: 13, fontWeight: "700", marginBottom: 2 },
  planetRazza: { color: "rgba(203,213,245,0.6)", fontSize: 11 },
  tradeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8
  },
  tradeLabel: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 140 },
  tradeEmoji: { fontSize: 18, marginRight: 6 },
  tradeText: { color: "rgba(203,213,245,0.9)", fontSize: 11, flex: 1 },
  tradeActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  input: {
    width: 52,
    height: 34,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    color: "#e5e7eb",
    fontSize: 12,
    paddingHorizontal: 6,
    textAlign: "center"
  },
  btn: {
    minWidth: 72,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center"
  },
  btnCompra: { backgroundColor: "rgba(59,130,246,0.8)" },
  btnVendi: { backgroundColor: "rgba(34,197,94,0.8)" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#ffffff", fontSize: 11, fontWeight: "700" },
  btnSubtext: { color: "rgba(255,255,255,0.9)", fontSize: 9, marginTop: 2 },
  disponibilita: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 10,
    marginTop: 4,
    marginLeft: 24
  }
});
