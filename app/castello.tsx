import React, { useMemo, useState, useSyncExternalStore } from "react";
import {
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle
} from "react-native";
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

function splitNomeCognome(nome: string): { nome: string; cognome: string } {
  const t = (nome ?? "").trim();
  const lastSpace = t.lastIndexOf(" ");
  if (lastSpace <= 0) return { nome: t, cognome: "" };
  return { nome: t.slice(0, lastSpace).trim(), cognome: t.slice(lastSpace + 1).trim() };
}

function nomeMinisteroCompatto(ministero: string): string {
  return ministero.replace(/^Ministero (dell'|di |del )?/, "");
}

export default function CastelloScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1100;
  // Le web app iOS con viewport-fit=cover devono rispettare gli inset CSS di Safari.
  const topSafeArea = Platform.OS === "web" && !isDesktop
    ? ({ paddingTop: "env(safe-area-inset-top, 0px)" } as unknown as ViewStyle)
    : undefined;
  const bottomSafeArea = Platform.OS === "web"
    ? ({ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" } as unknown as ViewStyle)
    : undefined;
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
    () => consigliereAssegnatoAlCastello(consigliere, edifici) && modalitaRe !== "a_giro",
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
    return listaNobiliNelCastello(castello, abitanti).filter((a) => a.id !== consigliere?.id);
  }, [castello, abitanti, consigliere?.id]);
  const guardieInServizio = useMemo(() => {
    if (!castello) return 0;
    return guardie.filter((a) =>
      lavoratoreDentroEdificioOra(
        a.id,
        castello.id,
        orologioMinuti,
        edifici,
        lavoroArrivatiMappa,
        abitanti
      )
    ).length;
  }, [castello, guardie, orologioMinuti, edifici, lavoroArrivatiMappa, abitanti]);

  const ministriAssegnati = useMemo(
    () =>
      ministeriDisponibili.map((ministero) => ({
        ministero,
        abitante: abitanti.find((a) => a.ministero === ministero) ?? null
      })),
    [abitanti]
  );
  const numeroMinistriAssegnati = ministriAssegnati.filter(({ abitante }) => abitante != null).length;

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
    const nomeCompleto = [capitalizzaNomePersona(dati.nome), capitalizzaNomePersona(dati.cognome)]
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

  const disordineLabel =
    faseDisordine === "nessuna" ? "Nessuno" : faseDisordine === "protesta" ? "Proteste" : "Ribellione";

  const statoPresenzaRe = (() => {
    if (modalitaRe === "a_giro") return "Il Re è sulla mappa · +Popolarità";
    if (modalitaRe === "in_visita") {
      const nomeEdificio =
        edificioVisitaReId == null
          ? "edificio produttivo"
          : edifici.find((e) => e.id === edificioVisitaReId)?.nome ?? `#${edificioVisitaReId}`;
      return `In visita: ${nomeEdificio} · +Produzione`;
    }
    if (mesiConsecutiviNelCastello >= 3) {
      return `${mesiConsecutiviNelCastello} mesi nel Castello · popolarità in calo`;
    }
    if (mesiConsecutiviNelCastello > 0) return `${mesiConsecutiviNelCastello} mesi nel Castello`;
    return "Nel Castello · protetto";
  })();

  const cambiaModalitaRe = (nuovaModalita: "nel_castello" | "a_giro" | "in_visita") => {
    if (nuovaModalita === "a_giro") {
      if (modalitaRe !== "a_giro") impostaReUscitaCastelloPending();
      setModalitaRe("a_giro");
      return;
    }
    if (nuovaModalita === "in_visita") {
      azzeraReUscitaCastelloPending();
      const target =
        edificioVisitaReId ??
        edifici.find((e) => e.nome !== "Castello" && e.stato === "Operativo")?.id ??
        null;
      setModalitaRe("in_visita", target);
      return;
    }
    azzeraReUscitaCastelloPending();
    setModalitaRe("nel_castello");
  };

  const dashboard = (
    <View style={[styles.dashboard, isDesktop && styles.dashboardDesktop]}>
      <View style={[styles.column, isDesktop && styles.commandColumn]}>
        {re ? (
          <View style={[styles.panel, styles.kingPanel]}>
            <View style={styles.panelHeader}>
              <Text style={styles.sectionLabel}>Corona</Text>
              <Text style={styles.panelBadge}>RE</Text>
            </View>
            <View style={styles.personRow}>
              <AbitanteAvatarPreview abitante={re} size={56} />
              <View style={styles.personInfo}>
                <Text style={styles.personName} numberOfLines={1}>{re.nome}</Text>
                <Text style={styles.personMeta}>{re.lavoro}</Text>
                <View style={styles.inlineStats}>
                  <Text style={styles.statStrong}>★ {popolaritaRe}/100</Text>
                  <Text style={styles.statMuted}>{disordineLabel}</Text>
                </View>
              </View>
              <Pressable style={styles.smallGoldButton} onPress={() => setShowEditAspetto(true)}>
                <Text style={styles.smallGoldButtonText}>Avatar</Text>
              </Pressable>
            </View>

            <Text style={styles.microLabel}>PRESENZA DEL RE</Text>
            <View style={styles.presenceRow}>
              {([
                { id: "nel_castello" as const, label: "🏰 Castello" },
                { id: "a_giro" as const, label: "👑 A giro" },
                { id: "in_visita" as const, label: "⚒ Visita" }
              ] as const).map((opt) => (
                <Pressable
                  key={opt.id}
                  style={[styles.presenceButton, modalitaRe === opt.id && styles.presenceButtonActive]}
                  onPress={() => cambiaModalitaRe(opt.id)}
                >
                  <Text style={styles.presenceButtonText}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text
              style={[
                styles.presenceStatus,
                modalitaRe === "a_giro" && styles.presenceStatusPositive,
                mesiConsecutiviNelCastello >= 3 && modalitaRe === "nel_castello" && styles.presenceStatusWarning
              ]}
              numberOfLines={2}
            >
              {statoPresenzaRe}
            </Text>
          </View>
        ) : null}

        <View style={[styles.panel, styles.advisorPanel]}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionLabel}>Consigliere</Text>
            <Text style={[styles.statusDotText, consigliereNelCastello && styles.statusDotTextActive]}>
              {consigliere ? (consigliereNelCastello ? "● Presente" : "● Fuori") : "Vacante"}
            </Text>
          </View>
          {consigliere ? (
            <View style={styles.personRow}>
              <AbitanteAvatarPreview abitante={consigliere} size={44} />
              <View style={styles.personInfo}>
                <Text style={styles.personName} numberOfLines={1}>{consigliere.nome}</Text>
                <Text style={styles.personMeta} numberOfLines={1}>{consigliere.lavoro}</Text>
              </View>
              <Pressable
                style={styles.smallBlueButton}
                onPress={() => {
                  setCandidatoConsigliere(null);
                  setShowCambiaConsigliere(true);
                }}
              >
                <Text style={styles.smallBlueButtonText}>Cambia</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                setCandidatoConsigliere(null);
                setShowCambiaConsigliere(true);
              }}
            >
              <Text style={styles.primaryButtonText}>Nomina Consigliere</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={[styles.column, isDesktop && styles.ministersColumn]}>
        <View style={[styles.panel, styles.fillPanel]}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionLabel}>Governo</Text>
            <Text style={styles.panelCounter}>{numeroMinistriAssegnati}/{ministriAssegnati.length} Ministri</Text>
          </View>
          <View style={styles.ministersGrid}>
            {ministriAssegnati.map(({ ministero, abitante }) => (
              <View
                key={ministero}
                style={[styles.ministerTile, isDesktop ? styles.ministerTileDesktop : styles.ministerTileMobile]}
              >
                {abitante ? (
                  <AbitanteAvatarPreview abitante={abitante} size={34} />
                ) : (
                  <View style={styles.avatarPlaceholder}><Text style={styles.avatarPlaceholderText}>—</Text></View>
                )}
                <View style={styles.ministerInfo}>
                  <Text style={styles.ministerName} numberOfLines={1}>{nomeMinisteroCompatto(ministero)}</Text>
                  <Text style={[styles.ministerAssigned, !abitante && styles.vacantText]} numberOfLines={1}>
                    {abitante?.nome ?? "Vacante"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <Pressable style={styles.primaryButton} onPress={() => router.push("/ministri")}>
            <Text style={styles.primaryButtonText}>Gestisci Ministri</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.column, isDesktop && styles.courtColumn]}>
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionLabel}>Nobili</Text>
            <Text style={styles.panelCounter}>{nobili.length} residenti</Text>
          </View>
          {nobili.length > 0 ? (
            <View style={styles.compactList}>
              {nobili.slice(0, 3).map((a) => (
                <Pressable key={a.id} style={styles.compactPersonRow} onPress={() => setSelectedAbitante(a)}>
                  <AbitanteAvatarPreview abitante={a} size={30} />
                  <View style={styles.personInfo}>
                    <Text style={styles.compactPersonName} numberOfLines={1}>{a.nome}</Text>
                    <Text style={styles.compactPersonMeta} numberOfLines={1}>{a.lavoro} · {a.eta}a</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
              {nobili.length > 3 ? <Text style={styles.moreText}>+ {nobili.length - 3} altri Nobili</Text> : null}
            </View>
          ) : (
            <Text style={styles.emptyText}>Nessun altro Nobile nel Castello.</Text>
          )}
        </View>

        <View style={[styles.panel, styles.fillPanel]}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionLabel}>Guardie</Text>
            <Text style={styles.panelCounter}>{guardie.length}/{CAPACITA_GUARDIE_CASTELLO} · {guardieInServizio} in servizio</Text>
          </View>
          {guardie.length > 0 && castello ? (
            <View style={styles.compactList}>
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
                    style={[styles.guardRow, presenza.inServizio && styles.guardRowActive]}
                    onPress={() => setSelectedAbitante(a)}
                  >
                    <AbitanteAvatarPreview abitante={a} size={32} />
                    <View style={styles.personInfo}>
                      <Text style={styles.compactPersonName} numberOfLines={1}>{a.nome}</Text>
                      <Text style={styles.compactPersonMeta} numberOfLines={1}>
                        {getCastaAbitante(a)} · {a.competenza}% · {presenza.testo}
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
            <Text style={styles.emptyText}>Nessuna Guardia assegnata.</Text>
          )}
          <Text style={styles.helperText}>Le Guardie vengono assunte dai Disoccupati che chiedono lavoro al Castello.</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, topSafeArea]}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => tornaAllaMappa(router)}
          accessibilityRole="button"
          accessibilityLabel="Torna alla mappa"
        >
          <Text style={styles.backButtonText}>← Mappa</Text>
        </Pressable>
        <Text style={styles.title}>Castello</Text>
        {isDesktop ? (
          <View style={styles.headerStats}>
            <View style={styles.headerChip}><Text style={styles.headerChipLabel}>Popolarità</Text><Text style={styles.headerChipValue}>{popolaritaRe}</Text></View>
            <View style={styles.headerChip}><Text style={styles.headerChipLabel}>Disordine</Text><Text style={styles.headerChipValue}>{disordineLabel}</Text></View>
            <View style={styles.headerChip}><Text style={styles.headerChipLabel}>Nobili</Text><Text style={styles.headerChipValue}>{nobili.length}</Text></View>
            <View style={styles.headerChip}><Text style={styles.headerChipLabel}>Guardie</Text><Text style={styles.headerChipValue}>{guardie.length}/{CAPACITA_GUARDIE_CASTELLO}</Text></View>
          </View>
        ) : (
          <Pressable
            style={styles.closeButton}
            onPress={() => tornaAllaMappa(router)}
            accessibilityRole="button"
            accessibilityLabel="Chiudi Castello e torna alla mappa"
            hitSlop={8}
          >
            <Text style={styles.closeButtonText}>×</Text>
          </Pressable>
        )}
      </View>

      {isDesktop ? (
        <View style={styles.desktopViewport}>{dashboard}</View>
      ) : (
        <ScrollView contentContainerStyle={styles.mobileScrollContent} showsVerticalScrollIndicator={false}>
          {dashboard}
        </ScrollView>
      )}

      {!isDesktop ? (
        <View style={[styles.mobileCloseFooter, bottomSafeArea]}>
          <Pressable
            style={styles.mobileCloseAction}
            onPress={() => tornaAllaMappa(router)}
            accessibilityRole="button"
            accessibilityLabel="Chiudi Castello e torna alla mappa"
          >
            <Text style={styles.mobileCloseActionText}>← Torna alla mappa</Text>
          </Pressable>
        </View>
      ) : null}

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
            <Text style={styles.modalHint}>Il Consigliere vive nel Castello e ti guida all’inizio dell’avventura.</Text>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {listaCandidatiConsigliere.map((a) => (
                <Pressable
                  key={a.id}
                  style={[styles.candidatoRow, candidatoConsigliere?.id === a.id && styles.candidatoRowAttivo]}
                  onPress={() => setCandidatoConsigliere(a)}
                >
                  <AbitanteAvatarPreview abitante={a} size={40} />
                  <View style={styles.candidatoInfo}>
                    <Text style={styles.candidatoNome}>{a.nome}</Text>
                    <Text style={styles.candidatoMeta}>{a.lavoro} · {a.eta} anni</Text>
                  </View>
                </Pressable>
              ))}
              {listaCandidatiConsigliere.length === 0 ? (
                <Text style={styles.modalHint}>Nessun abitante idoneo disponibile.</Text>
              ) : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setShowCambiaConsigliere(false)}>
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
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.45)",
    backgroundColor: "#070b18"
  },
  backButton: {
    minWidth: 86,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.35)",
    backgroundColor: "rgba(37,99,235,0.18)"
  },
  backButtonText: {
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: "700"
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "rgba(51,65,85,0.5)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
    justifyContent: "center",
    alignItems: "center"
  },
  closeButtonText: {
    color: "#f8fafc",
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "500"
  },
  title: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
    flex: 1,
    textAlign: "center"
  },
  headerStats: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 6
  },
  headerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.24)",
    backgroundColor: "rgba(15,23,42,0.72)"
  },
  headerChipLabel: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  headerChipValue: {
    color: "#e2e8f0",
    fontSize: 10,
    fontWeight: "800"
  },
  desktopViewport: {
    flex: 1,
    minHeight: 0,
    padding: 10,
    overflow: "hidden"
  },
  mobileScrollContent: {
    padding: 10,
    paddingBottom: 18
  },
  mobileCloseFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(96,165,250,0.35)",
    backgroundColor: "#080f21"
  },
  mobileCloseAction: {
    minHeight: 52,
    width: "100%",
    borderRadius: 13,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center"
  },
  mobileCloseActionText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800"
  },
  dashboard: {
    gap: 10
  },
  dashboardDesktop: {
    flex: 1,
    minHeight: 0,
    flexDirection: "row",
    alignItems: "stretch"
  },
  column: {
    gap: 10
  },
  commandColumn: {
    flex: 0.9,
    minWidth: 0
  },
  ministersColumn: {
    flex: 1.25,
    minWidth: 0
  },
  courtColumn: {
    flex: 1,
    minWidth: 0
  },
  panel: {
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(71,85,105,0.72)",
    backgroundColor: "rgba(15,23,42,0.92)"
  },
  fillPanel: {
    flex: 1,
    minHeight: 0
  },
  kingPanel: {
    borderColor: "rgba(234,179,8,0.45)",
    backgroundColor: "rgba(234,179,8,0.055)"
  },
  advisorPanel: {
    borderColor: "rgba(59,130,246,0.38)"
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8
  },
  sectionLabel: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  panelBadge: {
    color: "#fde68a",
    fontSize: 9,
    fontWeight: "900",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(234,179,8,0.14)"
  },
  panelCounter: {
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: "700"
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  personInfo: {
    flex: 1,
    minWidth: 0
  },
  personName: {
    color: "#f1f5f9",
    fontSize: 12,
    fontWeight: "800"
  },
  personMeta: {
    color: "#94a3b8",
    fontSize: 9,
    marginTop: 1
  },
  inlineStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4
  },
  statStrong: {
    color: "#fde68a",
    fontSize: 9,
    fontWeight: "800"
  },
  statMuted: {
    color: "#cbd5e1",
    fontSize: 9,
    fontWeight: "600"
  },
  smallGoldButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#eab308"
  },
  smallGoldButtonText: {
    color: "#111827",
    fontSize: 9,
    fontWeight: "900"
  },
  microLabel: {
    color: "#64748b",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginTop: 11,
    marginBottom: 5
  },
  presenceRow: {
    flexDirection: "row",
    gap: 5
  },
  presenceButton: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(100,116,139,0.45)",
    backgroundColor: "rgba(15,23,42,0.7)"
  },
  presenceButtonActive: {
    borderColor: "rgba(234,179,8,0.72)",
    backgroundColor: "rgba(234,179,8,0.13)"
  },
  presenceButtonText: {
    color: "#e2e8f0",
    fontSize: 9,
    fontWeight: "800"
  },
  presenceStatus: {
    color: "#94a3b8",
    fontSize: 9,
    textAlign: "center",
    marginTop: 6,
    minHeight: 12
  },
  presenceStatusPositive: {
    color: "#86efac"
  },
  presenceStatusWarning: {
    color: "#fbbf24"
  },
  statusDotText: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "700"
  },
  statusDotTextActive: {
    color: "#86efac"
  },
  smallBlueButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#2563eb"
  },
  smallBlueButtonText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800"
  },
  primaryButton: {
    marginTop: 9,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 7,
    alignItems: "center",
    backgroundColor: "#2563eb"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800"
  },
  ministersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start",
    gap: 6,
    flex: 1,
    minHeight: 0
  },
  ministerTile: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    padding: 7,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(71,85,105,0.58)",
    backgroundColor: "rgba(2,6,23,0.36)"
  },
  ministerTileDesktop: {
    width: "49%"
  },
  ministerTileMobile: {
    width: "48.8%"
  },
  avatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(100,116,139,0.18)"
  },
  avatarPlaceholderText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "700"
  },
  ministerInfo: {
    flex: 1,
    minWidth: 0
  },
  ministerName: {
    color: "#93c5fd",
    fontSize: 8,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  ministerAssigned: {
    color: "#e2e8f0",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2
  },
  vacantText: {
    color: "#fbbf24"
  },
  compactList: {
    gap: 5
  },
  compactPersonRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(71,85,105,0.48)",
    backgroundColor: "rgba(2,6,23,0.28)"
  },
  compactPersonName: {
    color: "#e2e8f0",
    fontSize: 10,
    fontWeight: "800"
  },
  compactPersonMeta: {
    color: "#94a3b8",
    fontSize: 8,
    marginTop: 1
  },
  chevron: {
    color: "#64748b",
    fontSize: 18,
    lineHeight: 18
  },
  moreText: {
    color: "#94a3b8",
    fontSize: 9,
    fontStyle: "italic",
    textAlign: "center",
    paddingTop: 2
  },
  guardRow: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(71,85,105,0.55)",
    backgroundColor: "rgba(2,6,23,0.34)"
  },
  guardRowActive: {
    borderColor: "rgba(74,222,128,0.38)",
    backgroundColor: "rgba(22,101,52,0.2)"
  },
  removeButton: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: "rgba(239,68,68,0.9)"
  },
  removeButtonText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "800"
  },
  emptyText: {
    color: "#64748b",
    fontSize: 9,
    fontStyle: "italic",
    paddingVertical: 6
  },
  helperText: {
    color: "#64748b",
    fontSize: 8,
    lineHeight: 11,
    marginTop: 7
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(5,8,22,0.9)",
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
  }
});
