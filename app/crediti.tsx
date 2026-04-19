import React, { useMemo } from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { RESIDENZE_CATALOGO } from "../src/data/residenzeData";

/** Route per le voci del bilancio (clic sulla riga). */
function getRoutePerVoceBilancio(label: string): string | null {
  const map: Record<string, string> = {
    Residenze: "/residenze",
    "Redditi di Cittadinanza": "/reddito-cittadinanza",
    "Ordini di Mercato": "/mercato",
    "Ospedale Coloniale": "/ospedale",
    Serra: "/serra/2",
    "Centrale Energetica": "/centrale-energetica",
    "Raffineria Mineraria": "/raffineria-mineraria",
    "Impianto di Riciclo": "/impianto-riciclo",
    Dissalatore: "/dissalatore",
    Scuola: "/scuola",
    Tribunale: "/tribunale",
    "Centro di Comando": "/ministri",
    Bar: "/bar",
    Centrale: "/centrale",
    Caserma: "/caserma",
    Baracca: "/residenze",
    Dormitorio: "/residenze"
  };
  return map[label] ?? null;
}

export default function CreditiScreen() {
  const router = useRouter();
  const { abitanti, edifici, risorse, calcolaDeltaOrdiniMercato, prezzoResidenze, redditoCittadinanza } = useGameContext();

  const saldoCrediti = risorse.find((r) => r.nome === "Crediti")?.quantità ?? 0;

  const deltaMercato = calcolaDeltaOrdiniMercato();
  const deltaCrediti = deltaMercato["Crediti"] ?? 0;
  const saldoDopoMercato = saldoCrediti + deltaCrediti;

  const totaleRedditi = abitanti.filter((a) => a.razza !== "Robot").reduce((sum, a) => sum + a.reddito, 0);
  const totaleSpese = abitanti.filter((a) => a.razza !== "Robot").reduce((sum, a) => sum + a.spese, 0);

  // Costi per edificio: stipendio × lavoratori; raggruppa per nome edificio (una riga per tipo)
  const spesePerTipoEdificio = useMemo(() => {
    const operativi = edifici.filter((e) => e.stato === "Operativo");
    const map = new Map<string, { nome: string; emoji: string; costo: number }>();
    for (const e of operativi) {
      const stipendio = e.stipendioPerLavoratore ?? 0;
      const lavoratori = e.abitantiAssegnati?.length ?? 0;
      const costo = stipendio * lavoratori;
      if (costo <= 0 && e.tipo === "Residenza") continue; // Residenze non compaiono come uscita
      const key = e.nome;
      const existing = map.get(key);
      if (existing) {
        existing.costo += costo;
      } else {
        map.set(key, { nome: e.nome, emoji: e.emoji ?? "🏢", costo });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.costo - a.costo);
  }, [edifici]);

  const totaleStipendiEdifici = spesePerTipoEdificio.reduce((sum, s) => sum + s.costo, 0);

  const beneficiariRedditoCittadinanza = abitanti.filter(
    (a) => a.razza !== "Robot" && a.lavoro === "Disoccupato" && !(a.fazioni?.includes("Schiavi") ?? false)
  ).length;
  const spesaRedditoCittadinanza = (redditoCittadinanza ?? 0) * beneficiariRedditoCittadinanza;

  let totaleEntrateResidenze = 0;
  for (const e of edifici) {
    if (e.tipo !== "Residenza" || e.stato !== "Operativo") continue;
    const prezzo =
      e.nome === "Baracca" ? 0 : (prezzoResidenze[e.nome] ?? RESIDENZE_CATALOGO.find((r) => r.nome === e.nome)?.costoMensile ?? 0);
    totaleEntrateResidenze += prezzo * (e.abitantiAssegnati?.length ?? 0);
  }

  const totaleNetto =
    totaleRedditi + totaleEntrateResidenze - totaleSpese - totaleStipendiEdifici - spesaRedditoCittadinanza;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const contentMaxWidth = isDesktop ? 1000 : undefined;

  const haOrdiniEntrata = deltaCrediti > 0;
  const haOrdiniUscita = deltaCrediti < 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Crediti</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentMaxWidth && { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" }]}
        showsVerticalScrollIndicator={true}
      >
        {/* Riepilogo in evidenza */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Saldo attuale</Text>
            <Text style={styles.summaryValore}>{saldoCrediti.toLocaleString("it-IT")}</Text>
            <Text style={styles.summaryUnita}>crediti</Text>
            <Text style={styles.summaryHint}>
              Dopo ordini mercato:{" "}
              <Text style={deltaCrediti >= 0 ? styles.valorePositivo : styles.valoreNegativo}>
                {saldoDopoMercato.toLocaleString("it-IT")}
                {deltaCrediti !== 0
                  ? ` (${deltaCrediti > 0 ? "+" : ""}${deltaCrediti.toLocaleString("it-IT")})`
                  : ""}
              </Text>
            </Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardBilancio]}>
            <Text style={styles.summaryLabel}>Bilancio mensile</Text>
            <Text style={[styles.summaryValore, totaleNetto >= 0 ? styles.valorePositivo : styles.valoreNegativo]}>
              {totaleNetto >= 0 ? "+" : ""}{totaleNetto.toLocaleString("it-IT")}
            </Text>
            <Text style={styles.summaryUnita}>crediti/mese</Text>
          </View>
        </View>

        {/* Dettaglio: colonna Entrate e colonna Uscite */}
        <View style={styles.bilancioCard}>
          <Text style={styles.pageTitle}>Dettaglio entrate e uscite</Text>

          <View style={[styles.dueColonne, !isDesktop && styles.dueColonneStack]}>
            {/* Colonna Entrate */}
            <View style={styles.colonna}>
              <Text style={styles.colonnaTitolo}>Entrate</Text>
              <Pressable
                style={styles.bilancioRow}
                onPress={() => getRoutePerVoceBilancio("Residenze") && router.push(getRoutePerVoceBilancio("Residenze")!)}
              >
                <Text style={styles.bilancioEmoji}>🏠</Text>
                <Text style={styles.bilancioLabel}>Residenze</Text>
                <Text style={[styles.bilancioValore, styles.valorePositivo]}>+{totaleEntrateResidenze}</Text>
              </Pressable>
              {haOrdiniEntrata && (
                <Pressable
                  style={styles.bilancioRow}
                  onPress={() => getRoutePerVoceBilancio("Ordini di Mercato") && router.push(getRoutePerVoceBilancio("Ordini di Mercato")!)}
                >
                  <Text style={styles.bilancioEmoji}>📦</Text>
                  <Text style={styles.bilancioLabel}>Ordini di Mercato</Text>
                  <Text style={[styles.bilancioValore, styles.valorePositivo]}>+{deltaCrediti}</Text>
                </Pressable>
              )}
              {!haOrdiniEntrata && deltaCrediti === 0 && (
                <Pressable
                  style={styles.bilancioRow}
                  onPress={() => getRoutePerVoceBilancio("Ordini di Mercato") && router.push(getRoutePerVoceBilancio("Ordini di Mercato")!)}
                >
                  <Text style={styles.bilancioEmoji}>📦</Text>
                  <Text style={styles.bilancioLabel}>Ordini di Mercato</Text>
                  <Text style={[styles.bilancioValore, styles.valorePositivo]}>0</Text>
                </Pressable>
              )}
            </View>

            {/* Colonna Uscite */}
            <View style={styles.colonna}>
              <Text style={styles.colonnaTitolo}>Uscite</Text>
              {(redditoCittadinanza ?? 0) > 0 && (
                <Pressable
                  style={styles.bilancioRow}
                  onPress={() => getRoutePerVoceBilancio("Redditi di Cittadinanza") && router.push(getRoutePerVoceBilancio("Redditi di Cittadinanza")!)}
                >
                  <Text style={styles.bilancioEmoji}>💳</Text>
                  <Text style={styles.bilancioLabel}>Redditi di Cittadinanza</Text>
                  <Text style={[styles.bilancioValore, styles.valoreNegativo]}>-{spesaRedditoCittadinanza}</Text>
                </Pressable>
              )}
              {spesePerTipoEdificio.map(({ nome, emoji, costo }) => {
                const route = getRoutePerVoceBilancio(nome);
                return (
                  <Pressable
                    key={nome}
                    style={styles.bilancioRow}
                    onPress={() => route && router.push(route)}
                  >
                    <Text style={styles.bilancioEmoji}>{emoji}</Text>
                    <Text style={styles.bilancioLabel}>{nome}</Text>
                    <Text style={[styles.bilancioValore, styles.valoreNegativo]}>-{costo}</Text>
                  </Pressable>
                );
              })}
              {haOrdiniUscita && (
                <Pressable
                  style={styles.bilancioRow}
                  onPress={() => getRoutePerVoceBilancio("Ordini di Mercato") && router.push(getRoutePerVoceBilancio("Ordini di Mercato")!)}
                >
                  <Text style={styles.bilancioEmoji}>📦</Text>
                  <Text style={styles.bilancioLabel}>Ordini di Mercato</Text>
                  <Text style={[styles.bilancioValore, styles.valoreNegativo]}>{deltaCrediti}</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Riga totale */}
          <View style={[styles.bilancioRow, styles.bilancioRowTotale]}>
            <Text style={styles.bilancioEmoji}>📊</Text>
            <Text style={styles.bilancioLabelTotale}>Bilancio mensile</Text>
            <Text
              style={[
                styles.bilancioValoreTotale,
                totaleNetto >= 0 ? styles.valorePositivo : styles.valoreNegativo
              ]}
            >
              {totaleNetto >= 0 ? "+" : ""}{totaleNetto}
            </Text>
          </View>
        </View>

        <Pressable style={styles.linkRow} onPress={() => router.push("/tassa-reddito")}>
          <Text style={styles.linkText}>Configura tassa sul reddito →</Text>
        </Pressable>
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
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    fontSize: 11
  },
  title: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700"
  },
  scrollContent: {
    padding: 6,
    paddingBottom: 12
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 6
  },
  summaryCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 4,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    alignItems: "center"
  },
  summaryCardBilancio: {
    borderColor: "rgba(74,222,128,0.3)"
  },
  summaryLabel: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 8,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 0
  },
  summaryValore: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "700"
  },
  summaryUnita: {
    color: "rgba(203,213,245,0.6)",
    fontSize: 8,
    marginTop: 0
  },
  summaryHint: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 8,
    marginTop: 2,
    textAlign: "center"
  },
  pageTitle: {
    color: "#93c5fd",
    fontSize: 9,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.3
  },
  bilancioCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 4,
    padding: 6,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  dueColonne: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start"
  },
  dueColonneStack: {
    flexDirection: "column",
    gap: 6
  },
  colonna: {
    flex: 1,
    minWidth: 0
  },
  colonnaTitolo: {
    color: "#93c5fd",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.4)"
  },
  bilancioRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.2)"
  },
  bilancioEmoji: {
    fontSize: 14,
    width: 22,
    textAlign: "center"
  },
  bilancioLabel: {
    flex: 1,
    color: "#e5e7eb",
    fontSize: 11
  },
  bilancioValore: {
    fontSize: 11,
    fontWeight: "600",
    minWidth: 44,
    textAlign: "right"
  },
  bilancioRowTotale: {
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.4)",
    marginTop: 2,
    paddingTop: 4
  },
  bilancioLabelTotale: {
    flex: 1,
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700"
  },
  bilancioValoreTotale: {
    fontSize: 12,
    fontWeight: "700",
    minWidth: 44,
    textAlign: "right"
  },
  valorePositivo: {
    color: "#4ade80",
    fontSize: 10,
    fontWeight: "700"
  },
  valoreNegativo: {
    color: "#ef4444",
    fontSize: 10,
    fontWeight: "700"
  },
  valoreNetto: {
    fontSize: 10,
    fontWeight: "700"
  },
  totaleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.3)",
    marginTop: 2
  },
  totaleLabel: {
    color: "#93c5fd",
    fontSize: 9,
    fontWeight: "600"
  },
  totaleValorePositivo: {
    color: "#4ade80",
    fontSize: 11,
    fontWeight: "700"
  },
  totaleValoreNegativo: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "700"
  },
  emptyText: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 10,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 6
  },
  linkRow: {
    marginTop: 6,
    paddingVertical: 4,
    alignItems: "center"
  },
  linkText: {
    color: "#93c5fd",
    fontSize: 10
  }
});
