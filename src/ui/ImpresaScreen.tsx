import React, { useMemo, useState, useSyncExternalStore } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../context/GameContext";
import { computeStatoCielo } from "../game/cicloCielo";
import { abitantiPresentiNelBarOra } from "../game/orariLavoroMappa";
import {
  etichettaDoveSiTrovaAddetto,
  lavoratoreDentroEdificioOra
} from "../game/presenzaLavoroEdificio";
import {
  getBarArrivatiMappaSnapshotForEdificio,
  subscribeBarArrivatiMappa
} from "../game/mappaBarArrivatiStore";
import {
  getEmporioArrivatiMappaSnapshotForEdificio,
  subscribeEmporioArrivatiMappa
} from "../game/mappaEmporioArrivatiStore";
import {
  getLavoroArrivatiMappaSnapshot,
  subscribeLavoroArrivatiMappa
} from "../game/mappaLavoroArrivatiStore";
import { getGiornoGiocoSnapshot } from "../game/orologioGiocoSession";
import { useOrologioGioco } from "../hooks/useOrologioGioco";
import { getServiDellaGlebaPerAssegnazioneEdificio } from "../game/edificiLavoro";
import { getCastaAbitante } from "../game/casta";
import { getProprietarioSchiavoId } from "../game/schiavituCommercio";
import { getImpresaDef } from "../data/impreseCatalogo";
import { bottinoBoscoPerAbitante, etichettaRaccoltoBosco } from "../game/boscoRaccolta";
import {
  bottinoMinieraPerAbitante,
  etichettaRaccoltoMiniera
} from "../game/minieraRaccolta";
import { MONETE_PER_UNITA_METALLO } from "../game/zeccaProduzione";
import { getOggettoInventario } from "../game/inventario";
import { getCassaImpresa, getFatturatoMeseImpresa } from "../game/impresaCassa";
import { getStipendioMoneteGiornaliero, stipendioGiornalieroToPersistito } from "../game/edificiPubblici";
import { TASSA_IMPRESA_PERCENTUALE } from "../game/economiaPrezzi";
import {
  getColturaSerraDef,
  getColtureSerraDisponibili,
  GIORNI_PRODUZIONE_SERRA_PER_MESE,
  PRODUZIONE_SERRA_GIORNALIERA
} from "../game/colturaSerra";
import { AbitanteAvatarPreview } from "./AbitanteAvatarPreview";
import { AbitanteInfoModal } from "./AbitanteInfoModal";
import { modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";
import type { Abitante, Edificio } from "../types";

type Props = {
  edificioId: number;
  /** Se impostato, cerca solo edifici con questo nome (es. "Bar"). */
  nomeAtteso?: string;
};

function clientiImpresaOra(
  edificio: Edificio,
  abitanti: Abitante[],
  orologioMinuti: number,
  buio: number,
  edifici: Edificio[],
  barArrivati: Set<number>,
  emporioArrivati: Set<number>
): Abitante[] {
  if (edificio.nome === "Bar") {
    const candidati = abitantiPresentiNelBarOra(abitanti, orologioMinuti, buio, edifici);
    // Solo chi è davvero arrivato sulla mappa (ha pagato/entrato), non tutta la fascia oraria.
    const presenti = candidati.filter((a) => barArrivati.has(a.id));
    const addettiIds = edificio.abitantiAssegnati ?? [];
    return presenti.filter((a) => !addettiIds.includes(a.id));
  }
  if (edificio.nome === "Emporio") {
    const addettiIds = new Set(edificio.abitantiAssegnati ?? []);
    return abitanti.filter((a) => emporioArrivati.has(a.id) && !addettiIds.has(a.id));
  }
  return [];
}

export function ImpresaScreen({ edificioId, nomeAtteso }: Props) {
  const router = useRouter();
  const {
    abitanti,
    edifici,
    assegnaServoDellaGlebaAEdificio,
    rimuoviAbitanteDaEdificio,
    inventarioEmporioByEdificioId,
    calcolaFelicitàModificata,
    etaMinimaLavoro,
    setStipendioEdificio,
    setColturaSerra,
    coltureSerraSbloccate,
    modalitaGioco
  } = useGameContext();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [selectedAbitante, setSelectedAbitante] = useState<Abitante | null>(null);
  const { minuti: orologioMinuti } = useOrologioGioco();
  const statoCielo = computeStatoCielo(orologioMinuti);

  const barArrivatiMappa = useSyncExternalStore(
    subscribeBarArrivatiMappa,
    () => getBarArrivatiMappaSnapshotForEdificio(edificioId),
    () => getBarArrivatiMappaSnapshotForEdificio(edificioId)
  );
  const emporioArrivatiMappa = useSyncExternalStore(
    subscribeEmporioArrivatiMappa,
    () => getEmporioArrivatiMappaSnapshotForEdificio(edificioId),
    () => getEmporioArrivatiMappaSnapshotForEdificio(edificioId)
  );
  const lavoroArrivatiMappa = useSyncExternalStore(
    subscribeLavoroArrivatiMappa,
    getLavoroArrivatiMappaSnapshot,
    getLavoroArrivatiMappaSnapshot
  );

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const edificio = useMemo(() => {
    const e = edifici.find((x) => x.id === edificioId);
    if (!e) return undefined;
    if (nomeAtteso && e.nome !== nomeAtteso) return undefined;
    return e;
  }, [edifici, edificioId, nomeAtteso]);

  const getAbitanteNome = (id: number) => abitanti.find((a) => a.id === id)?.nome ?? `ID ${id}`;

  const def = edificio ? getImpresaDef(edificio.nome) : undefined;

  const addettiIds = edificio?.abitantiAssegnati ?? [];
  const addetti = addettiIds.map((id) => abitanti.find((a) => a.id === id)).filter((a): a is Abitante => a != null);
  const addettiInServizio = addetti.filter((a) =>
    lavoratoreDentroEdificioOra(a.id, edificioId, orologioMinuti, edifici, lavoroArrivatiMappa)
  ).length;
  const giornoGioco = getGiornoGiocoSnapshot();
  const èBosco = edificio?.nome === "Bosco";
  const èMiniera = edificio?.nome === "Miniera";
  const èSitoRaccolta = èBosco || èMiniera;
  const èEmporio = edificio?.nome === "Emporio";
  const èSerra = edificio?.nome === "Serra";
  const colturaSerra = èSerra && edificio ? getColturaSerraDef(edificio.colturaItemId) : undefined;
  const produzioneSerraGiornaliera =
    èSerra && edificio?.stato === "Operativo"
      ? PRODUZIONE_SERRA_GIORNALIERA * addetti.length
      : 0;
  const coltureDisponibili = useMemo(
    () => getColtureSerraDisponibili(coltureSerraSbloccate, modalitaGioco),
    [coltureSerraSbloccate, modalitaGioco]
  );
  const scorteEmporio = useMemo(() => {
    if (!edificio || !èEmporio) return [];
    return (inventarioEmporioByEdificioId[edificio.id] ?? []).filter((v) => v.quantità > 0);
  }, [edificio, èEmporio, inventarioEmporioByEdificioId]);

  const clienti =
    edificio && def?.haClienti
      ? clientiImpresaOra(
          edificio,
          abitanti,
          orologioMinuti,
          statoCielo.buio,
          edifici,
          barArrivatiMappa,
          emporioArrivatiMappa
        )
      : [];

  const abitantiDisponibili = useMemo(() => {
    if (!edificio) return [];
    return getServiDellaGlebaPerAssegnazioneEdificio(abitanti, edifici, edificio);
  }, [abitanti, edifici, edificio]);

  if (!Number.isFinite(edificioId) || !edificio || !def) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>Impresa non trovata</Text>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Indietro
        </Text>
      </SafeAreaView>
    );
  }

  const emoji = edificio.emoji ?? "🏢";
  const titolo =
    edificioId === 17 && edificio.nome === "Bar"
      ? `${emoji} ${edificio.nome}`
      : `${emoji} ${edificio.nome} (#${edificioId})`;
  const cap = edificio.capacità ?? 20;
  const etichettaClienti = def.etichettaClienti ?? "Clienti";

  return (
    <SafeAreaView style={[styles.safe, maxHeight != null ? { maxHeight, overflow: "hidden" } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>{titolo}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          {!èSitoRaccolta && !èSerra ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Cassa Impresa</Text>
              <Text style={styles.lavoratoriCount}>{getCassaImpresa(edificio)} monete</Text>
              <Text style={styles.infoSubtext}>
                Stipendio: {getStipendioMoneteGiornaliero(edificio)} monete/giorno per lavoratore
                {edificio.nome === "Bar"
                  ? " · a fine turno: fisso da cassa + tip sul residuo"
                  : " · pagato dalla cassa"}
                . Fatturato mese: {getFatturatoMeseImpresa(edificio)} · tassa {TASSA_IMPRESA_PERCENTUALE}% a fine
                mese.
              </Text>
              <View style={styles.stipendioRow}>
                <Pressable
                  style={styles.stipendioBtn}
                  onPress={() =>
                    setStipendioEdificio(
                      edificio.id,
                      stipendioGiornalieroToPersistito(
                        Math.max(0, getStipendioMoneteGiornaliero(edificio) - 1)
                      )
                    )
                  }
                >
                  <Text style={styles.stipendioBtnText}>−</Text>
                </Pressable>
                <Text style={styles.stipendioValore}>
                  {getStipendioMoneteGiornaliero(edificio)} / giorno
                </Text>
                <Pressable
                  style={styles.stipendioBtn}
                  onPress={() =>
                    setStipendioEdificio(
                      edificio.id,
                      stipendioGiornalieroToPersistito(getStipendioMoneteGiornaliero(edificio) + 1)
                    )
                  }
                >
                  <Text style={styles.stipendioBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {èMiniera || èSerra ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Stipendio (Tesoro)</Text>
              <Text style={styles.infoSubtext}>
                {èMiniera
                  ? `Pagato dal Tesoro. Ogni Minatore deposita 1 pezzo d’oro (Metalli) al giorno nei magazzini; la Zecca ne trae ${MONETE_PER_UNITA_METALLO} monete cad.`
                  : "Pagato dal Tesoro. Gli Agricoltori producono cibo per il regno."}
              </Text>
              <View style={styles.stipendioRow}>
                <Pressable
                  style={styles.stipendioBtn}
                  onPress={() =>
                    setStipendioEdificio(
                      edificio.id,
                      stipendioGiornalieroToPersistito(
                        Math.max(0, getStipendioMoneteGiornaliero(edificio) - 1)
                      )
                    )
                  }
                >
                  <Text style={styles.stipendioBtnText}>−</Text>
                </Pressable>
                <Text style={styles.stipendioValore}>
                  {getStipendioMoneteGiornaliero(edificio)} / giorno
                </Text>
                <Pressable
                  style={styles.stipendioBtn}
                  onPress={() =>
                    setStipendioEdificio(
                      edificio.id,
                      stipendioGiornalieroToPersistito(getStipendioMoneteGiornaliero(edificio) + 1)
                    )
                  }
                >
                  <Text style={styles.stipendioBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.dueColonne}>
            <View
              style={[
                styles.colonna,
                styles.lavoratoriCard,
                (èSitoRaccolta || (!def.haClienti && !èSerra)) && styles.colonnaPiena
              ]}
            >
              <Text style={styles.sectionTitle}>
                {èBosco ? "Raccoglitori" : èMiniera ? "Minatori" : "Lavoratori"}
              </Text>
              <Text style={styles.lavoratoriCount}>
                {èBosco
                  ? `${addetti.length}/${cap} posti · ${addettiInServizio} nel Bosco`
                  : èMiniera
                    ? `${addetti.length}/${cap} posti · ${addettiInServizio} in Miniera`
                    : `${addetti.length}/${cap} posti · ${addettiInServizio} in servizio`}
              </Text>
              <Text style={styles.infoSubtext}>
                {def.hintLavoratori ?? `Ruolo: ${def.ruoloLavoratore}.`}{" "}
                {!èSitoRaccolta ? (
                  <Text style={styles.legendVerde}>Verde = attualmente nel locale.</Text>
                ) : null}
              </Text>
              {addetti.length > 0 ? (
                <View style={styles.cardsContainer}>
                  {addetti.map((a) => {
                    const presenza = etichettaDoveSiTrovaAddetto(
                      a,
                      edificioId,
                      orologioMinuti,
                      statoCielo.buio,
                      edifici,
                      lavoroArrivatiMappa
                    );
                    const inServizio = presenza.inServizio;
                    const dropBosco =
                      èBosco && !a.ultimoRaccoltoBosco?.voci?.length
                        ? bottinoBoscoPerAbitante(a.id, giornoGioco)
                        : null;
                    const dropMiniera =
                      èMiniera && !a.ultimoRaccoltoMiniera?.voci?.length
                        ? bottinoMinieraPerAbitante(a.id, giornoGioco)
                        : null;
                    return (
                      <Pressable
                        key={a.id}
                        style={[
                          styles.personCard,
                          inServizio ? styles.personCardInServizio : styles.personCardAssente
                        ]}
                        onPress={() => setSelectedAbitante(a)}
                      >
                        <AbitanteAvatarPreview abitante={a} />
                        <View style={styles.cardContent}>
                          <Text style={styles.cardTitle}>{a.nome}</Text>
                          <Text style={styles.cardInfo}>
                            {a.lavoro} · {getCastaAbitante(a)} · {a.competenza}%
                          </Text>
                          {èBosco ? (
                            <Text style={styles.presenzaLabelInServizio}>
                              {a.ultimoRaccoltoBosco?.voci?.length
                                ? `Trovato: ${etichettaRaccoltoBosco(a.ultimoRaccoltoBosco.voci)}`
                                : dropBosco
                                  ? `Cerca: ${dropBosco.emoji} ${dropBosco.nome}`
                                  : "In cerca di raccolto…"}
                            </Text>
                          ) : null}
                          {èMiniera ? (
                            <Text style={styles.presenzaLabelInServizio}>
                              {a.ultimoRaccoltoMiniera?.voci?.length
                                ? `Estratto: ${etichettaRaccoltoMiniera(a.ultimoRaccoltoMiniera.voci)}`
                                : dropMiniera
                                  ? `Scava: ${dropMiniera.emoji} ${dropMiniera.nome}`
                                  : "In cerca di minerali…"}
                            </Text>
                          ) : null}
                          <Text
                            style={[styles.presenzaLabel, inServizio && styles.presenzaLabelInServizio]}
                          >
                            {presenza.testo}
                          </Text>
                        </View>
                        {!èSitoRaccolta ? (
                          <Pressable
                            style={styles.removeButton}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              rimuoviAbitanteDaEdificio(a.id, edificio.id);
                            }}
                          >
                            <Text style={styles.removeButtonText}>Rimuovi</Text>
                          </Pressable>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.emptyVisitatori}>
                  {èBosco
                    ? "Nessun raccoglitore nel Bosco."
                    : èMiniera
                      ? "Nessun minatore in Miniera."
                      : "Nessun lavoratore assegnato."}
                </Text>
              )}
              {!èSitoRaccolta && addettiIds.length < cap && (
                <Pressable style={styles.addButton} onPress={() => setDropdownVisible(true)}>
                  <Text style={styles.addButtonText}>+ Aggiungi Servo della gleba</Text>
                </Pressable>
              )}
            </View>

            {def.haClienti ? (
              <View style={[styles.colonna, styles.clientiCard]}>
                <Text style={styles.sectionTitle}>{etichettaClienti}</Text>
                <Text style={styles.lavoratoriCount}>{clienti.length} presenti</Text>
                {def.hintClienti ? <Text style={styles.infoSubtext}>{def.hintClienti}</Text> : null}
                {clienti.length > 0 ? (
                  <View style={styles.cardsContainer}>
                    {clienti.map((a) => {
                      const propId = getProprietarioSchiavoId(a);
                      const propLabel =
                        propId === undefined
                          ? null
                          : propId === null
                            ? "Regno"
                            : getAbitanteNome(propId);
                      return (
                        <Pressable
                          key={a.id}
                          style={styles.visitatoreRow}
                          onPress={() => setSelectedAbitante(a)}
                        >
                          <AbitanteAvatarPreview abitante={a} />
                          <View style={styles.cardContent}>
                            <Text style={styles.visitatoreNome} numberOfLines={1}>
                              {a.nome}
                            </Text>
                            <Text style={styles.cardInfo} numberOfLines={1}>
                              {a.lavoro} · {getCastaAbitante(a)}
                              {propLabel != null ? ` · Prop. ${propLabel}` : ""}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.emptyVisitatori}>Nessuno presente in questo momento.</Text>
                )}
              </View>
            ) : null}

            {èSerra ? (
              <View style={[styles.colonna, styles.clientiCard]}>
                <Text style={styles.sectionTitle}>Coltura</Text>
                <Text style={styles.lavoratoriCount}>
                  {colturaSerra?.emoji ?? "🌱"} {colturaSerra?.nome ?? "—"}
                </Text>
                <Text style={styles.infoSubtext}>
                  {PRODUZIONE_SERRA_GIORNALIERA} unità/giorno per Agricoltore · ≈{" "}
                  {produzioneSerraGiornaliera * GIORNI_PRODUZIONE_SERRA_PER_MESE} / mese con{" "}
                  {addetti.length} addetti → inventario Agricoltori
                </Text>
                <Text style={[styles.infoSubtext, { marginTop: 8, marginBottom: 4 }]}>
                  {coltureDisponibili.length <= 1
                    ? "Coltura disponibile (sblocca le altre con l'obiettivo Raccolto abbondante)"
                    : "Scegli coltura"}
                </Text>
                <View style={styles.colturaGrid}>
                  {coltureDisponibili.map((c) => {
                    const selezionata = (edificio.colturaItemId ?? colturaSerra?.id) === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        style={[styles.colturaChip, selezionata && styles.colturaChipSelezionata]}
                        onPress={() => setColturaSerra(edificio.id, c.id)}
                      >
                        <Text style={styles.colturaChipEmoji}>{c.emoji}</Text>
                        <Text
                          style={[
                            styles.colturaChipNome,
                            selezionata && styles.colturaChipNomeSelezionata
                          ]}
                        >
                          {c.nome}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.dueColonne}>
            <View style={[styles.colonna, styles.merceCard]}>
              <Text style={styles.sectionTitle}>Produce / Vende</Text>
              {def.produce.map((v, i) => (
                <Text key={`${v.etichetta}-${i}`} style={styles.merceRiga}>
                  · {v.etichetta}
                </Text>
              ))}
              {èEmporio ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.sectionTitle}>Scorte Emporio</Text>
                  {scorteEmporio.length > 0 ? (
                    scorteEmporio.map((v) => {
                      const defO = getOggettoInventario(v.itemId);
                      return (
                        <Text key={v.itemId} style={styles.merceRiga}>
                          · {defO?.emoji ?? "📦"} {defO?.nome ?? v.itemId} ×{v.quantità}
                        </Text>
                      );
                    })
                  ) : (
                    <Text style={styles.infoSubtext}>Nessun alimento in scorta.</Text>
                  )}
                </View>
              ) : null}
            </View>
            <View style={[styles.colonna, styles.merceCard]}>
              <Text style={styles.sectionTitle}>Compra</Text>
              {def.compra.map((v, i) => (
                <Text key={`${v.etichetta}-${i}`} style={styles.merceRiga}>
                  · {v.etichetta}
                </Text>
              ))}
            </View>
          </View>

          <Modal
            visible={dropdownVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setDropdownVisible(false)}
          >
            <Pressable
              style={[styles.modalOverlay, isDesktop && modalBackdropFullscreen]}
              onPress={() => setDropdownVisible(false)}
            >
              <Pressable
                style={[styles.modalContent, isDesktop && modalContentFullscreen]}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Seleziona addetto</Text>
                  <Pressable onPress={() => setDropdownVisible(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </Pressable>
                </View>
                <Text style={styles.modalHint}>Solo abitanti con casta «Servo della gleba».</Text>
                <ScrollView style={styles.modalScrollView}>
                  {abitantiDisponibili.length > 0 ? (
                    abitantiDisponibili.map((a) => (
                      <Pressable
                        key={a.id}
                        style={styles.dropdownItem}
                        onPress={() => {
                          assegnaServoDellaGlebaAEdificio(a.id, edificio.id);
                          setDropdownVisible(false);
                        }}
                      >
                        <AbitanteAvatarPreview abitante={a} size={32} />
                        <View style={styles.dropdownItemTextContainer}>
                          <Text style={styles.dropdownItemNome}>{a.nome}</Text>
                          <Text style={styles.dropdownItemCompetenza}>Competenza: {a.competenza}%</Text>
                        </View>
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>Nessun Servo della gleba disponibile</Text>
                  )}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        </ScrollView>
      </View>
      <View style={styles.footer}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← Indietro
        </Text>
      </View>

      <AbitanteInfoModal
        visible={selectedAbitante !== null}
        abitante={selectedAbitante}
        edifici={edifici}
        onClose={() => setSelectedAbitante(null)}
        getAbitanteNome={getAbitanteNome}
        calcolaFelicitàModificata={calcolaFelicitàModificata}
        etaMinimaLavoro={etaMinimaLavoro}
      />
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
  content: { paddingHorizontal: 12, paddingVertical: 8, paddingBottom: 24 },
  infoCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  infoTitle: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  infoSubtext: { color: "rgba(203,213,245,0.7)", fontSize: 9, marginTop: 2 },
  stipendioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8
  },
  stipendioBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "rgba(30,41,59,0.8)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    alignItems: "center",
    justifyContent: "center"
  },
  stipendioBtnText: { color: "#e2e8f0", fontSize: 16, fontWeight: "700" },
  stipendioValore: { color: "#f8fafc", fontSize: 12, fontWeight: "600", minWidth: 72, textAlign: "center" },
  dueColonne: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 10
  },
  colonna: { flex: 1, minWidth: 0 },
  colonnaPiena: { flex: 1, width: "100%" },
  clientiCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)"
  },
  lavoratoriCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.45)"
  },
  merceCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.45)"
  },
  merceRiga: { color: "rgba(226,232,240,0.9)", fontSize: 11, marginTop: 4 },
  lavoratoriCount: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4
  },
  visitatoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(30,41,59,0.45)",
    borderRadius: 6,
    paddingHorizontal: 6
  },
  visitatoreNome: { color: "#e5e7eb", fontSize: 11, fontWeight: "600" },
  emptyVisitatori: {
    color: "rgba(203,213,245,0.55)",
    fontSize: 9,
    fontStyle: "italic",
    marginTop: 4
  },
  sectionTitle: { color: "#ffffff", fontSize: 11, fontWeight: "700", marginBottom: 6 },
  addButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 4,
    marginTop: 8,
    marginBottom: 4,
    alignItems: "center"
  },
  addButtonText: { color: "#ffffff", fontSize: 10, fontWeight: "600" },
  cardsContainer: { gap: 6 },
  personCard: {
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  personCardInServizio: {
    backgroundColor: "rgba(22,101,52,0.38)",
    borderColor: "rgba(74,222,128,0.5)"
  },
  personCardAssente: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderColor: "rgba(148,163,184,0.6)"
  },
  presenzaLabel: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(203,213,245,0.55)"
  },
  presenzaLabelInServizio: { color: "#bbf7d0" },
  legendVerde: { color: "#86efac", fontWeight: "600" },
  cardContent: { flex: 1 },
  cardTitle: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginBottom: 2 },
  cardInfo: { color: "rgba(203,213,245,0.7)", fontSize: 9 },
  removeButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4
  },
  removeButtonText: { color: "#ffffff", fontSize: 9, fontWeight: "600" },
  emptyText: {
    color: "rgba(203,213,245,0.5)",
    fontSize: 10,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center"
  },
  modalContent: {
    backgroundColor: "#050816",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    width: "80%",
    maxWidth: 400,
    maxHeight: "70%"
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.6)"
  },
  modalTitle: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  modalHint: {
    color: "rgba(203,213,245,0.65)",
    fontSize: 9,
    fontStyle: "italic",
    paddingHorizontal: 12,
    paddingBottom: 8
  },
  modalClose: { color: "rgba(203,213,245,0.7)", fontSize: 18, fontWeight: "700" },
  modalScrollView: { maxHeight: 300 },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.3)"
  },
  dropdownItemTextContainer: { flex: 1 },
  dropdownItemNome: { color: "#e5e7eb", fontSize: 11, fontWeight: "700", marginBottom: 2 },
  dropdownItemCompetenza: { color: "rgba(203,213,245,0.7)", fontSize: 9 },
  colturaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  colturaChip: {
    width: 76,
    alignItems: "center",
    backgroundColor: "rgba(30,41,59,0.55)",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)"
  },
  colturaChipSelezionata: {
    borderColor: "#4ade80",
    backgroundColor: "rgba(34,197,94,0.12)"
  },
  colturaChipEmoji: { fontSize: 18, marginBottom: 2 },
  colturaChipNome: {
    color: "rgba(203,213,245,0.85)",
    fontSize: 8,
    textAlign: "center",
    fontWeight: "600"
  },
  colturaChipNomeSelezionata: { color: "#4ade80" }
});
