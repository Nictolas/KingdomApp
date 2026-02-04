import React from "react";
import { Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import { RESIDENZE_CATALOGO } from "../src/data/residenzeData";
import type { Abitante, Edificio } from "../src/types";

export default function CreditiScreen() {
  const router = useRouter();
  const { abitanti, edifici, risorse, calcolaDeltaOrdiniMercato, prezzoResidenze } = useGameContext();

  const saldoCrediti = risorse.find((r) => r.nome === "Crediti")?.quantità ?? 0;

  // Anteprima effetto ordini di mercato sui crediti (come in Home)
  const deltaMercato = calcolaDeltaOrdiniMercato();
  const deltaCrediti = deltaMercato["Crediti"] ?? 0;
  const saldoDopoMercato = saldoCrediti + deltaCrediti;

  // Solo abitanti con reddito/spese (escludi Robot); ordina per netto decrescente
  const entrateAbitanti = abitanti
    .filter((a) => a.razza !== "Robot")
    .map((abitante) => ({
      abitante,
      reddito: abitante.reddito,
      spese: abitante.spese,
      netto: abitante.reddito - abitante.spese
    }))
    .sort((a, b) => b.netto - a.netto);

  // Costo edificio = stipendio per lavoratore × numero lavoratori (niente costo fisso)
  const speseEdifici = edifici
    .filter((e) => e.stato === "Operativo")
    .map((edificio) => {
      const stipendio = edificio.stipendioPerLavoratore ?? 0;
      const lavoratori = edificio.abitantiAssegnati?.length ?? 0;
      const costo = stipendio * lavoratori;
      return { edificio, stipendioPerLavoratore: stipendio, lavoratori, costo };
    })
    .sort((a, b) => b.costo - a.costo);

  const totaleRedditi = abitanti.filter((a) => a.razza !== "Robot").reduce((sum, a) => sum + a.reddito, 0);
  const totaleSpese = abitanti.filter((a) => a.razza !== "Robot").reduce((sum, a) => sum + a.spese, 0);
  const totaleStipendiEdifici = speseEdifici.reduce((sum, s) => sum + s.costo, 0);

  // Entrate da Residenze: prezzo impostato per tipo × residenti in ogni edificio residenza
  const edificiResidenza = edifici.filter((e) => e.tipo === "Residenza" && e.stato === "Operativo");
  const entrateResidenzeDettaglio = edificiResidenza.map((edificio) => {
    const defaultPrezzo = RESIDENZE_CATALOGO.find((r) => r.nome === edificio.nome)?.costoMensile ?? 0;
    const prezzo = prezzoResidenze[edificio.nome] ?? defaultPrezzo;
    const residenti = edificio.abitantiAssegnati?.length ?? 0;
    const entrata = prezzo * residenti;
    return { edificio, prezzo, residenti, entrata };
  });
  const totaleEntrateResidenze = entrateResidenzeDettaglio.reduce((sum, e) => sum + e.entrata, 0);

  const totaleNetto = totaleRedditi + totaleEntrateResidenze - totaleSpese - totaleStipendiEdifici;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const contentMaxWidth = isDesktop ? 1000 : undefined;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
        </Text>
        <Text style={styles.title}>Crediti</Text>
        <View style={{ width: 50 }} />
      </View>

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

        <Text style={styles.pageTitle}>Dettaglio entrate e uscite</Text>

        {/* Entrate da Residenze */}
        <View style={styles.entrateResidenzeCard}>
          <Text style={styles.sectionTitle}>Entrate da Residenze</Text>
          {entrateResidenzeDettaglio.length > 0 ? (
            <>
              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {entrateResidenzeDettaglio.map(({ edificio, prezzo, residenti, entrata }) => (
                  <View key={edificio.id} style={styles.item}>
                    <Text style={styles.itemEmoji}>{edificio.emoji}</Text>
                    <View style={styles.itemContent}>
                      <Text style={styles.itemNome}>{edificio.nome}</Text>
                      <View style={styles.itemRow}>
                        <Text style={styles.itemLabel}>Prezzo</Text>
                        <Text style={styles.itemLabel}>{prezzo} cr/mese</Text>
                      </View>
                      <View style={styles.itemRow}>
                        <Text style={styles.itemLabel}>Residenti</Text>
                        <Text style={styles.itemLabel}>{residenti}</Text>
                      </View>
                      <View style={styles.itemRow}>
                        <Text style={styles.itemLabel}>Entrata mensile</Text>
                        <Text style={styles.valorePositivo}>+{entrata}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.totaleRow}>
                <Text style={styles.totaleLabel}>Totale entrate da residenze</Text>
                <Text style={styles.totaleValorePositivo}>+{totaleEntrateResidenze}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>Nessuna residenza con residenti</Text>
          )}
        </View>

        <View style={[styles.twoCols, !isDesktop && styles.twoColsStack]}>
          <View style={[styles.col, !isDesktop && styles.colFull]}>
            <Text style={styles.sectionTitle}>Redditi e spese abitanti</Text>
            <View style={styles.card}>
              {entrateAbitanti.length > 0 ? (
                <>
                  <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                    {entrateAbitanti.map(({ abitante, reddito, spese, netto }) => (
                      <View key={abitante.id} style={styles.item}>
                        <Text style={styles.itemEmoji}>{getEmojiAbitante(abitante)}</Text>
                        <View style={styles.itemContent}>
                          <Text style={styles.itemNome}>{abitante.nome}</Text>
                          <View style={styles.itemRow}>
                            <Text style={styles.itemLabel}>Reddito</Text>
                            <Text style={styles.valorePositivo}>+{reddito}</Text>
                          </View>
                          <View style={styles.itemRow}>
                            <Text style={styles.itemLabel}>Spese</Text>
                            <Text style={styles.valoreNegativo}>-{spese}</Text>
                          </View>
                          <View style={styles.itemRow}>
                            <Text style={styles.itemLabel}>Netto</Text>
                            <Text style={[styles.valoreNetto, netto >= 0 ? styles.valorePositivo : styles.valoreNegativo]}>
                              {netto >= 0 ? "+" : ""}{netto}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                  <View style={styles.totaleRow}>
                    <Text style={styles.totaleLabel}>Totale redditi</Text>
                    <Text style={styles.totaleValorePositivo}>+{totaleRedditi}</Text>
                  </View>
                  <View style={styles.totaleRow}>
                    <Text style={styles.totaleLabel}>Totale spese abitanti</Text>
                    <Text style={styles.totaleValoreNegativo}>-{totaleSpese}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.emptyText}>Nessun abitante con reddito/spese (esclusi i Robot)</Text>
              )}
            </View>
          </View>

          <View style={[styles.col, !isDesktop && styles.colFull]}>
            <Text style={styles.sectionTitle}>Stipendi edifici</Text>
            <View style={styles.card}>
              {speseEdifici.length > 0 ? (
                <>
                  <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                    {speseEdifici.map(({ edificio, stipendioPerLavoratore, lavoratori, costo }) => (
                      <View key={edificio.id} style={styles.item}>
                        <Text style={styles.itemEmoji}>{edificio.emoji}</Text>
                        <View style={styles.itemContent}>
                          <Text style={styles.itemNome}>{edificio.nome}</Text>
                          <View style={styles.itemRow}>
                            <Text style={styles.itemLabel}>Stipendio/lavoratore</Text>
                            <Text style={styles.itemLabel}>{stipendioPerLavoratore} crediti/mese</Text>
                          </View>
                          <View style={styles.itemRow}>
                            <Text style={styles.itemLabel}>Lavoratori</Text>
                            <Text style={styles.itemLabel}>{lavoratori}</Text>
                          </View>
                          <View style={styles.itemRow}>
                            <Text style={styles.itemLabel}>Costo mensile</Text>
                            <Text style={styles.valoreNegativo}>-{costo}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                  <View style={styles.totaleRow}>
                    <Text style={styles.totaleLabel}>Totale stipendi edifici</Text>
                    <Text style={styles.totaleValoreNegativo}>-{totaleStipendiEdifici}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.emptyText}>Nessun edificio operativo</Text>
              )}
            </View>
          </View>
        </View>

        <Pressable style={styles.linkRow} onPress={() => router.push("/tassa-reddito")}>
          <Text style={styles.linkText}>Configura tassa sul reddito →</Text>
        </Pressable>
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
  scrollContent: {
    padding: 10,
    paddingBottom: 24
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12
  },
  summaryCard: {
    flex: 1,
    minWidth: 120,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    alignItems: "center"
  },
  summaryCardBilancio: {
    borderColor: "rgba(74,222,128,0.3)"
  },
  summaryLabel: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 9,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2
  },
  summaryValore: {
    color: "#e5e7eb",
    fontSize: 18,
    fontWeight: "700"
  },
  summaryUnita: {
    color: "rgba(203,213,245,0.6)",
    fontSize: 9,
    marginTop: 0
  },
  summaryHint: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    marginTop: 4,
    textAlign: "center"
  },
  pageTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  entrateResidenzeCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  twoCols: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start"
  },
  twoColsStack: {
    flexDirection: "column",
    gap: 12
  },
  col: {
    flex: 1,
    minWidth: 0
  },
  colFull: {
    marginBottom: 0
  },
  sectionTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  list: {
    maxHeight: 260,
    marginBottom: 8
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)"
  },
  itemEmoji: {
    fontSize: 20,
    marginRight: 8
  },
  itemContent: {
    flex: 1
  },
  itemNome: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2
  },
  itemLabel: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 10
  },
  valorePositivo: {
    color: "#4ade80",
    fontSize: 11,
    fontWeight: "700"
  },
  valoreNegativo: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "700"
  },
  valoreNetto: {
    fontSize: 11,
    fontWeight: "700"
  },
  totaleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.3)",
    marginTop: 4
  },
  totaleLabel: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600"
  },
  totaleValorePositivo: {
    color: "#4ade80",
    fontSize: 12,
    fontWeight: "700"
  },
  totaleValoreNegativo: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "700"
  },
  emptyText: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12
  },
  linkRow: {
    marginTop: 12,
    paddingVertical: 6,
    alignItems: "center"
  },
  linkText: {
    color: "#93c5fd",
    fontSize: 11
  }
});
