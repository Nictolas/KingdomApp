import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type DimensionValue } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { FamigliaAlberoModal } from "./FamigliaAlberoModal";
import { FamigliaDettaglioModal } from "./FamigliaDettaglioModal";
import { AbitanteLpcAvatar } from "./AbitanteLpcAvatar";

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
  /** Evidenzia l'abitante sulla mappa. */
  onIndividua?: (abitanteId: number) => void;
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

function Block({ title, children, width }: { title: string; children: React.ReactNode; width: DimensionValue }) {
  return (
    <View style={[styles.block, { width }]}>
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
      <View style={styles.bisognoMeta}>
        <Text style={styles.bisognoLabel}>{emoji} {label}</Text>
        <Text style={styles.bisognoValue}>{v}%</Text>
      </View>
      <View style={styles.bisognoTrack}>
        <View style={[styles.bisognoFill, { width: `${v}%`, backgroundColor: color }]} />
      </View>
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
            nome={v.def.nome}
            quantità={v.quantità}
          />
        ))}
      </View>
    </View>
  );
}

export function AbitanteInfoModal({
  visible,
  abitante: abitanteIniziale,
  edifici,
  onClose,
  getAbitanteNome,
  calcolaFelicitàModificata,
  etaMinimaLavoro = 18,
  onApriResidenzaMappa,
  azioneCorrente = null,
  onIndividua
}: AbitanteInfoModalProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const {
    abitanti,
    aggiungiAlCampoDiLavoroTuttiQuelliChe,
    trasferisciProprietaSchiavo,
    uccidiSchiavo
  } = useGameContext();
  const [edificioDettaglio, setEdificioDettaglio] = useState<Edificio | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [mostraFamiglia, setMostraFamiglia] = useState(false);
  const [mostraAlbero, setMostraAlbero] = useState(false);

  useEffect(() => {
    if (!visible) {
      setEdificioDettaglio(null);
      setMostraFamiglia(false);
      setMostraAlbero(false);
      setFocusId(null);
      return;
    }
    if (abitanteIniziale) setFocusId(abitanteIniziale.id);
  }, [visible, abitanteIniziale?.id]);

  const abitante =
    focusId == null
      ? abitanteIniziale
      : abitanti.find((a) => a.id === focusId) ?? abitanteIniziale;

  if (!abitante) return null;

  const apriFamiliare = (id: number) => {
    setFocusId(id);
    setMostraFamiglia(false);
    setMostraAlbero(false);
  };

  const edificioAbitazione = getEdificioAbitazione(abitante.id, edifici, abitante);
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

  const apriPagina = (path: "/religione" | "/personalita" | "/pianeti" | "/scuola" | "/casta" | "/razze") => {
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
        ? "Corona"
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

  const cardWidth: DimensionValue = width >= 1260 ? "31.5%" : width >= 720 ? "48%" : "100%";

  return (
    <>
      <Modal
        visible={visible}
        transparent={false}
        presentationStyle="fullScreen"
        animationType="slide"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
          <View style={styles.topBar}>
            <Text style={styles.topBarTitle}>Scheda personaggio</Text>
          </View>
          <ScrollView
            style={styles.contentScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            <View style={styles.header}>
              <View style={[styles.avatarWrap, abitante.razza !== "Golem" && styles.avatarWrapLpc]}>
                {abitante.razza !== "Golem" ? (
                  <AbitanteLpcAvatar abitante={abitante} size={64} />
                ) : (
                  <Text style={styles.avatarEmoji}>{emojiDisplay}</Text>
                )}
              </View>
              <View style={styles.headerText}>
                <Text style={styles.title}>{abitante.nome}</Text>
                <View style={styles.lavoroBadge}>
                  <Text style={styles.lavoroBadgeText}>💼 {lavoroDisplay}</Text>
                </View>
                <Text style={styles.identita}>{abitante.eta} anni · {abitante.razza ?? "Umano"} · {casta}</Text>
                {azioneCorrente && focusId === abitanteIniziale?.id ? (
                  <Text style={styles.azioneCorrente}>{azioneCorrente}</Text>
                ) : null}
              </View>
            </View>
            {onIndividua ? (
              <Pressable
                style={({ pressed }) => [styles.individuaBtn, pressed && styles.individuaBtnPressed]}
                onPress={() => onIndividua(abitante.id)}
                accessibilityRole="button"
                accessibilityLabel="Individua il personaggio sulla mappa"
              >
                <Text style={styles.individuaBtnText}>📍 Individua sulla mappa</Text>
              </Pressable>
            ) : null}

            <View style={styles.sixCol}>
              <Block width={cardWidth} title="Bisogni">
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

              <Block width={cardWidth} title="📋 Anagrafica">
                <Row emoji="🎂" label="Età" value={`${abitante.eta} anni`} />
                <Row
                  emoji="🧝"
                  label="Razza"
                  value={abitante.razza ?? "Umano"}
                  onPress={() => apriPagina("/razze")}
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
                <Row emoji="⚔️" label="Fazioni" value={abitante.fazioni?.join(", ") ?? "—"} />
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

              <Block width={cardWidth} title="📊 Prestazioni & Salute">
                <Row
                  emoji={getEmojiSpecializzazione(getSpecializzazioneAbitante(abitante))}
                  label="Specializzazione"
                  value={getSpecializzazioneAbitante(abitante)}
                />
                <Row emoji="⚡" label="Produttività" value={`${produttivitàEff}%${produttivitàEff !== abitante.produttività ? ` (base ${abitante.produttività})` : ""}`} />
                <Row emoji="😴" label="Stanchezza" value={`${abitante.stanchezza}%`} />
                <Row emoji="⚖️" label="Peso" value={abitante.razza === "Golem" ? "—" : `${abitante.peso ?? 50}`} />
                <Row emoji="🏥" label="Salute" value={abitante.razza === "Golem" ? "—" : getStatoSalute(abitante)} />
              </Block>

              <Block width={cardWidth} title="👥 Relazioni">
                {abitante.razza === "Golem" ? (
                  <Row emoji="—" value="—" muted />
                ) : (
                  <>
                    <Row emoji="😊" label="Amici" value={abitante.amici?.length ? abitante.amici.map((r) => getAbitanteNome(r.id)).join(", ") : "nessuno"} muted={!abitante.amici?.length} />
                    <Row emoji="😠" label="Rivali" value={abitante.rivali?.length ? abitante.rivali.map((r) => getAbitanteNome(r.id)).join(", ") : "nessuno"} muted={!abitante.rivali?.length} />
                  </>
                )}
              </Block>

              <Block width={cardWidth} title="👨‍👩‍👧 Famiglia">
                {abitante.razza === "Golem" ? (
                  <Row emoji="—" value="—" muted />
                ) : (
                  <>
                    <Row emoji="💍" label="Coniuge" value={abitante.coniugeId != null ? getAbitanteNome(abitante.coniugeId) : "—"} muted={abitante.coniugeId == null} />
                    <Row emoji="👶" label="Figli" value={(abitante.figliIds?.length ?? 0) > 0 ? (abitante.figliIds ?? []).map(getAbitanteNome).join(", ") : "—"} muted={!(abitante.figliIds?.length ?? 0)} />
                    <Pressable
                      style={({ pressed }) => [styles.famigliaBtn, pressed && styles.famigliaBtnPressed]}
                      onPress={() => setMostraFamiglia(true)}
                    >
                      <Text style={styles.famigliaBtnText}>Dettagli e albero genealogico</Text>
                    </Pressable>
                  </>
                )}
              </Block>

              <Block width={cardWidth} title="❤️ Sentimenti">
                <Row emoji="❤️" label="Lealtà" value={abitante.razza === "Golem" ? "—" : `${abitante.lealtà}%`} />
                <Row emoji="😨" label="Paura" value={abitante.razza === "Golem" ? "—" : `${abitante.paura}%`} />
                <Row
                  emoji="😊"
                  label="Felicità"
                  value={
                    abitante.razza === "Golem"
                      ? "—"
                      : `${felicitàModificata}%${felicitàCambiata ? ` (base ${abitante.felicità})` : ""}`
                  }
                />
              </Block>

              {!isCastaCoercibile(casta) && (
                <Block width={cardWidth} title="Inventario">
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
                      Corona compra ({PREZZO_SCHIAVO_DEFAULT} 💰)
                    </Text>
                  </Pressable>
                )}
                {puoUccidereColonia && (
                  <Pressable
                    style={[styles.azioneBtn, styles.azioneBtnPericolo]}
                    onPress={() => uccidiSchiavo(null, abitante.id)}
                  >
                    <Text style={styles.azioneBtnTextPericolo}>Corona uccide (senza reato)</Text>
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

          </ScrollView>
          <View style={styles.footer}>
            <Pressable style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]} onPress={onClose} accessibilityRole="button">
              <Text style={styles.closeBtnText}>Chiudi</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      <FamigliaDettaglioModal
        visible={mostraFamiglia}
        onClose={() => setMostraFamiglia(false)}
        abitante={abitante}
        abitanti={abitanti}
        onSelezionaAbitante={apriFamiliare}
        onApriAlbero={() => {
          setMostraFamiglia(false);
          setMostraAlbero(true);
        }}
      />

      <FamigliaAlberoModal
        visible={mostraAlbero}
        onClose={() => setMostraAlbero(false)}
        focusId={abitante.id}
        abitanti={abitanti}
        onSelezionaAbitante={apriFamiliare}
      />

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
  screen: { flex: 1, backgroundColor: "#0b1629" },
  topBar: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#0f203a",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(250,204,21,0.25)"
  },
  topBarTitle: { fontSize: 20, fontWeight: "800", color: "#f8fafc", textAlign: "center" },
  contentScroll: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 28, width: "100%", maxWidth: 1600, alignSelf: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#12243e",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.3)"
  },
  avatarWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "#223651",
    borderWidth: 2, borderColor: "#b8944d",
    alignItems: "center", justifyContent: "center", marginRight: 14
  },
  avatarWrapLpc: { overflow: "visible" },
  avatarEmoji: { fontSize: 38 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 23, lineHeight: 28, fontWeight: "800", color: "#f8fafc", flexShrink: 1 },
  identita: { fontSize: 13, lineHeight: 20, marginTop: 8, color: "#94a3b8", flexWrap: "wrap" },
  azioneCorrente: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: "#86efac", marginTop: 8 },
  lavoroBadge: {
    alignSelf: "flex-start", marginTop: 8,
    backgroundColor: "#1e3a60", paddingVertical: 5, paddingHorizontal: 11, borderRadius: 20
  },
  lavoroBadgeText: { fontSize: 14, fontWeight: "700", color: "#bfdbfe" },
  individuaBtn: {
    alignSelf: "flex-start", marginTop: 12, paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 11, backgroundColor: "#3b311e",
    borderWidth: 1, borderColor: "#d6aa45", minHeight: 46, justifyContent: "center"
  },
  individuaBtnPressed: { backgroundColor: "#594621" },
  individuaBtnText: { fontSize: 14, fontWeight: "800", color: "#fde68a" },
  sixCol: {
    flexDirection: "row", flexWrap: "wrap",
    alignItems: "flex-start", justifyContent: "space-between",
    columnGap: 10, rowGap: 12, marginTop: 16
  },
  block: {
    flexGrow: 0, flexShrink: 0,
    backgroundColor: "#12243e", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(96,165,250,0.22)", overflow: "hidden"
  },
  blockTitle: {
    fontSize: 17, fontWeight: "800", color: "#f8fafc",
    paddingVertical: 13, paddingHorizontal: 15,
    backgroundColor: "#1b304c",
    borderBottomWidth: 1, borderBottomColor: "rgba(148,163,184,0.16)"
  },
  blockContent: { paddingHorizontal: 15, paddingVertical: 6 },
  bisognoRow: { paddingVertical: 10, gap: 7 },
  bisognoMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  bisognoLabel: { flexShrink: 1, fontSize: 15, lineHeight: 21, color: "#e2e8f0", fontWeight: "600" },
  bisognoValue: { fontSize: 14, color: "#cbd5e1", fontWeight: "700", textAlign: "right" },
  bisognoTrack: { width: "100%", height: 11, borderRadius: 6, backgroundColor: "#334155", overflow: "hidden" },
  bisognoFill: { height: "100%", borderRadius: 6 },
  rowWrap: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(148,163,184,0.13)"
  },
  rowPressable: { borderRadius: 7, paddingHorizontal: 5, marginHorizontal: -5 },
  rowPressed: { backgroundColor: "rgba(59,130,246,0.15)" },
  rowEmoji: { width: 29, fontSize: 21, lineHeight: 29, textAlign: "center" },
  rowTextCol: { flex: 1, minWidth: 0 },
  rowLabel: {
    fontSize: 12, fontWeight: "700", color: "#94a3b8",
    marginBottom: 3
  },
  rowValue: { fontSize: 15, lineHeight: 22, color: "#e2e8f0", flexWrap: "wrap" },
  rowValueLink: { color: "#93c5fd", fontWeight: "600", textDecorationLine: "underline" },
  rowValueDisoccupato: { color: "#f87171", fontWeight: "700" },
  rowValueDisoccupatoLink: { color: "#f87171", fontWeight: "700", textDecorationLine: "underline" },
  rowMuted: { color: "#94a3b8", fontStyle: "italic" },
  famigliaBtn: {
    marginTop: 10, marginBottom: 8, minHeight: 44,
    paddingVertical: 10, paddingHorizontal: 10, borderRadius: 9,
    backgroundColor: "rgba(56,189,248,0.13)", borderWidth: 1,
    borderColor: "rgba(56,189,248,0.4)", alignItems: "center", justifyContent: "center"
  },
  famigliaBtnPressed: { backgroundColor: "rgba(56,189,248,0.24)" },
  famigliaBtnText: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: "#7dd3fc", textAlign: "center" },
  inventarioCategoria: { marginBottom: 12, marginTop: 6 },
  inventarioCategoriaTitolo: {
    fontSize: 12, fontWeight: "800", color: "#94a3b8",
    marginBottom: 9, textTransform: "uppercase", letterSpacing: 0.4
  },
  inventarioGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  inventarioSlot: {
    minWidth: 92, flexBasis: "28%", flexGrow: 1, maxWidth: 180,
    alignItems: "center", paddingVertical: 13, paddingHorizontal: 8,
    backgroundColor: "#20324c", borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(148,163,184,0.2)"
  },
  inventarioEmoji: { fontSize: 30, lineHeight: 38 },
  inventarioNome: { fontSize: 13, lineHeight: 19, color: "#cbd5e1", marginTop: 5, textAlign: "center" },
  inventarioQty: { marginTop: 5, fontSize: 18, fontWeight: "800", color: "#f8fafc" },
  azioniSchiavo: {
    marginTop: 18, padding: 15, backgroundColor: "#1e293b",
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(248,113,113,0.3)", gap: 10
  },
  azioniSchiavoTitolo: { color: "#e2e8f0", fontSize: 15, fontWeight: "800" },
  azioneBtn: {
    minHeight: 44, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: "rgba(59,130,246,0.25)", borderRadius: 8,
    borderWidth: 1, borderColor: "rgba(59,130,246,0.4)", justifyContent: "center"
  },
  azioneBtnPericolo: { backgroundColor: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.4)" },
  azioneBtnText: { color: "#93c5fd", fontSize: 14, fontWeight: "700", textAlign: "center" },
  azioneBtnTextPericolo: { color: "#fca5a5", fontSize: 14, fontWeight: "700", textAlign: "center" },
  footer: {
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#0f203a",
    borderTopWidth: 1, borderTopColor: "rgba(148,163,184,0.22)"
  },
  closeBtn: {
    minHeight: 52, backgroundColor: "#3276df", borderRadius: 12,
    justifyContent: "center", alignItems: "center"
  },
  closeBtnPressed: { backgroundColor: "#2563b9" },
  closeBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" }
});
