import React, { useEffect, useState } from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { Abitante, Edificio } from "../types";
import { useGameContext } from "../context/GameContext";
import {
  getEdificioAbitazione,
  getEdificiOccupazione
} from "../game/abitanteEdifici";
import { getRouteForEdificio } from "../navigation/edificioRoutes";
import { apriResidenzaAbitante, isResidenzaSuMappa } from "../navigation/apriResidenzaMappa";
import { getStatoSalute } from "../game/ciboConsumo";
import { getCastaAbitante, getEmojiCasta, isCastaCoercibile, isCastaLibera } from "../game/casta";
import {
  getEmojiSpecializzazione,
  getSpecializzazioneAbitante
} from "../game/specializzazione";
import {
  getProprietarioSchiavoId,
  getSchiaviColonia,
  getSchiaviPrivatiDi,
  isSchiavoCommerciabile,
  PREZZO_SCHIAVO_DEFAULT,
  puoUccidereSchiavo,
  ID_COMANDANTE,
  isGiocatore,
  LAVORO_GIOCATORE
} from "../game/schiavituCommercio";
import { getTitoloStudioAbitante } from "../game/titoloStudio";
import { CATEGORIA_CIBO, getVociInventarioPerCategoria } from "../game/inventario";
import { getEmojiAbitante } from "../utils/getEmojiAbitante";
import {
  abitanteUsaBisogniUmani,
  getBisogniAbitante,
  getProduttivitaEffettiva
} from "../game/bisogni";
import { CampoDiLavoroModal } from "./CampoDiLavoroModal";
import { EdificioInfoModal } from "./EdificioInfoModal";
import { DESKTOP_MODAL_BREAKPOINT, modalBackdropFullscreen, modalContentFullscreen } from "./modalFullscreenStyles";
import { PixelAvatarPreview } from "./PixelAvatarPreview";

const LAVORI_DA_MINORE = ["Studente", "Apprendista", "Tirocinante"];

type AbitanteInfoModalProps = {
  visible: boolean;
  abitante: Abitante | null;
  edifici: Edificio[];
  onClose: () => void;
  getAbitanteNome: (id: number) => string;
  calcolaFelicitàModificata?: (abitante: Abitante) => number;
  etaMinimaLavoro?: number;
  /** Se fornito (es. dalla mappa), apre la residenza senza navigare. */
  onApriResidenzaMappa?: (anchor: number) => void;
  /** Azione in corso sulla mappa, mostrata a destra del nome (es. “Sta andando a lavoro”). */
  azioneCorrente?: string | null;
};

function Row({
  emoji,
  label,
  value,
  muted,
  disoccupato,
  onPress
}: {
  emoji: string;
  label?: string;
  value: string;
  muted?: boolean;
  disoccupato?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <View style={styles.rowTextCol}>
        {label ? <Text style={styles.rowLabel}>{label}</Text> : null}
        <Text
          style={[
            styles.rowValue,
            muted && styles.rowMuted,
            disoccupato && styles.rowValueDisoccupato,
            onPress && !disoccupato && styles.rowValueLink,
            onPress && disoccupato && styles.rowValueDisoccupatoLink
          ]}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
    </>
  );

  if (!onPress) {
    return <View style={styles.rowWrap}>{content}</View>;
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.rowWrap, styles.rowPressable, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="link"
    >
      {content}
    </Pressable>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      <View style={styles.blockContent}>{children}</View>
    </View>
  );
}

function BisognoBar({ label, emoji, value }: { label: string; emoji: string; value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const color = v >= 60 ? "#4ade80" : v >= 35 ? "#fbbf24" : "#f87171";
  return (
    <View style={styles.bisognoRow}>
      <Text style={styles.bisognoLabel}>
        {emoji} {label}
      </Text>
      <View style={styles.bisognoTrack}>
        <View style={[styles.bisognoFill, { width: `${v}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.bisognoValue}>{v}</Text>
    </View>
  );
}

function InventarioSlot({
  emoji,
  quantità,
  nome
}: {
  emoji: string;
  quantità: number;
  nome?: string;
}) {
  return (
    <View style={styles.inventarioSlot}>
      <Text style={styles.inventarioEmoji}>{emoji}</Text>
      {nome ? <Text style={styles.inventarioNome}>{nome}</Text> : null}
      <Text style={styles.inventarioQty}>{quantità}</Text>
    </View>
  );
}

function InventarioCategoria({
  titolo,
  voci
}: {
  titolo: string;
  voci: ReturnType<typeof getVociInventarioPerCategoria>;
}) {
  if (voci.length === 0) return null;
  return (
    <View style={styles.inventarioCategoria}>
      <Text style={styles.inventarioCategoriaTitolo}>{titolo}</Text>
      <View style={styles.inventarioGrid}>
        {voci.map((v) => (
          <InventarioSlot
            key={v.def.id}
            emoji={v.def.emoji}
            nome={v.def.categoria === CATEGORIA_CIBO ? v.def.nome : undefined}
            quantità={v.quantità}
          />
        ))}
      </View>
    </View>
  );
}

export function AbitanteInfoModal({
  visible,
  abitante,
  edifici,
  onClose,
  getAbitanteNome,
  calcolaFelicitàModificata,
  etaMinimaLavoro = 18,
  onApriResidenzaMappa,
  azioneCorrente = null
}: AbitanteInfoModalProps) {
  const router = useRouter();
  const {
    abitanti,
    aggiungiAlCampoDiLavoroTuttiQuelliChe,
    trasferisciProprietaSchiavo,
    uccidiSchiavo
  } = useGameContext();
  const [edificioDettaglio, setEdificioDettaglio] = useState<Edificio | null>(null);

  useEffect(() => {
    if (!visible) setEdificioDettaglio(null);
  }, [visible]);

  if (!abitante) return null;

  const edificioAbitazione = getEdificioAbitazione(abitante.id, edifici);
  const edificiOccupazione = getEdificiOccupazione(abitante.id, edifici);

  const apriEdificio = (edificio: Edificio) => {
    if (edificio.tipo === "Residenza" && isResidenzaSuMappa(edificio.nome)) {
      apriResidenzaAbitante(router, abitante.id, edificio, edifici, onClose, onApriResidenzaMappa);
      return;
    }
    const route = getRouteForEdificio(edificio);
    if (route) {
      onClose();
      router.push(route);
      return;
    }
    setEdificioDettaglio(edificio);
  };

  const apriPostazioniLavoro = () => {
    onClose();
    router.push("/postazioni-lavoro");
  };

  const apriPagina = (path: "/religione" | "/personalita" | "/pianeti" | "/scuola" | "/casta") => {
    onClose();
    router.push(path);
  };

  const titoloStudio = getTitoloStudioAbitante(abitante, etaMinimaLavoro);
  const casta = getCastaAbitante(abitante);

  const maggiorenne = abitante.eta >= etaMinimaLavoro;
  const lavoroDaMinore = LAVORI_DA_MINORE.includes(abitante.lavoro);
  const emojiDisplay = maggiorenne && lavoroDaMinore ? "👤" : getEmojiAbitante(abitante);
  const lavoroDisplay = isGiocatore(abitante)
    ? LAVORO_GIOCATORE
    : maggiorenne && lavoroDaMinore
      ? "Disoccupato"
      : abitante.lavoro;

  const felicitàModificata = calcolaFelicitàModificata ? calcolaFelicitàModificata(abitante) : abitante.felicità;
  const felicitàCambiata = abitante.razza !== "Golem" && felicitàModificata !== abitante.felicità;
  const bisogni = getBisogniAbitante(abitante);
  const produttivitàEff = getProduttivitaEffettiva(abitante);

  const vociValuta = getVociInventarioPerCategoria(abitante.inventario, "Valuta");
  const vociCibo = getVociInventarioPerCategoria(abitante.inventario, CATEGORIA_CIBO);

  const schiaviInInventario =
    abitante.id === ID_COMANDANTE
      ? getSchiaviColonia(abitanti)
      : getSchiaviPrivatiDi(abitanti, abitante.id);

  const proprietarioSchiavo = isSchiavoCommerciabile(abitante)
    ? getProprietarioSchiavoId(abitante)
    : undefined;
  const padroneNome =
    proprietarioSchiavo === undefined
      ? undefined
      : proprietarioSchiavo === null
        ? "Colonia"
        : getAbitanteNome(proprietarioSchiavo);

  const puoComprareColonia =
    isSchiavoCommerciabile(abitante) && proprietarioSchiavo != null && proprietarioSchiavo !== null;
  const puoUccidereColonia = puoUccidereSchiavo(null, abitante, abitanti);

  const schiaviPerProfiloCittadinoNobile = isCastaLibera(casta)
    ? abitante.id === ID_COMANDANTE
      ? getSchiaviColonia(abitanti)
      : getSchiaviPrivatiDi(abitanti, abitante.id)
    : [];
  const schiaviNomiLabel =
    schiaviPerProfiloCittadinoNobile.length > 0
      ? schiaviPerProfiloCittadinoNobile.map((s) => s.nome).join(", ")
      : "—";

  const { width } = Dimensions.get("window");
  const isDesktop = width > DESKTOP_MODAL_BREAKPOINT;

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={[styles.backdrop, isDesktop && modalBackdropFullscreen]} onPress={onClose}>
          <Pressable style={[styles.card, isDesktop && modalContentFullscreen]} onPress={() => undefined}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Header con accento */}
            <View style={styles.headerAccent} />
            <View style={styles.header}>
              <View style={[styles.avatarWrap, abitante.aspetto && abitante.razza !== "Golem" && styles.avatarWrapPixel]}>
                {abitante.aspetto && abitante.razza !== "Golem" ? (
                  <PixelAvatarPreview compatto razza={abitante.razza ?? "Umano"} aspetto={abitante.aspetto} />
                ) : (
                  <Text style={styles.avatarEmoji}>{emojiDisplay}</Text>
                )}
              </View>
              <View style={styles.headerText}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>
                    {abitante.nome}
                  </Text>
                  {azioneCorrente ? (
                    <Text style={styles.azioneCorrente} numberOfLines={2}>
                      {azioneCorrente}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.lavoroBadge}>
                  <Text style={styles.lavoroBadgeText}>💼 {lavoroDisplay}</Text>
                </View>
              </View>
            </View>

            <View style={styles.sixCol}>
              <Block title="Bisogni">
                {abitanteUsaBisogniUmani(abitante) ? (
                  <>
                    <BisognoBar label="Fame" emoji="🍽️" value={bisogni.fame} />
                    <BisognoBar label="Energia" emoji="⚡" value={bisogni.energia} />
                    <BisognoBar label="Divertimento" emoji="🎉" value={bisogni.divertimento} />
                    <BisognoBar label="Socialità" emoji="💬" value={bisogni.socialita} />
                    <BisognoBar label="Igiene" emoji="🧼" value={bisogni.igiene} />
                  </>
                ) : (
                  <BisognoBar label="Energia" emoji="🔋" value={bisogni.energia} />
                )}
              </Block>

              <Block title="📋 Anagrafica">
                <Row emoji="🎂" value={`${abitante.eta} anni`} />
                <Row
                  emoji="🪐"
                  label="Razza"
                  value={abitante.razza ?? "Umano"}
                  onPress={() => apriPagina("/pianeti")}
                />
                <Row
                  emoji={getEmojiCasta(casta)}
                  label="Casta"
                  value={casta}
                  onPress={() => apriPagina("/casta")}
                />
                {isCastaLibera(casta) && (
                  <Row
                    emoji="⛓️"
                    label="Schiavi"
                    value={schiaviNomiLabel}
                    muted={schiaviPerProfiloCittadinoNobile.length === 0}
                  />
                )}
                {casta === "Schiavo" && (
                  <Row
                    emoji="👤"
                    label="Padrone"
                    value={padroneNome ?? "—"}
                    muted={!padroneNome}
                  />
                )}
                <Row
                  emoji="🏠"
                  label="Abitazione"
                  value={edificioAbitazione?.nome ?? "—"}
                  onPress={edificioAbitazione ? () => apriEdificio(edificioAbitazione) : undefined}
                />
                {isGiocatore(abitante) ? (
                  <Row emoji="👑" label="Occupazione" value={LAVORO_GIOCATORE} />
                ) : edificiOccupazione.length === 0 ? (
                  <Row
                    emoji="🏢"
                    label="Occupazione"
                    value="Disoccupato"
                    disoccupato
                    onPress={apriPostazioniLavoro}
                  />
                ) : (
                  edificiOccupazione.map((ed, idx) => (
                    <Row
                      key={ed.id}
                      emoji="🏢"
                      label={idx === 0 ? "Occupazione" : undefined}
                      value={ed.nome}
                      onPress={() => apriEdificio(ed)}
                    />
                  ))
                )}
                <Row emoji="⚔️" value={abitante.fazioni?.join(", ") ?? "—"} />
                <Row
                  emoji="🧠"
                  label="Personalità"
                  value={abitante.personalità?.trim() ? abitante.personalità : "—"}
                  muted={!abitante.personalità?.trim()}
                  onPress={abitante.personalità?.trim() ? () => apriPagina("/personalita") : undefined}
                />
                <Row
                  emoji="⛪"
                  label="Religione"
                  value={abitante.religione?.trim() ? abitante.religione : "—"}
                  muted={!abitante.religione?.trim()}
                  onPress={abitante.religione?.trim() ? () => apriPagina("/religione") : undefined}
                />
                <Row
                  emoji="🎓"
                  label="Titolo di Studio"
                  value={titoloStudio ?? "—"}
                  muted={titoloStudio == null}
                  onPress={titoloStudio ? () => apriPagina("/scuola") : undefined}
                />
              </Block>

              <Block title="📊 Prestazioni & Salute">
                <Row
                  emoji={getEmojiSpecializzazione(getSpecializzazioneAbitante(abitante))}
                  label="Specializzazione"
                  value={getSpecializzazioneAbitante(abitante)}
                />
                <Row emoji="⚡" label="Produttività" value={`${produttivitàEff}%${produttivitàEff !== abitante.produttività ? ` (base ${abitante.produttività})` : ""}`} />
                <Row emoji="😴" label="Stanchezza" value={`${abitante.stanchezza}%`} />
                <Row emoji="⚖️" value={abitante.razza === "Golem" ? "—" : `${abitante.peso ?? 50}`} />
                <Row emoji="🏥" value={abitante.razza === "Golem" ? "—" : getStatoSalute(abitante)} />
              </Block>

              <Block title="👥 Relazioni">
                {abitante.razza === "Golem" ? (
                  <Row emoji="—" value="—" muted />
                ) : (
                  <>
                    <Row emoji="😊" value={abitante.amici?.length ? abitante.amici.map((r) => getAbitanteNome(r.id)).join(", ") : "nessuno"} muted={!abitante.amici?.length} />
                    <Row emoji="😠" value={abitante.rivali?.length ? abitante.rivali.map((r) => getAbitanteNome(r.id)).join(", ") : "nessuno"} muted={!abitante.rivali?.length} />
                  </>
                )}
              </Block>

              <Block title="👨‍👩‍👧 Famiglia">
                {abitante.razza === "Golem" ? (
                  <Row emoji="—" value="—" muted />
                ) : (
                  <>
                    <Row emoji="💍" value={abitante.coniugeId != null ? getAbitanteNome(abitante.coniugeId) : "—"} muted={abitante.coniugeId == null} />
                    <Row emoji="👶" value={(abitante.figliIds?.length ?? 0) > 0 ? (abitante.figliIds ?? []).map(getAbitanteNome).join(", ") : "—"} muted={!(abitante.figliIds?.length ?? 0)} />
                  </>
                )}
              </Block>

              <Block title="❤️ Sentimenti">
                <Row emoji="❤️" value={abitante.razza === "Golem" ? "—" : `${abitante.lealtà}%`} />
                <Row emoji="😨" value={abitante.razza === "Golem" ? "—" : `${abitante.paura}%`} />
                <Row
                  emoji="😊"
                  value={
                    abitante.razza === "Golem"
                      ? "—"
                      : `${felicitàModificata}%${felicitàCambiata ? ` (base ${abitante.felicità})` : ""}`
                  }
                />
              </Block>

              {!isCastaCoercibile(casta) && (
                <Block title="Inventario">
                  <InventarioCategoria titolo="Valuta" voci={vociValuta} />
                  <InventarioCategoria titolo="Cibo" voci={vociCibo} />
                  {schiaviInInventario.length > 0 && (
                    <View style={styles.inventarioCategoria}>
                      <Text style={styles.inventarioCategoriaTitolo}>Schiavi</Text>
                      <View style={styles.inventarioGrid}>
                        {schiaviInInventario.map((s) => (
                          <InventarioSlot
                            key={s.id}
                            emoji={getEmojiAbitante(s)}
                            nome={s.nome}
                            quantità={1}
                          />
                        ))}
                      </View>
                    </View>
                  )}
                </Block>
              )}
            </View>

            {isSchiavoCommerciabile(abitante) && padroneNome && (
              <View style={styles.azioniSchiavo}>
                <Text style={styles.azioniSchiavoTitolo}>⛓️ Proprietà: {padroneNome}</Text>
                {puoComprareColonia && (
                  <Pressable
                    style={styles.azioneBtn}
                    onPress={() => trasferisciProprietaSchiavo(abitante.id, null, PREZZO_SCHIAVO_DEFAULT)}
                  >
                    <Text style={styles.azioneBtnText}>
                      Colonia compra ({PREZZO_SCHIAVO_DEFAULT} 💰)
                    </Text>
                  </Pressable>
                )}
                {puoUccidereColonia && (
                  <Pressable
                    style={[styles.azioneBtn, styles.azioneBtnPericolo]}
                    onPress={() => uccidiSchiavo(null, abitante.id)}
                  >
                    <Text style={styles.azioneBtnTextPericolo}>Colonia uccide (senza reato)</Text>
                  </Pressable>
                )}
                {abitanti
                  .filter((a) => puoUccidereSchiavo(a.id, abitante, abitanti))
                  .map((padrone) => (
                    <Pressable
                      key={padrone.id}
                      style={[styles.azioneBtn, styles.azioneBtnPericolo]}
                      onPress={() => uccidiSchiavo(padrone.id, abitante.id)}
                    >
                      <Text style={styles.azioneBtnTextPericolo}>
                        {padrone.nome} uccide (senza reato)
                      </Text>
                    </Pressable>
                  ))}
              </View>
            )}

            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Chiudi</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
      </Modal>

      {edificioDettaglio?.nome === "Campo di Lavoro" ? (
        <CampoDiLavoroModal
          visible={edificioDettaglio != null}
          edificio={edificioDettaglio}
          abitanti={abitanti}
          aggiungiAlCampoDiLavoroTuttiQuelliChe={aggiungiAlCampoDiLavoroTuttiQuelliChe}
          onClose={() => setEdificioDettaglio(null)}
        />
      ) : (
        <EdificioInfoModal
          visible={edificioDettaglio != null}
          edificio={edificioDettaglio}
          onClose={() => setEdificioDettaglio(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "center",
    alignItems: "center"
  },
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 0,
    minWidth: 320,
    maxWidth: 1520,
    width: "96%",
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    overflow: "hidden"
  },
  scroll: { paddingBottom: 20, paddingHorizontal: 16 },
  headerAccent: {
    height: 4,
    backgroundColor: "#3b82f6",
    width: "100%"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.15)"
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(30,41,59,0.9)",
    borderWidth: 2,
    borderColor: "rgba(59,130,246,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14
  },
  avatarEmoji: { fontSize: 30 },
  avatarWrapPixel: { width: 88, height: 96, borderRadius: 10, overflow: "hidden" },
  headerText: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
    letterSpacing: 0.2,
    flexShrink: 1,
    maxWidth: "48%"
  },
  azioneCorrente: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "600",
    color: "#86efac",
    textAlign: "right",
    lineHeight: 16,
    paddingTop: 3
  },
  lavoroBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: "rgba(59,130,246,0.2)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12
  },
  lavoroBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#93c5fd"
  },
  sixCol: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    marginTop: 14
  },
  bisognoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6
  },
  bisognoLabel: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: 88,
    fontSize: 10,
    color: "#e2e8f0",
    fontWeight: "600"
  },
  bisognoTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(51,65,85,0.8)",
    overflow: "hidden",
    minWidth: 24
  },
  bisognoFill: {
    height: "100%",
    borderRadius: 4
  },
  bisognoValue: {
    width: 24,
    textAlign: "right",
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600"
  },
  block: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "rgba(15,23,42,0.5)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
    overflow: "hidden"
  },
  blockTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(248,250,252,0.9)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "rgba(30,41,59,0.5)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.1)"
  },
  blockContent: {
    padding: 8
  },
  rowWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
    gap: 6
  },
  rowPressable: {
    borderRadius: 6,
    marginHorizontal: -2,
    paddingHorizontal: 2
  },
  rowPressed: {
    backgroundColor: "rgba(59,130,246,0.15)"
  },
  rowEmoji: { fontSize: 13, lineHeight: 18 },
  rowTextCol: {
    flex: 1,
    minWidth: 0
  },
  rowLabel: {
    fontSize: 8,
    fontWeight: "700",
    color: "rgba(148,163,184,0.85)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 1
  },
  rowValue: {
    fontSize: 11,
    color: "#e2e8f0",
    lineHeight: 16
  },
  rowValueLink: {
    color: "#93c5fd",
    fontWeight: "600",
    textDecorationLine: "underline"
  },
  rowValueDisoccupato: {
    color: "#ef4444",
    fontWeight: "700"
  },
  rowValueDisoccupatoLink: {
    color: "#ef4444",
    fontWeight: "700",
    textDecorationLine: "underline"
  },
  rowMuted: {
    color: "rgba(226,232,240,0.5)",
    fontStyle: "italic"
  },
  inventarioCategoria: {
    marginBottom: 10
  },
  inventarioCategoriaTitolo: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(148,163,184,0.9)",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  inventarioGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  inventarioSlot: {
    minWidth: 56,
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "rgba(30,41,59,0.45)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)"
  },
  inventarioEmoji: {
    fontSize: 26,
    lineHeight: 32
  },
  inventarioNome: {
    fontSize: 9,
    fontWeight: "600",
    color: "rgba(226,232,240,0.75)",
    marginTop: 2
  },
  inventarioQty: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
    color: "#e2e8f0"
  },
  closeBtn: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "rgba(59,130,246,0.9)",
    borderRadius: 12,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.4)"
  },
  closeBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700"
  },
  azioniSchiavo: {
    marginTop: 14,
    padding: 10,
    backgroundColor: "rgba(30,41,59,0.5)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
    gap: 8
  },
  azioniSchiavoTitolo: {
    color: "rgba(226,232,240,0.9)",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4
  },
  azioneBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(59,130,246,0.25)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.4)"
  },
  azioneBtnPericolo: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderColor: "rgba(239,68,68,0.4)"
  },
  azioneBtnText: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center"
  },
  azioneBtnTextPericolo: {
    color: "#fca5a5",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center"
  }
});
