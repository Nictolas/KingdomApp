import React, { useMemo } from "react";
import {
  Alert,
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { RESIDENZE_CATALOGO } from "../src/data/residenzeData";
import {
  calcolaTotaleStipendiMensiliEdificiPubblici,
  contaLavoratoriRetribuitiPubblici,
  getStipendioMensileEdificio,
  getStipendioMoneteGiornaliero,
  stipendioGiornalieroToPersistito
} from "../src/game/edificiPubblici";
import {
  isEdificioImpresa,
  isEdificioPubblicoConPostazioniLavoro
} from "../src/game/edificiLavoro";
import { TASSA_IMPRESA_PERCENTUALE } from "../src/game/economiaPrezzi";
import {
  getCassaImpresa,
  getFatturatoMeseImpresa,
  impresaHaPayrollDaCassa
} from "../src/game/impresaCassa";
import { stimaConioMensileZecca } from "../src/game/zeccaProduzione";
import { stimaGettitoTasse } from "../src/game/tasse";
import { tasseSbloccate } from "../src/game/tasseSblocco";
import { getRouteForEdificio } from "../src/navigation/edificioRoutes";
import type { Edificio } from "../src/types";

/** Stima gettito tassa impresa sul fatturato corrente (limitata dalla cassa). */
function stimaGettitoTassaImpresa(edifici: Edificio[]): number {
  let tot = 0;
  for (const e of edifici) {
    if (!isEdificioImpresa(e) || e.nome === "Bosco") continue;
    const fatturato = getFatturatoMeseImpresa(e);
    if (fatturato <= 0) continue;
    const dovuto = Math.floor((fatturato * TASSA_IMPRESA_PERCENTUALE) / 100);
    tot += Math.min(dovuto, getCassaImpresa(e));
  }
  return tot;
}

function HelpHint({ titolo, testo }: { titolo: string; testo: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Spiegazione: ${titolo}`}
      hitSlop={8}
      onPress={() => Alert.alert(titolo, testo)}
      style={styles.helpBtn}
    >
      <Text style={styles.helpBtnText}>?</Text>
    </Pressable>
  );
}

function formatSaldo(n: number): string {
  if (n > 0) return `+${n.toLocaleString("it-IT")}`;
  return n.toLocaleString("it-IT");
}

function coloreSaldo(n: number) {
  if (n > 0) return styles.valorePositivo;
  if (n < 0) return styles.valoreNegativo;
  return styles.valoreNeutro;
}

type VoceBilancio = {
  key: string;
  emoji: string;
  label: string;
  valore: number;
  onPress?: () => void;
};

export default function CreditiScreen() {
  const router = useRouter();
  const {
    abitanti,
    edifici,
    moneteGiocatore,
    risorse,
    calcolaDeltaTesoroMercato,
    prezzoResidenze,
    redditoCittadinanza,
    assegnoPensionati,
    tipoTassaReddito,
    flatTaxPercentuale,
    scaglioniConfig,
    tassaPatrimonioPercentuale,
    ivaPercentuale,
    obiettiviCompletati,
    modalitaGioco,
    setStipendioEdificio
  } = useGameContext();

  const deltaMercato = calcolaDeltaTesoroMercato();

  const gettitoTasse = useMemo(() => {
    const unlock = tasseSbloccate(obiettiviCompletati, modalitaGioco);
    return stimaGettitoTasse({
      abitanti,
      edifici,
      configReddito: unlock.has("reddito")
        ? {
            tipo: tipoTassaReddito,
            flatPercentuale: flatTaxPercentuale,
            scaglioni: scaglioniConfig
          }
        : { tipo: "flat", flatPercentuale: 0, scaglioni: [{ min: 0, max: Infinity, percentuale: 0 }] },
      tassaPatrimonioPercentuale: unlock.has("patrimonio") ? tassaPatrimonioPercentuale : 0,
      ivaPercentuale: unlock.has("iva") ? ivaPercentuale : 0
    });
  }, [
    abitanti,
    edifici,
    tipoTassaReddito,
    flatTaxPercentuale,
    scaglioniConfig,
    tassaPatrimonioPercentuale,
    ivaPercentuale,
    obiettiviCompletati,
    modalitaGioco
  ]);

  const gettitoTassaImpresa = useMemo(() => stimaGettitoTassaImpresa(edifici), [edifici]);
  const gettitoZecca = useMemo(() => stimaConioMensileZecca(edifici, risorse), [edifici, risorse]);

  const righeStipendi = useMemo(() => {
    const rows: {
      edificio: Edificio;
      daTesoro: boolean;
      lavoratori: number;
      giornaliero: number;
      mensile: number;
      totaleMese: number;
      cassa: number;
    }[] = [];
    for (const e of edifici) {
      const daTesoro = isEdificioPubblicoConPostazioniLavoro(e);
      const daCassa = impresaHaPayrollDaCassa(e);
      if (!daTesoro && !daCassa) continue;
      const lavoratori = daTesoro
        ? contaLavoratoriRetribuitiPubblici(e, abitanti)
        : (e.abitantiAssegnati?.length ?? 0);
      const giornaliero = getStipendioMoneteGiornaliero(e);
      const mensile = getStipendioMensileEdificio(e);
      rows.push({
        edificio: e,
        daTesoro,
        lavoratori,
        giornaliero,
        mensile,
        totaleMese: mensile * lavoratori,
        cassa: daCassa ? getCassaImpresa(e) : 0
      });
    }
    return rows.sort((a, b) => {
      if (a.daTesoro !== b.daTesoro) return a.daTesoro ? -1 : 1;
      if (b.totaleMese !== a.totaleMese) return b.totaleMese - a.totaleMese;
      return a.edificio.nome.localeCompare(b.edificio.nome, "it");
    });
  }, [edifici, abitanti]);

  const righeTesoro = righeStipendi.filter((r) => r.daTesoro);
  const righeCassa = righeStipendi.filter((r) => !r.daTesoro);

  const totaleStipendiEdifici = calcolaTotaleStipendiMensiliEdificiPubblici(edifici, abitanti);
  const totaleStipendiImpresa = righeCassa.reduce((sum, r) => sum + r.totaleMese, 0);

  const beneficiariRedditoCittadinanza = abitanti.filter(
    (a) => a.razza !== "Golem" && a.lavoro === "Disoccupato" && !(a.fazioni?.includes("Schiavi") ?? false)
  ).length;
  const spesaRedditoCittadinanza = (redditoCittadinanza ?? 0) * beneficiariRedditoCittadinanza;

  const numPensionati = abitanti.filter((a) => a.lavoro === "Pensionato").length;
  const spesaPensioni = numPensionati * (assegnoPensionati ?? 0);

  let totaleEntrateResidenze = 0;
  for (const e of edifici) {
    if (e.tipo !== "Residenza" || e.stato !== "Operativo") continue;
    const prezzo =
      e.nome === "Baracca"
        ? 0
        : (prezzoResidenze[e.nome] ??
          RESIDENZE_CATALOGO.find((r) => r.nome === e.nome)?.costoMensile ??
          0);
    totaleEntrateResidenze += prezzo * (e.abitantiAssegnati?.length ?? 0);
  }

  const entrateMercato = Math.max(0, deltaMercato);
  const usciteMercato = Math.max(0, -deltaMercato);

  const totaleEntrate =
    totaleEntrateResidenze +
    gettitoTasse.totale +
    gettitoTassaImpresa +
    gettitoZecca +
    entrateMercato;

  const totaleUscite =
    totaleStipendiEdifici + spesaRedditoCittadinanza + spesaPensioni + usciteMercato;

  const saldoMensile = totaleEntrate - totaleUscite;
  const previsione12Mesi = moneteGiocatore + saldoMensile * 12;

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const contentMaxWidth = isDesktop ? 1000 : undefined;

  const vociEntrate: VoceBilancio[] = [];
  if (totaleEntrateResidenze > 0) {
    vociEntrate.push({
      key: "residenze",
      emoji: "🏠",
      label: "Residenze",
      valore: totaleEntrateResidenze,
      onPress: () => router.push("/residenze")
    });
  }
  if (gettitoTasse.reddito > 0) {
    vociEntrate.push({
      key: "tassa-reddito",
      emoji: "💰",
      label: "Tassa sul Reddito",
      valore: gettitoTasse.reddito,
      onPress: () => router.push("/tassa-reddito")
    });
  }
  if (gettitoTasse.patrimonio > 0) {
    vociEntrate.push({
      key: "tassa-patrimonio",
      emoji: "💎",
      label: "Tassa sul Patrimonio",
      valore: gettitoTasse.patrimonio,
      onPress: () => router.push("/tassa-patrimonio")
    });
  }
  if (gettitoTasse.iva > 0) {
    vociEntrate.push({
      key: "iva",
      emoji: "📊",
      label: "Imposta sul Valore Aggiunto",
      valore: gettitoTasse.iva,
      onPress: () => router.push("/imposta-valore-aggiunto")
    });
  }
  if (gettitoTassaImpresa > 0) {
    vociEntrate.push({
      key: "tassa-impresa",
      emoji: "🏪",
      label: `Tassa imprese (${TASSA_IMPRESA_PERCENTUALE}%)`,
      valore: gettitoTassaImpresa
    });
  }
  if (gettitoZecca > 0) {
    vociEntrate.push({
      key: "zecca",
      emoji: "🪙",
      label: "Zecca",
      valore: gettitoZecca,
      onPress: () => router.push("/zecca")
    });
  }
  if (entrateMercato > 0) {
    vociEntrate.push({
      key: "mercato-in",
      emoji: "📦",
      label: "Ordini di Mercato",
      valore: entrateMercato,
      onPress: () => router.push("/mercato")
    });
  }

  const vociUsciteAltre: VoceBilancio[] = [];
  if ((redditoCittadinanza ?? 0) > 0) {
    vociUsciteAltre.push({
      key: "cittadinanza",
      emoji: "💳",
      label: "Reddito di Cittadinanza",
      valore: -spesaRedditoCittadinanza,
      onPress: () => router.push("/reddito-cittadinanza")
    });
  }
  if (spesaPensioni > 0) {
    vociUsciteAltre.push({
      key: "pensioni",
      emoji: "🧓",
      label: "Pensioni",
      valore: -spesaPensioni
    });
  }
  if (usciteMercato > 0) {
    vociUsciteAltre.push({
      key: "mercato-out",
      emoji: "📦",
      label: "Ordini di Mercato",
      valore: -usciteMercato,
      onPress: () => router.push("/mercato")
    });
  }

  const haUscite =
    righeTesoro.some((r) => r.totaleMese > 0 || r.lavoratori > 0) || vociUsciteAltre.length > 0;

  const apriEdificio = (edificio: Edificio) => {
    const route = getRouteForEdificio(edificio);
    if (route) router.push(route as never);
  };

  const regolaStipendio = (edificio: Edificio, deltaGiorno: number) => {
    const attuale = getStipendioMoneteGiornaliero(edificio);
    setStipendioEdificio(
      edificio.id,
      stipendioGiornalieroToPersistito(Math.max(0, attuale + deltaGiorno))
    );
  };

  const renderVoce = (voce: VoceBilancio, segnoPositivo: boolean) => {
    const content = (
      <>
        <Text style={styles.bilancioEmoji}>{voce.emoji}</Text>
        <Text style={styles.bilancioLabel}>{voce.label}</Text>
        <Text
          style={[
            styles.bilancioValore,
            segnoPositivo ? styles.valorePositivo : styles.valoreNegativo
          ]}
        >
          {formatSaldo(voce.valore)}
        </Text>
      </>
    );
    if (voce.onPress) {
      return (
        <Pressable key={voce.key} style={styles.bilancioRow} onPress={voce.onPress}>
          {content}
        </Pressable>
      );
    }
    return (
      <View key={voce.key} style={styles.bilancioRow}>
        {content}
      </View>
    );
  };

  const renderUscitaStipendio = (r: (typeof righeTesoro)[number]) => {
    if (r.totaleMese <= 0 && r.lavoratori <= 0) return null;
    return (
      <View key={`stip-${r.edificio.id}`} style={styles.uscitaStipendioBlock}>
        <Pressable style={styles.bilancioRow} onPress={() => apriEdificio(r.edificio)}>
          <Text style={styles.bilancioEmoji}>{r.edificio.emoji ?? "👷"}</Text>
          <Text style={styles.bilancioLabel}>Stipendi {r.edificio.nome}</Text>
          <Text style={[styles.bilancioValore, styles.valoreNegativo]}>
            {formatSaldo(-r.totaleMese)}
          </Text>
        </Pressable>
        <Text style={styles.uscitaStipendioDettaglio}>
          {r.lavoratori} {r.lavoratori === 1 ? "lavoratore" : "lavoratori"} · stipendio{" "}
          {r.mensile.toLocaleString("it-IT")} monete cad. · Pagato dal Tesoro
        </Text>
        <View style={styles.stipendioControls}>
          <Text style={styles.stipendioControlsLabel}>Stipendio per lavoratore</Text>
          <View style={styles.stipendioControlsBtns}>
            <Pressable style={styles.stipendioBtn} onPress={() => regolaStipendio(r.edificio, -1)}>
              <Text style={styles.stipendioBtnText}>−</Text>
            </Pressable>
            <Text style={styles.stipendioValore}>{r.mensile.toLocaleString("it-IT")}</Text>
            <Pressable style={styles.stipendioBtn} onPress={() => regolaStipendio(r.edificio, 1)}>
              <Text style={styles.stipendioBtnText}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Bilancio</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            contentMaxWidth && { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" }
          ]}
          showsVerticalScrollIndicator={true}
        >
          {/* 1. Riepilogo */}
          <View style={[styles.summaryRow, !isDesktop && styles.summaryRowStack]}>
            <View style={styles.summaryCard}>
              <View style={styles.summaryLabelRow}>
                <Text style={styles.summaryLabel}>Tesoro</Text>
                <HelpHint
                  titolo="Tesoro"
                  testo="Le monete possedute direttamente dal Regno."
                />
              </View>
              <Text style={styles.summaryValore}>
                {moneteGiocatore.toLocaleString("it-IT")}
              </Text>
              <Text style={styles.summaryUnita}>monete</Text>
              <Text style={styles.summaryHint}>Disponibilità attuale del Regno</Text>
            </View>

            <View style={[styles.summaryCard, styles.summaryCardEntrate]}>
              <Text style={styles.summaryLabel}>Entrate mensili</Text>
              <Text style={[styles.summaryValore, styles.valorePositivo]}>
                {formatSaldo(totaleEntrate)}
              </Text>
              <Text style={styles.summaryUnita}>monete/mese</Text>
            </View>

            <View style={[styles.summaryCard, styles.summaryCardUscite]}>
              <Text style={styles.summaryLabel}>Uscite mensili del Tesoro</Text>
              <Text style={[styles.summaryValore, styles.valoreNegativo]}>
                {totaleUscite > 0 ? `-${totaleUscite.toLocaleString("it-IT")}` : "0"}
              </Text>
              <Text style={styles.summaryUnita}>monete/mese</Text>
            </View>
          </View>

          <View
            style={[
              styles.saldoCard,
              saldoMensile > 0 && styles.saldoCardPositivo,
              saldoMensile < 0 && styles.saldoCardNegativo
            ]}
          >
            <View style={styles.summaryLabelRow}>
              <Text style={styles.saldoLabel}>Saldo mensile del Regno</Text>
              <HelpHint
                titolo="Saldo mensile"
                testo="Entrate mensili meno uscite del Tesoro. Non include i costi pagati dalle casse delle imprese."
              />
            </View>
            <Text style={[styles.saldoValore, coloreSaldo(saldoMensile)]}>
              {formatSaldo(saldoMensile)} monete/mese
            </Text>
            <Text style={styles.saldoFormula}>
              Entrate ({formatSaldo(totaleEntrate)}) − Uscite (
              {totaleUscite > 0 ? `-${totaleUscite.toLocaleString("it-IT")}` : "0"}) = Saldo (
              {formatSaldo(saldoMensile)})
            </Text>
            <Text style={styles.previsioneText}>
              Se nulla cambia, tra 12 mesi il Tesoro sarà:{" "}
              <Text style={styles.previsioneValore}>
                {previsione12Mesi.toLocaleString("it-IT")} monete
              </Text>
            </Text>
          </View>

          {/* 2. Dettaglio entrate / uscite */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Dettaglio del bilancio del Regno</Text>
            <Text style={styles.sectionHint}>
              Solo movimenti che entrano o escono dal Tesoro.
            </Text>

            <View style={[styles.dueColonne, !isDesktop && styles.dueColonneStack]}>
              <View style={styles.colonna}>
                <Text style={[styles.colonnaTitolo, styles.colonnaTitoloEntrate]}>Entrate</Text>
                {vociEntrate.length === 0 ? (
                  <Text style={styles.emptyText}>Nessuna entrata prevista questo mese.</Text>
                ) : (
                  vociEntrate.map((v) => renderVoce(v, true))
                )}
                <View style={[styles.bilancioRow, styles.bilancioRowTotale]}>
                  <Text style={styles.bilancioLabelTotale}>Totale entrate</Text>
                  <Text style={[styles.bilancioValoreTotale, styles.valorePositivo]}>
                    {formatSaldo(totaleEntrate)}
                  </Text>
                </View>
              </View>

              <View style={styles.colonna}>
                <Text style={[styles.colonnaTitolo, styles.colonnaTitoloUscite]}>Uscite</Text>
                {!haUscite ? (
                  <Text style={styles.emptyText}>Nessuna uscita dal Tesoro questo mese.</Text>
                ) : (
                  <>
                    {righeTesoro.map((r) => renderUscitaStipendio(r))}
                    {vociUsciteAltre.map((v) => renderVoce(v, false))}
                  </>
                )}
                <View style={[styles.bilancioRow, styles.bilancioRowTotale]}>
                  <Text style={styles.bilancioLabelTotale}>Totale uscite</Text>
                  <Text style={[styles.bilancioValoreTotale, styles.valoreNegativo]}>
                    {totaleUscite > 0 ? `-${totaleUscite.toLocaleString("it-IT")}` : "0"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.dettaglioSaldoRow}>
              <Text style={styles.dettaglioSaldoLabel}>Saldo</Text>
              <Text style={[styles.dettaglioSaldoValore, coloreSaldo(saldoMensile)]}>
                {formatSaldo(saldoMensile)}
              </Text>
            </View>
          </View>

          {/* 3. Casse delle imprese */}
          <View style={styles.sectionCard}>
            <View style={styles.summaryLabelRow}>
              <Text style={styles.sectionTitle}>Casse delle imprese</Text>
              <HelpHint
                titolo="Cassa dell'impresa"
                testo="Denaro appartenente all'impresa. Le sue spese non vengono pagate dal Tesoro."
              />
            </View>
            <Text style={styles.sectionHint}>
              Questi costi sono sostenuti direttamente dalle imprese e non vengono sottratti dal
              Tesoro.
            </Text>

            {righeCassa.length === 0 ? (
              <Text style={styles.emptyText}>Nessuna impresa con cassa e stipendi attivi.</Text>
            ) : (
              righeCassa.map(({ edificio, lavoratori, mensile, totaleMese, cassa }) => (
                <View key={edificio.id} style={styles.cassaRow}>
                  <Pressable onPress={() => apriEdificio(edificio)}>
                    <Text style={styles.cassaNome}>
                      {edificio.emoji ?? "🏪"} {edificio.nome}
                    </Text>
                  </Pressable>
                  <Text style={styles.cassaDettaglio}>
                    {lavoratori} {lavoratori === 1 ? "lavoratore" : "lavoratori"} ×{" "}
                    {mensile.toLocaleString("it-IT")} = {totaleMese.toLocaleString("it-IT")}{" "}
                    monete/mese
                  </Text>
                  <Text style={styles.cassaPagato}>Pagato dalla Cassa di {edificio.nome}</Text>
                  <Text style={styles.cassaSaldo}>
                    Cassa attuale: {cassa.toLocaleString("it-IT")} monete
                  </Text>
                  <View style={styles.stipendioControls}>
                    <Text style={styles.stipendioControlsLabel}>Stipendio per lavoratore</Text>
                    <View style={styles.stipendioControlsBtns}>
                      <Pressable
                        style={styles.stipendioBtn}
                        onPress={() => regolaStipendio(edificio, -1)}
                      >
                        <Text style={styles.stipendioBtnText}>−</Text>
                      </Pressable>
                      <Text style={styles.stipendioValore}>
                        {mensile.toLocaleString("it-IT")}
                      </Text>
                      <Pressable
                        style={styles.stipendioBtn}
                        onPress={() => regolaStipendio(edificio, 1)}
                      >
                        <Text style={styles.stipendioBtnText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))
            )}

            {totaleStipendiImpresa > 0 && (
              <View style={styles.cassaTotaleRow}>
                <Text style={styles.cassaTotaleLabel}>
                  Totale costi imprese (fuori dal Tesoro)
                </Text>
                <Text style={styles.valoreCassa}>
                  −{totaleStipendiImpresa.toLocaleString("it-IT")}
                </Text>
              </View>
            )}
          </View>

          {/* 4. Configurazione fiscale */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Configurazione fiscale</Text>
            <Pressable style={styles.linkRow} onPress={() => router.push("/tassa-reddito")}>
              <Text style={styles.linkText}>Tassa sul reddito →</Text>
            </Pressable>
            <Pressable style={styles.linkRow} onPress={() => router.push("/tassa-patrimonio")}>
              <Text style={styles.linkText}>Tassa sul patrimonio →</Text>
            </Pressable>
            <Pressable
              style={styles.linkRow}
              onPress={() => router.push("/imposta-valore-aggiunto")}
            >
              <Text style={styles.linkText}>Imposta sul Valore Aggiunto →</Text>
            </Pressable>
            <Pressable style={styles.linkRow} onPress={() => router.push("/leggi")}>
              <Text style={styles.linkText}>Tutte le leggi fiscali →</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Home
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
    paddingHorizontal: 8,
    paddingVertical: 8,
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
    fontSize: 13
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700"
  },
  scrollContent: {
    padding: 10,
    paddingBottom: 20,
    gap: 10
  },
  helpBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(148,163,184,0.25)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.55)",
    alignItems: "center",
    justifyContent: "center"
  },
  helpBtnText: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 13
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  summaryRowStack: {
    flexDirection: "column"
  },
  summaryCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)"
  },
  summaryCardEntrate: {
    borderColor: "rgba(74,222,128,0.35)"
  },
  summaryCardUscite: {
    borderColor: "rgba(239,68,68,0.35)"
  },
  summaryLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4
  },
  summaryLabel: {
    color: "rgba(203,213,245,0.85)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  summaryValore: {
    color: "#e5e7eb",
    fontSize: 22,
    fontWeight: "700"
  },
  summaryUnita: {
    color: "rgba(203,213,245,0.65)",
    fontSize: 12,
    marginTop: 2
  },
  summaryHint: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16
  },
  saldoCard: {
    backgroundColor: "rgba(15,23,42,0.98)",
    borderRadius: 8,
    padding: 14,
    borderWidth: 2,
    borderColor: "rgba(148,163,184,0.45)"
  },
  saldoCardPositivo: {
    borderColor: "rgba(74,222,128,0.55)",
    backgroundColor: "rgba(20,40,30,0.95)"
  },
  saldoCardNegativo: {
    borderColor: "rgba(239,68,68,0.55)",
    backgroundColor: "rgba(40,18,22,0.95)"
  },
  saldoLabel: {
    color: "rgba(203,213,245,0.9)",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  saldoValore: {
    fontSize: 26,
    fontWeight: "800",
    marginTop: 4
  },
  saldoFormula: {
    color: "rgba(203,213,245,0.75)",
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18
  },
  previsioneText: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 13,
    marginTop: 10,
    lineHeight: 18
  },
  previsioneValore: {
    color: "#e5e7eb",
    fontWeight: "700"
  },
  sectionCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  sectionTitle: {
    color: "#93c5fd",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4
  },
  sectionHint: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 18
  },
  dueColonne: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start"
  },
  dueColonneStack: {
    flexDirection: "column",
    gap: 14
  },
  colonna: {
    flex: 1,
    minWidth: 0
  },
  colonnaTitolo: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.4)"
  },
  colonnaTitoloEntrate: {
    color: "#4ade80"
  },
  colonnaTitoloUscite: {
    color: "#f87171"
  },
  bilancioRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.2)"
  },
  bilancioEmoji: {
    fontSize: 16,
    width: 26,
    textAlign: "center"
  },
  bilancioLabel: {
    flex: 1,
    color: "#e5e7eb",
    fontSize: 14
  },
  bilancioValore: {
    fontSize: 14,
    fontWeight: "700",
    minWidth: 56,
    textAlign: "right"
  },
  bilancioRowTotale: {
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.45)",
    marginTop: 4,
    paddingTop: 8
  },
  bilancioLabelTotale: {
    flex: 1,
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: "700"
  },
  bilancioValoreTotale: {
    fontSize: 15,
    fontWeight: "800",
    minWidth: 56,
    textAlign: "right"
  },
  dettaglioSaldoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.45)"
  },
  dettaglioSaldoLabel: {
    color: "#e5e7eb",
    fontSize: 15,
    fontWeight: "700"
  },
  dettaglioSaldoValore: {
    fontSize: 18,
    fontWeight: "800"
  },
  valorePositivo: {
    color: "#4ade80"
  },
  valoreNegativo: {
    color: "#ef4444"
  },
  valoreNeutro: {
    color: "#cbd5e1"
  },
  valoreCassa: {
    color: "#fbbf24",
    fontSize: 14,
    fontWeight: "700"
  },
  uscitaStipendioBlock: {
    paddingBottom: 8,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.2)"
  },
  uscitaStipendioDettaglio: {
    color: "rgba(203,213,245,0.75)",
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 4,
    marginBottom: 6
  },
  stipendioControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: "rgba(30,41,59,0.6)",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  stipendioControlsLabel: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 12,
    flex: 1
  },
  stipendioControlsBtns: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  stipendioBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "rgba(59,130,246,0.25)",
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.4)",
    alignItems: "center",
    justifyContent: "center"
  },
  stipendioBtnText: {
    color: "#93c5fd",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 20
  },
  stipendioValore: {
    color: "#e5e7eb",
    fontSize: 16,
    fontWeight: "700",
    minWidth: 40,
    textAlign: "center"
  },
  cassaRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.25)"
  },
  cassaNome: {
    color: "#e5e7eb",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4
  },
  cassaDettaglio: {
    color: "rgba(226,232,240,0.9)",
    fontSize: 14,
    lineHeight: 20
  },
  cassaPagato: {
    color: "#fbbf24",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4
  },
  cassaSaldo: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 13,
    marginTop: 2
  },
  cassaTotaleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.35)"
  },
  cassaTotaleLabel: {
    color: "#fbbf24",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    paddingRight: 8
  },
  emptyText: {
    color: "rgba(203,213,245,0.55)",
    fontSize: 13,
    fontStyle: "italic",
    paddingVertical: 8
  },
  linkRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.2)"
  },
  linkText: {
    color: "#93c5fd",
    fontSize: 14
  }
});
