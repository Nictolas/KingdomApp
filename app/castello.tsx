import React, { useMemo, useState, useSyncExternalStore } from "react";
import { Dimensions, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGameContext } from "../src/context/GameContext";
import { tornaAllaMappa } from "../src/navigation/tornaAllaMappa";
import { ministeriDisponibili } from "../src/kingdomData";
import { ID_GIOCATORE } from "../src/game/schiavituCommercio";
import { candidatiConsigliere, trovaConsigliere } from "../src/game/consigliere";
import { consigliereAssegnatoAlCastello } from "../src/game/consiglierePresenza";
import {
  CAPACITA_GUARDIE_CASTELLO,
  listaGuardieCastello,
  listaNobiliNelCastello,
  NOME_CASTELLO,
  trovaCastelloOperativo
} from "../src/game/castelloGuardie";
import { getCastaAbitante } from "../src/game/casta";
import { computeStatoCielo } from "../src/game/cicloCielo";
import {
  getLavoroArrivatiMappaSnapshot,
  subscribeLavoroArrivatiMappa
} from "../src/game/mappaLavoroArrivatiStore";
import {
  etichettaDoveSiTrovaAddetto,
  lavoratoreDentroEdificioOra
} from "../src/game/presenzaLavoroEdificio";
import type { AspettoPersonaggio } from "../src/game/personaggioAspetto";
import { ASPETTO_GIOCATORE_DEFAULT } from "../src/game/personaggioAspetto";
import {
  azzeraReUscitaCastelloPending,
  impostaReUscitaCastelloPending
} from "../src/game/reUscitaCastelloPending";
import { useOrologioGioco } from "../src/hooks/useOrologioGioco";
import { AbitanteAvatarPreview } from "../src/ui/AbitanteAvatarPreview";
import { AbitanteInfoModal } from "../src/ui/AbitanteInfoModal";
import {
  CreazioneGiocatoreModal,
  type DatiCreazioneGiocatore
} from "../src/ui/CreazioneGiocatoreModal";
import { capitalizzaNomePersona } from "../src/game/nomiUmani";
import { modalBackdropFullscreen, modalContentFullscreen } from "../src/ui/modalFullscreenStyles";
import type { Abitante } from "../src/types";

/** Suddivide "Nome Cognome" in nome e cognome (ultimo spazio). */
function splitNomeCognome(nome: string): { nome: string; cognome: string } {
  const t = (nome ?? "").trim();
  const lastSpace = t.lastIndexOf(" ");
  if (lastSpace <= 0) return { nome: t, cognome: "" };
  return { nome: t.slice(0, lastSpace).trim(), cognome: t.slice(lastSpace + 1).trim() };
}

export default function CastelloScreen() {
  const router = useRouter();
  const {
    abitanti,
    aggiornaAbitanteById,
    modalitaRe,
    setModalitaRe,
    popolaritaRe,
    faseDisordine,
    mesiConsecutiviNelCastello,
    edificioVisitaReId,
    edifici,
    nominaConsigliere,
    rimuoviAbitanteDaEdificio,
    calcolaFelicitàModificata,
    etaMinimaLavoro
  } = useGameContext();
  const [showEditAspetto, setShowEditAspetto] = useState(false);
  const [showCambiaConsigliere, setShowCambiaConsigliere] = useState(false);
  const [candidatoConsigliere, setCandidatoConsigliere] = useState<Abitante | null>(null);
  const [selectedAbitante, setSelectedAbitante] = useState<Abitante | null>(null);
  const { minuti: orologioMinuti } = useOrologioGioco();
  const statoCielo = computeStatoCielo(orologioMinuti);
  const lavoroArrivatiMappa = useSyncExternalStore(
    subscribeLavoroArrivatiMappa,
    getLavoroArrivatiMappaSnapshot,
    getLavoroArrivatiMappaSnapshot
  );

  const re = abitanti.find((a) => a.id === ID_GIOCATORE);
  const consigliere = useMemo(() => trovaConsigliere(abitanti), [abitanti]);
  const consigliereNelCastello = useMemo(
    () =>
      consigliereAssegnatoAlCastello(consigliere, edifici) && modalitaRe !== "a_giro",
    [consigliere, edifici, modalitaRe]
  );
  const listaCandidatiConsigliere = useMemo(
    () => candidatiConsigliere(abitanti, consigliere?.id),
    [abitanti, consigliere?.id]
  );
  const castello = useMemo(() => trovaCastelloOperativo(edifici), [edifici]);
  const guardie = useMemo(
    () => (castello ? listaGuardieCastello(castello, abitanti) : []),
    [castello, abitanti]
  );
  const nobili = useMemo(() => {
    if (!castello) return [];
    return listaNobiliNelCastello(castello, abitanti).filter(
      (a) => a.id !== consigliere?.id
    );
  }, [castello, abitanti, consigliere?.id]);
  const guardieInServizio = useMemo(() => {
    if (!castello) return 0;
    return guardie.filter((a) =>
      lavoratoreDentroEdificioOra(a.id, castello.id, orologioMinuti, edifici, lavoroArrivatiMappa, abitanti)
    ).length;
  }, [castello, guardie, orologioMinuti, edifici, lavoroArrivatiMappa, abitanti]);

  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const containerHeight = isDesktop ? width * (9 / 16) : undefined;
  const maxHeight = isDesktop ? containerHeight : undefined;

  const ministriAssegnati = useMemo(() => {
    return ministeriDisponibili.map((ministero) => ({
      ministero,
      abitante: abitanti.find((a) => a.ministero === ministero) ?? null
    }));
  }, [abitanti]);

  const getAbitanteNome = (id: number) => abitanti.find((a) => a.id === id)?.nome ?? `ID ${id}`;

  const initialEditDati = useMemo((): DatiCreazioneGiocatore | null => {
    if (!re) return null;
    const { nome, cognome } = splitNomeCognome(re.nome);
    return {
      nome,
      cognome,
      sesso: re.sesso === "F" ? "F" : "M",
      orientamento: (re.orientamento as DatiCreazioneGiocatore["orientamento"]) ?? "Etero",
      razza: "Umano",
      aspetto: (re.aspetto as AspettoPersonaggio) ?? ASPETTO_GIOCATORE_DEFAULT
    };
  }, [re]);

  const handleSalvaAspetto = (dati: DatiCreazioneGiocatore) => {
    const nomeCompleto = [
      capitalizzaNomePersona(dati.nome),
      capitalizzaNomePersona(dati.cognome)
    ]
      .filter(Boolean)
      .join(" ");
    if (!nomeCompleto || !re) return;
    aggiornaAbitanteById(re.id, (a) => ({
      ...a,
      nome: nomeCompleto,
      sesso: dati.sesso,
      orientamento: dati.orientamento,
      aspetto: dati.aspetto
    }));
    setShowEditAspetto(false);
  };

  const handleConfermaConsigliere = () => {
    if (!candidatoConsigliere) return;
    nominaConsigliere(candidatoConsigliere.id);
    setShowCambiaConsigliere(false);
    setCandidatoConsigliere(null);
  };

  return (
    <SafeAreaView style={[styles.safe, maxHeight != null ? { maxHeight, overflow: "hidden" as const } : undefined]}>
      <View style={styles.header}>
        <View style={{ width: 50 }} />
        <Text style={styles.title}>Castello</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          {re ? (
            <View style={styles.reSection}>
              <Text style={styles.sectionLabel}>Il Re</Text>
              <View style={[styles.card, styles.cardRe]}>
                <AbitanteAvatarPreview abitante={re} />
                <Text style={styles.cardTitle}>{re.nome}</Text>
                <Text style={styles.line}>{re.lavoro}</Text>
                <Text style={styles.line}>Popolarità: {popolaritaRe}/100</Text>
                <Text style={styles.line}>
                  Disordine:{" "}
                  {faseDisordine === "nessuna"
                    ? "nessuno"
                    : faseDisordine === "protesta"
                      ? "proteste"
                      : "ribellione"}
                </Text>
                <Pressable style={styles.modificaButton} onPress={() => setShowEditAspetto(true)}>
                  <Text style={styles.modificaButtonText}>Modifica avatar</Text>
                </Pressable>
              </View>

              <Text style={styles.sectionLabel}>Modalità presenza</Text>
              <View style={styles.modalitaRow}>
                {(
                  [
                    { id: "nel_castello" as const, label: "🏰 Castello", hint: "Sicuro" },
                    { id: "a_giro" as const, label: "👑 A giro", hint: "+Popolarità" },
                    { id: "in_visita" as const, label: "🏭 Visita", hint: "+Produzione" }
                  ] as const
                ).map((opt) => (
                  <Pressable
                    key={opt.id}
                    style={[styles.modalitaBtn, modalitaRe === opt.id && styles.modalitaBtnAttivo]}
                    onPress={() => {
                      if (opt.id === "a_giro") {
                        if (modalitaRe !== "a_giro") {
                          impostaReUscitaCastelloPending();
                        }
                        setModalitaRe("a_giro");
                      } else if (opt.id === "in_visita") {
                        azzeraReUscitaCastelloPending();
                        const target =
                          edificioVisitaReId ??
                          edifici.find((e) => e.nome !== "Castello" && e.stato === "Operativo")?.id ??
                          null;
                        setModalitaRe("in_visita", target);
                      } else {
                        azzeraReUscitaCastelloPending();
                        setModalitaRe(opt.id);
                      }
                    }}
                  >
                    <Text style={styles.modalitaBtnText}>{opt.label}</Text>
                    <Text style={styles.modalitaHint}>{opt.hint}</Text>
                  </Pressable>
                ))}
              </View>
              {modalitaRe === "nel_castello" && mesiConsecutiviNelCastello > 0 ? (
                <Text style={styles.line}>
                  Mesi nel castello: {mesiConsecutiviNelCastello}
                  {mesiConsecutiviNelCastello >= 3 ? " (popolarità in calo)" : ""}
                </Text>
              ) : null}
              {modalitaRe === "a_giro" ? (
                <Text style={styles.hintAGiro}>
                  Il Re è uscito dal Castello e si muove sulla mappa.
                </Text>
              ) : null}
              {modalitaRe === "in_visita" && edificioVisitaReId != null ? (
                <Text style={styles.line}>
                  Visita: {edifici.find((e) => e.id === edificioVisitaReId)?.nome ?? `#${edificioVisitaReId}`}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.consigliereSection}>
            <Text style={styles.sectionLabel}>Consigliere</Text>
            <View style={[styles.card, styles.cardConsigliere]}>
              {consigliere ? (
                <>
                  <AbitanteAvatarPreview abitante={consigliere} />
                  <Text style={styles.cardTitle}>{consigliere.nome}</Text>
                  <Text style={styles.line}>{consigliere.lavoro}</Text>
                  <Text
                    style={[
                      styles.line,
                      consigliereNelCastello ? styles.presenzaLabelInServizio : styles.presenzaFuori
                    ]}
                  >
                    {consigliereNelCastello ? "Nel Castello" : "Fuori dal Castello"}
                  </Text>
                </>
              ) : (
                <Text style={styles.nonAssegnato}>Nessun Consigliere</Text>
              )}
              <Pressable
                style={styles.cambiaConsigliereButton}
                onPress={() => {
                  setCandidatoConsigliere(null);
                  setShowCambiaConsigliere(true);
                }}
              >
                <Text style={styles.cambiaConsigliereButtonText}>
                  {consigliere ? "Cambia Consigliere" : "Nomina Consigliere"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.nobiliSection}>
            <Text style={styles.sectionLabel}>Nobili</Text>
            <View style={styles.guardieCard}>
              <Text style={styles.guardieHint}>
                I Nobili vivono nel Castello come il Re e il Consigliere.
              </Text>
              {nobili.length > 0 ? (
                <View style={styles.guardieList}>
                  {nobili.map((a) => (
                    <Pressable
                      key={a.id}
                      style={styles.guardiaCard}
                      onPress={() => setSelectedAbitante(a)}
                    >
                      <AbitanteAvatarPreview abitante={a} />
                      <View style={styles.guardiaInfo}>
                        <Text style={styles.guardiaNome}>{a.nome}</Text>
                        <Text style={styles.guardiaMeta}>
                          {a.lavoro} · {getCastaAbitante(a)} · {a.eta}a
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyGuardie}>Nessun altro Nobile nel Castello.</Text>
              )}
            </View>
          </View>

          <View style={styles.guardieSection}>
            <Text style={styles.sectionLabel}>Guardie</Text>
            <View style={styles.guardieCard}>
              <Text style={styles.guardieCount}>
                {guardie.length}/{CAPACITA_GUARDIE_CASTELLO} posti · {guardieInServizio} in servizio
              </Text>
              <Text style={styles.guardieHint}>
                Le Guardie vengono assunte quando i Disoccupati chiedono lavoro al {NOME_CASTELLO}.{" "}
                <Text style={styles.legendVerde}>Verde = attualmente in Castello.</Text>
              </Text>
              {guardie.length > 0 && castello ? (
                <View style={styles.guardieList}>
                  {guardie.map((a) => {
                    const presenza = etichettaDoveSiTrovaAddetto(
                      a,
                      castello.id,
                      orologioMinuti,
                      statoCielo.buio,
                      edifici,
                      lavoroArrivatiMappa,
                      abitanti
                    );
                    return (
                      <Pressable
                        key={a.id}
                        style={[
                          styles.guardiaCard,
                          presenza.inServizio ? styles.guardiaCardInServizio : styles.guardiaCardAssente
                        ]}
                        onPress={() => setSelectedAbitante(a)}
                      >
                        <AbitanteAvatarPreview abitante={a} />
                        <View style={styles.guardiaInfo}>
                          <Text style={styles.guardiaNome}>{a.nome}</Text>
                          <Text style={styles.guardiaMeta}>
                            {a.lavoro} · {getCastaAbitante(a)} · {a.competenza}%
                          </Text>
                          <Text
                            style={[
                              styles.presenzaLabel,
                              presenza.inServizio && styles.presenzaLabelInServizio
                            ]}
                          >
                            {presenza.testo}
                          </Text>
                        </View>
                        <Pressable
                          style={styles.removeButton}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            rimuoviAbitanteDaEdificio(a.id, castello.id);
                          }}
                        >
                          <Text style={styles.removeButtonText}>Rimuovi</Text>
                        </Pressable>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.emptyGuardie}>Nessuna Guardia assegnata.</Text>
              )}
            </View>
          </View>

          <View style={styles.ministriSection}>
            <Text style={styles.sectionLabel}>Ministri</Text>
            <View style={styles.ministriList}>
              {ministriAssegnati.map(({ ministero, abitante }) => (
                <View key={ministero} style={styles.ministroRow}>
                  {abitante ? (
                    <AbitanteAvatarPreview abitante={abitante} size={36} />
                  ) : (
                    <View style={styles.avatarPlaceholder} />
                  )}
                  <View style={styles.ministroInfo}>
                    <Text style={styles.ministroNome} numberOfLines={1}>
                      {ministero.replace(/^Ministero (dell'|di |del )?/, "")}
                    </Text>
                    <Text style={styles.ministroAssegnato} numberOfLines={1}>
                      {abitante?.nome ?? "Non assegnato"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <Pressable style={styles.scegliMinistriButton} onPress={() => router.push("/ministri")}>
              <Text style={styles.scegliMinistriButtonText}>Scegli i Ministri</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Text
          style={styles.back}
          onPress={() => {
            // L’uscita animata parte al focus della mappa (se «A giro» è attivo).
            tornaAllaMappa(router);
          }}
        >
          ← Indietro
        </Text>
      </View>

      {initialEditDati ? (
        <CreazioneGiocatoreModal
          visible={showEditAspetto}
          mode="edit"
          initial={initialEditDati}
          onConferma={handleSalvaAspetto}
          onAnnulla={() => setShowEditAspetto(false)}
        />
      ) : null}

      <Modal
        visible={showCambiaConsigliere}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCambiaConsigliere(false)}
      >
        <Pressable
          style={[styles.modalBackdrop, isDesktop && modalBackdropFullscreen]}
          onPress={() => setShowCambiaConsigliere(false)}
        >
          <Pressable
            style={[styles.modalCard, isDesktop && modalContentFullscreen]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Scegli il Consigliere</Text>
            <Text style={styles.modalHint}>
              Il Consigliere vive nel Castello e ti guida all’inizio dell’avventura.
            </Text>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {listaCandidatiConsigliere.map((a) => (
                <Pressable
                  key={a.id}
                  style={[
                    styles.candidatoRow,
                    candidatoConsigliere?.id === a.id && styles.candidatoRowAttivo
                  ]}
                  onPress={() => setCandidatoConsigliere(a)}
                >
                  <AbitanteAvatarPreview abitante={a} size={40} />
                  <View style={styles.candidatoInfo}>
                    <Text style={styles.candidatoNome}>{a.nome}</Text>
                    <Text style={styles.candidatoMeta}>
                      {a.lavoro} · {a.eta} anni
                    </Text>
                  </View>
                </Pressable>
              ))}
              {listaCandidatiConsigliere.length === 0 ? (
                <Text style={styles.modalHint}>Nessun abitante idoneo disponibile.</Text>
              ) : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setShowCambiaConsigliere(false)}
              >
                <Text style={styles.modalCancelText}>Annulla</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirm, !candidatoConsigliere && styles.modalConfirmDisabled]}
                disabled={!candidatoConsigliere}
                onPress={handleConfermaConsigliere}
              >
                <Text style={styles.modalConfirmText}>Conferma</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
  reSection: {
    marginBottom: 16
  },
  sectionLabel: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
    alignItems: "center",
    marginBottom: 10
  },
  cardRe: {
    borderColor: "rgba(234,179,8,0.5)",
    backgroundColor: "rgba(234,179,8,0.06)"
  },
  cardTitle: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
    textAlign: "center"
  },
  line: {
    color: "#cbd5f5",
    fontSize: 10,
    marginBottom: 1,
    textAlign: "center"
  },
  modificaButton: {
    backgroundColor: "#eab308",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
    width: "100%",
    alignItems: "center"
  },
  modificaButtonText: {
    color: "#0f172a",
    fontSize: 11,
    fontWeight: "700"
  },
  modalitaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8
  },
  modalitaBtn: {
    flex: 1,
    minWidth: 90,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.45)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center"
  },
  modalitaBtnAttivo: {
    borderColor: "rgba(234,179,8,0.7)",
    backgroundColor: "rgba(234,179,8,0.12)"
  },
  modalitaBtnText: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "700"
  },
  modalitaHint: {
    color: "rgba(203,213,245,0.65)",
    fontSize: 9,
    marginTop: 2
  },
  hintAGiro: {
    color: "#4ade80",
    fontSize: 10,
    textAlign: "center",
    marginBottom: 6
  },
  consigliereSection: {
    marginBottom: 16
  },
  cardConsigliere: {
    borderColor: "rgba(59,130,246,0.45)",
    backgroundColor: "rgba(59,130,246,0.06)"
  },
  nobiliSection: {
    marginBottom: 16
  },
  nonAssegnato: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 12,
    marginBottom: 6
  },
  cambiaConsigliereButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
    width: "100%",
    alignItems: "center"
  },
  cambiaConsigliereButtonText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700"
  },
  guardieSection: {
    marginBottom: 16
  },
  guardieCard: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.45)"
  },
  guardieCount: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4
  },
  guardieHint: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9,
    marginBottom: 8
  },
  legendVerde: {
    color: "#86efac",
    fontWeight: "600"
  },
  guardieList: {
    gap: 6
  },
  guardiaCard: {
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  guardiaCardInServizio: {
    backgroundColor: "rgba(22,101,52,0.38)",
    borderColor: "rgba(74,222,128,0.5)"
  },
  guardiaCardAssente: {
    backgroundColor: "rgba(15,23,42,0.95)",
    borderColor: "rgba(148,163,184,0.6)"
  },
  guardiaInfo: {
    flex: 1
  },
  guardiaNome: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2
  },
  guardiaMeta: {
    color: "rgba(203,213,245,0.7)",
    fontSize: 9
  },
  presenzaLabel: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(203,213,245,0.55)"
  },
  presenzaLabelInServizio: {
    color: "#bbf7d0"
  },
  presenzaFuori: {
    color: "rgba(203,213,245,0.55)"
  },
  removeButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4
  },
  removeButtonText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "600"
  },
  emptyGuardie: {
    color: "rgba(203,213,245,0.55)",
    fontSize: 9,
    fontStyle: "italic",
    marginTop: 4
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 8, 22, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 16,
    width: "100%",
    maxWidth: 420,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  modalTitle: {
    color: "#f1f5f9",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center"
  },
  modalHint: {
    color: "#94a3b8",
    fontSize: 12,
    marginBottom: 12,
    textAlign: "center"
  },
  modalList: {
    maxHeight: 320,
    marginBottom: 12
  },
  candidatoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    marginBottom: 6,
    backgroundColor: "rgba(15,23,42,0.8)"
  },
  candidatoRowAttivo: {
    borderColor: "#3b82f6",
    backgroundColor: "rgba(59,130,246,0.15)"
  },
  candidatoInfo: {
    flex: 1
  },
  candidatoNome: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "700"
  },
  candidatoMeta: {
    color: "#94a3b8",
    fontSize: 11
  },
  modalActions: {
    flexDirection: "row",
    gap: 8
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  modalCancelText: {
    color: "#cbd5e1",
    fontWeight: "600"
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#2563eb"
  },
  modalConfirmDisabled: {
    opacity: 0.45
  },
  modalConfirmText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  ministriSection: {
    marginBottom: 8
  },
  ministriList: {
    gap: 6,
    marginBottom: 10
  },
  ministroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.45)"
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(148,163,184,0.2)"
  },
  ministroInfo: {
    flex: 1
  },
  ministroNome: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  ministroAssegnato: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "600"
  },
  scegliMinistriButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center"
  },
  scegliMinistriButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700"
  }
});
