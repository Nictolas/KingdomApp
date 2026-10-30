import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, ReactNode } from "react";
import { usePathname } from "expo-router";
import { Alert, AppState } from "react-native";
import { useGameState } from "../hooks/useGameState";
import type { Abitante, Risorsa, Edificio, OrdineMercato, EventoInCorso, Razza } from "../types";
import type { EventoDef } from "../game/eventi";
import { DialogInizioPartitaModal } from "../ui/DialogInizioPartitaModal";
import { CreazioneGiocatoreModal, type DatiCreazioneGiocatore } from "../ui/CreazioneGiocatoreModal";
import { ConsigliereIntroModal } from "../ui/ConsigliereIntroModal";
import { TutorialSpotlightProvider, useTutorialSpotlight } from "../tutorial/TutorialSpotlightContext";
import { TutorialSpotlightOverlay } from "../tutorial/TutorialSpotlightOverlay";
import { SPOTLIGHT_TARGET_IDS } from "../tutorial/spotlightTypes";
import { RichiestaLuogoCultoModal } from "../ui/RichiestaLuogoCultoModal";
import type { ReligioneConCulto } from "../game/luogoCulto";
import type { RichiestaInAttesa } from "../game/richieste";
import type { PenaReatiConfig, ReatoPunibile } from "../game/reati";
import type { RisultatoGiudizio } from "../game/tribunale";
import type { GamePhase } from "../game/gamePhase";
import type { GameMode } from "../game/gameMode";
import type { ModalitaRe, FaseDisordine } from "../game/reModalita";
import { getMappaSessione, subscribeMappaSessione } from "../game/mappaSessione";
import { createAsyncStoragePersistentStorage } from "../persistence/asyncStorageAdapter";
import { gameSaveV1ToGameState, gameStateToGameSaveV1 } from "../persistence/gameStateMapping";
import { SaveRepository, type LoadSaveResult } from "../persistence/saveRepository";
import { SAVE_FORMAT, SAVE_SCHEMA_VERSION, type SaveEnvelopeV1 } from "../persistence/saveTypes";
import { decideStartup, shouldAutosave, shouldConfirmNewGame } from "../persistence/saveRuntimePolicy";
import { StartGameScreen } from "../ui/StartGameScreen";
import { GameModeSelectionScreen } from "../ui/GameModeSelectionScreen";
import { SectorPlayableScreen } from "../ui/SectorPlayableScreen";
import { ProfessionOutfitEditorScreen } from "../ui/ProfessionOutfitEditorScreen";
import { loadProfessionUniforms } from "../game/professionOutfitTemplates";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GameOverModal } from "../ui/GameOverModal";
import { ID_GIOCATORE } from "../game/schiavituCommercio";
import { setOrologioGiocoBloccatoDallaFase } from "../game/orologioGiocoSession";
import type { RegistrazioneScambio } from "../game/registrazioniScambi";
import { warmStartupCharacterAssets } from "../game/warmStartupCharacters";

type ScaglioneConfig = {
  min: number;
  max: number;
  percentuale: number;
};

type GameContextType = {
  gameMode: GameMode;
  /** Alias UI legacy: stessa modalità di gameMode. */
  modalitaGioco: "creativa" | "avventura";
  /** Id degli obiettivi completati; usato dalla futura schermata Obiettivi. */
  obiettiviCompletati: string[];
  /** Colture disponibili nelle Serre; in Avventura vengono sbloccate dagli obiettivi. */
  coltureSerraSbloccate: string[];
  gamePhase: GamePhase;
  simulationEnabled: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  salvaPartita: () => Promise<void>;
  abitanti: Abitante[];
  /** Inventario cibo del giocatore (colonia). */
  inventarioGiocatore: { itemId: string; quantità: number }[];
  /** Tesoro del giocatore (monete per stipendi edifici pubblici). */
  moneteGiocatore: number;
  /** Scorte cibo per edificio Mensa Pubblica (chiave = id edificio). */
  inventarioMensaByEdificioId: Record<number, { itemId: string; quantità: number }[]>;
  /** Scorte alimentari per edificio Emporio. */
  inventarioEmporioByEdificioId: Record<number, { itemId: string; quantità: number }[]>;
  risorse: Risorsa[];
  edifici: Edificio[];
  mese: number;
  anno: number;
  isLoading: boolean;
  razzaNativi: Razza;
  abitantiProposti: Abitante[];
  tipoTassaReddito: "flat" | "scaglioni";
  flatTaxPercentuale: number;
  scaglioniConfig: ScaglioneConfig[];
  tassaPatrimonioPercentuale: number;
  ivaPercentuale: number;
  politicaNascite: "figlio-unico" | "incentivi" | "nessuna";
  punteggioSanzioni: number;
  penaDiMorteAttiva: boolean;
  politicaReligiosa: "ateismo-stato" | "religione-stato" | "liberta-culto";
  leggeRazzialeAttiva: boolean;
  razzaCampoLavoro: Razza | null;
  razzaCampoSterminio: Razza | null;
  capoReligiosoSole: number | null;
  capoReligiosoOmbre: number | null;
  religioneDiStato: "Ateo" | "Deista" | "Agnostico" | "Culto del Sole" | "Culto delle Ombre" | string | null;
  religioniCustom: import("../game/fedeleCulto").ReligioneCustom[];
  creaReligioneCustom: (input: {
    nome: string;
    emoji?: string;
    descrizione?: string;
    aspettoSacerdote?: import("../game/personaggioAspetto").AspettoPersonaggio;
  }) =>
    | { ok: true; religione: import("../game/fedeleCulto").ReligioneCustom }
    | { ok: false; errore: string };
  etaMinimaLavoro: number;
  etaPensionabile: number;
  assegnoPensionati: number;
  leggeDroghe: "vietate" | "legali" | "parziali";
  nudismoAttivo: boolean;
  divietoEspatrioAttivo: boolean;
  iusPrimaeNoctisAttivo: boolean;
  /** Coprifuoco: divieto di stare «In giro» in una fascia oraria. */
  coprifuocoAttivo: boolean;
  coprifuocoInizioMinuti: number;
  coprifuocoFineMinuti: number;
  tipologieFamigliaAccettate: {
    tradizionale: boolean;
    interrazziale: boolean;
    arcobaleno: boolean;
    monogenitoriale: boolean;
    matrimonioConGolem: boolean;
    matrimonioIntercasta: boolean;
  };
  /** Modalità del sistema sanitario: influisce sui costi dell'Ospedale. */
  modalitaSanita: "privata" | "pubblica";
  calcolaFelicitàModificata: (abitante: Abitante) => number;
  setTipoTassaReddito: (tipo: "flat" | "scaglioni") => void;
  setFlatTaxPercentuale: (percentuale: number) => void;
  setScaglioniConfig: (config: ScaglioneConfig[]) => void;
  setTassaPatrimonioPercentuale: (percentuale: number) => void;
  setIvaPercentuale: (percentuale: number) => void;
  setPoliticaNascite: (politica: "figlio-unico" | "incentivi" | "nessuna") => void;
  setPenaDiMorteAttiva: (attiva: boolean) => void;
  setPoliticaReligiosa: (politica: "ateismo-stato" | "religione-stato" | "liberta-culto") => void;
  setReligioneDiStato: (religione: "Ateo" | "Deista" | "Agnostico" | "Culto del Sole" | "Culto delle Ombre" | string | null) => void;
  setLeggeRazzialeAttiva: (attiva: boolean) => void;
  setRazzaCampoLavoro: (razza: Razza | null) => void;
  setRazzaCampoSterminio: (razza: Razza | null) => void;
  setCapoReligiosoSole: (id: number | null) => void;
  setCapoReligiosoOmbre: (id: number | null) => void;
  setEtaMinimaLavoro: (eta: number) => void;
  setEtaPensionabile: (eta: number) => void;
  setAssegnoPensionati: (importo: number) => void;
  setLeggeDroghe: (legge: "vietate" | "legali" | "parziali") => void;
  setNudismoAttivo: (attivo: boolean) => void;
  setDivietoEspatrioAttivo: (attivo: boolean) => void;
  setIusPrimaeNoctisAttivo: (attivo: boolean) => void;
  setCoprifuocoAttivo: (attivo: boolean) => void;
  setCoprifuocoInizioMinuti: (minuti: number) => void;
  setCoprifuocoFineMinuti: (minuti: number) => void;
  setTipologieFamigliaAccettate: (tipologie: {
    tradizionale: boolean;
    interrazziale: boolean;
    arcobaleno: boolean;
    monogenitoriale: boolean;
    matrimonioConGolem: boolean;
    matrimonioIntercasta: boolean;
  }) => void;
  /** Importo mensile del Reddito di Cittadinanza per ogni disoccupato non schiavo. */
  redditoCittadinanza: number;
  setRedditoCittadinanza: (importo: number) => void;
  /** Imposta la modalità del sistema sanitario (Privata/Pubblica). */
  setModalitaSanita: (modalita: "privata" | "pubblica") => void;
  assegnaAbitanteAEdificio: (abitanteId: number, edificioId: number) => void;
  rimuoviAbitanteDaEdificio: (abitanteId: number, edificioId: number) => void;
  setStipendioEdificio: (edificioId: number, stipendioPerLavoratore: number) => void;
  setColturaSerra: (edificioId: number, colturaItemId: string) => void;
  /** Aggiunge un edificio reale (istanza con id nuovo) dal catalogo; restituisce l'id creato o null. */
  aggiungiEdificioDaTemplate: (
    templateId: number,
    options?: { costoMateriale?: number; costoMonete?: number; stato?: Edificio["stato"] }
  ) => number | null;
  rimuoviEdificioPerId: (id: number) => void;
  /** Prezzo mensile (monete) per tipo di residenza. Chiave = nome residenza (es. "Baracca"). Se assente si usa il default del catalogo. */
  prezzoResidenze: Record<string, number>;
  setPrezzoResidenza: (nomeResidenza: string, prezzo: number) => void;
  aggiungiAlCampoDiLavoroTuttiQuelliChe: (filtro: {
    personalità?: string;
    razza?: string;
    religione?: string;
  }) => void;
  /** Assegna un Servo della gleba a un edificio con posto libero (assegnazione coattiva del giocatore). */
  assegnaServoDellaGlebaAEdificio: (abitanteId: number, edificioId: number) => void;
  /** Cittadino disoccupato assunto autonomamente in un edificio pubblico (es. mappa). */
  assumiCittadinoDisoccupatoAEdificio: (abitanteId: number, edificioId: number) => boolean;
  /** Ricolloca i lavoratori la cui sede non è fisicamente raggiungibile. */
  ricollocaLavoroIrraggiungibileDaMappa: (
    richieste: { abitanteId: number; fromCell: number }[],
    edificiInMappa: Record<
      number,
      { id: number; nome: string; edificioGlobaleId?: number; footprintRef?: number; footprint?: { w: number; h: number } }
    >,
    cols: number,
    rows: number,
    isWalkable: (i: number) => boolean
  ) => Record<number, { path: number[] | null; nuovoEdificioId?: number }>;
  /** Primo entrante idoneo assunto come Barista se il Bar è vuoto. */
  provaAssumiBaristaBarVuotoDaMappa: (abitanteId: number, barEdificioId: number) => boolean;
  /** Accredita un incasso alla cassa privata di un'impresa. */
  incassaImpresa: (edificioId: number, monete: number) => void;
  /** Paga stipendio fisso e distribuisce le mance ai Baristi in servizio. */
  applicaPagaETipBarFineTurno: (baristiInServizioByBar: Record<number, number[]>) => void;
  /** Compra/vende/trasferisce uno schiavo. `nuovoProprietarioId: null` = colonia. Restituisce true se riuscito. */
  trasferisciProprietaSchiavo: (schiavoId: number, nuovoProprietarioId: number | null, prezzo?: number) => boolean;
  /** Uccide uno schiavo di proprietà (`uccisoreId: null` = colonia). Senza conseguenze legali. */
  uccidiSchiavo: (uccisoreId: number | null, schiavoId: number) => boolean;
  nominaMinistro: (abitanteId: number, ministero: string) => void;
  rimuoviMinistro: (abitanteId: number) => void;
  setNomeAbitante: (abitanteId: number, nuovoNome: string) => void;
  /** Aggiorna un abitante (es. effetti bisogni da mappa). */
  aggiornaAbitanteById: (abitanteId: number, fn: (a: Abitante) => Abitante) => void;
  /** Aggiorna un edificio senza sostituire il resto della lista. */
  aggiornaEdificioById: (edificioId: number, fn: (e: Edificio) => Edificio) => void;
  /** Esito sociale di una chiacchiera «in giro» (amici/rivali, simmetrico). */
  applicaEsitoChiacchieraAbitanti: (idA: number, idB: number) => void;
  /** Adotta un abitante senza genitori vivi. */
  adottaFiglio: (genitoreId: number, figlioId: number) => boolean;
  /** Accredita monete al tesoro del giocatore (es. pagamenti bar/negozio). */
  accreditaMoneteGiocatore: (quantità: number) => void;
  /** Appende una riga al diario (avvisi soft). */
  appendDiarioRiga: (riga: string) => void;
  /** Esegue il prelievo forzoso e accredita il gettito al Tesoro. */
  eseguiPrelievoForzosoRe: (importoPerAbitante: number) => { gettito: number; soggettiColpiti: number };
  /** Aggiorna scorte cibo di una Mensa Pubblica. */
  setInventarioMensaEdificio: (
    edificioId: number,
    inventario: { itemId: string; quantità: number }[]
  ) => void;
  setAbitanteIncinta: (abitanteId: number, incinta: boolean) => void;
  serviPastoMensaAbitante: (abitanteId: number, edificioId: number) => void;
  trasferisciCiboGiocatoreAMensa: (edificioId: number, itemId: string, quantità: number) => boolean;
  calcolaProduzioneConsumo: () => Record<string, number>;
  accettaImmigrante: (abitanteId: number) => void;
  rifiutaImmigrante: (abitanteId: number) => void;
  ordiniMercato: OrdineMercato[];
  aggiungiOrdineMercato: (tipo: "compra" | "vendi", risorsaId: number, quantità: number, prezzoUnitario: number) => boolean;
  rimuoviOrdineMercato: (ordineId: number) => void;
  calcolaDeltaOrdiniMercato: () => Record<string, number>;
  /** Delta Tesoro previsto dagli ordini di mercato in coda. */
  calcolaDeltaTesoroMercato: () => number;
  graziaCriminale: (abitanteId: number) => void;
  condannaAMorte: (abitanteId: number) => void;
  penaReati: PenaReatiConfig;
  setPenaReato: (reato: ReatoPunibile, anni: number) => void;
  faiDecidereAlGiudice: (abitanteId: number) => RisultatoGiudizio;
  condannaLavoriForzati: (abitanteId: number) => { ok: boolean; messaggio: string };
  soddisfazioneFazioni: Record<string, number>;
  modificaSoddisfazioneFazione: (fazione: string, delta: number) => void;
  modalitaRe: ModalitaRe;
  edificioVisitaReId: number | null;
  popolaritaRe: number;
  faseDisordine: FaseDisordine;
  mesiConsecutiviNelCastello: number;
  setModalitaRe: (modalita: ModalitaRe, edificioId?: number | null) => void;
  nominaConsigliere: (abitanteId: number) => void;
  nativiNonIntegrati: number;
  pendingAssimilazione: number | null;
  accettaAssimilazione: () => void;
  rifiutaAssimilazione: () => void;
  pendingMatrimonio: { idA: number; idB: number; nomeA: string; nomeB: string } | null;
  confermaMatrimonio: (idA: number, idB: number) => void;
  rifiutaMatrimonio: () => void;
  eventiInCorso: EventoInCorso[];
  eventiCatalogo: EventoDef[];
  creazioneGiocatoreAperta: boolean;
  configuraGiocatore: (dati: DatiCreazioneGiocatore) => void;
  introConsigliereAperta: boolean;
  chiudiIntroConsigliere: () => void;
  suggerimentoPonteAperto: boolean;
  chiudiSuggerimentoPonte: () => void;
  dialogPiazzaPonteAperto: boolean;
  apriDialogPiazzaPonte: () => void;
  chiudiDialogPiazzaPonte: () => void;
  diarioInizioVisto: boolean;
  messaggioEmigrazione: string | null;
  chiudiMessaggioEmigrazione: () => void;
  diarioRighe: string[];
  registrazioniScambi: RegistrazioneScambio[];
  registraScambioCommerciale: (
    voce: Omit<RegistrazioneScambio, "id" | "giorno" | "minutiDaMezzanotte"> & { id?: string }
  ) => void;
  pendingRichiestaLuogoCulto: { id: number; nome: string; religione: ReligioneConCulto } | null;
  accettaRichiestaLuogoCulto: () => void;
  rifiutaRichiestaLuogoCulto: () => void;
  rimandaRichiestaLuogoCulto: () => void;
  richiesteInAttesa: RichiestaInAttesa[];
  accettaRichiestaInAttesa: (richiestaId: string) => void;
  rifiutaRichiestaInAttesa: (richiestaId: string) => void;
  luoghiCultoRifiutati: ReligioneConCulto[];
  luoghiCultoPendentiMappa: { religione: ReligioneConCulto; edificioGlobaleId: number }[];
  setLuoghiCultoPendentiMappa: React.Dispatch<
    React.SetStateAction<{ religione: ReligioneConCulto; edificioGlobaleId: number }[]>
  >;
};

const GameContext = createContext<GameContextType | undefined>(undefined);

function CreazioneGiocatoreWrapper() {
  const { creazioneGiocatoreAperta, configuraGiocatore } = useGameContext();
  const pathname = usePathname();
  return (
    <CreazioneGiocatoreModal
      visible={creazioneGiocatoreAperta && pathname !== "/mappa-phaser-preview"}
      onConferma={configuraGiocatore}
    />
  );
}

function IntroConsigliereDialogWrapper() {
  const {
    introConsigliereAperta,
    chiudiIntroConsigliere,
    suggerimentoPonteAperto,
    chiudiSuggerimentoPonte,
    dialogPiazzaPonteAperto,
    chiudiDialogPiazzaPonte,
    abitanti
  } = useGameContext();
  const re = abitanti.find((a) => a.id === ID_GIOCATORE);
  const consigliere = abitanti.find((a) => a.lavoro === "Consigliere" && a.id !== ID_GIOCATORE);
  const nomeCompletoRe = re?.nome?.trim() && re.nome !== "—" ? re.nome.trim() : "Sovrano";
  const nomeRe = nomeCompletoRe.split(/\s+/)[0] || nomeCompletoRe;
  const nomeConsigliere = consigliere?.nome?.trim() || "il tuo Consigliere";
  const messaggio =
    `Benvenuto Re ${nomeRe}. Io sono ${nomeConsigliere}, il tuo Consigliere. ` +
    "Dato che hai succeduto tuo padre alla tenera età di 10 anni, ora ti aiuterò a imparare a guidare il tuo Regno!";
  const messaggioPonte =
    "Un fiume separa il nostro Regno, mio Re.\nPer unire le sponde piazzeremo un cantiere sul fiume: gli Edili dell'Ufficio Edile lo completeranno ora dopo ora.";
  const messaggioPiazzaPonte =
    "Ben fatto mio Re!\nScegli il punto sul fiume: nascerà un cantiere con barra di avanzamento.\nAssumi Edili nell'Ufficio Edile: ogni ora avanzano di 1 punto a testa!";
  const { showSpotlight } = useTutorialSpotlight();

  const onChiudiSuggerimentoPonte = () => {
    chiudiSuggerimentoPonte();
    showSpotlight({ targetId: SPOTLIGHT_TARGET_IDS.MAPPA_COSTRUISCI, padding: 10 });
  };

  return (
    <>
      <ConsigliereIntroModal
        visible={introConsigliereAperta}
        consigliere={consigliere}
        messaggio={messaggio}
        onClose={chiudiIntroConsigliere}
      />
      <ConsigliereIntroModal
        visible={suggerimentoPonteAperto}
        consigliere={consigliere}
        messaggio={messaggioPonte}
        onClose={onChiudiSuggerimentoPonte}
      />
      <ConsigliereIntroModal
        visible={dialogPiazzaPonteAperto}
        consigliere={consigliere}
        messaggio={messaggioPiazzaPonte}
        onClose={chiudiDialogPiazzaPonte}
      />
    </>
  );
}

function EmigrazioneDialogWrapper() {
  const { messaggioEmigrazione, chiudiMessaggioEmigrazione, simulationEnabled } = useGameContext();
  return (
    <DialogInizioPartitaModal
      visible={simulationEnabled && !!messaggioEmigrazione}
      titolo="Emigrazione"
      messaggio={messaggioEmigrazione ?? ""}
      onClose={chiudiMessaggioEmigrazione}
      emoji="✈️"
    />
  );
}

function RichiestaLuogoCultoDialogWrapper() {
  const {
    pendingRichiestaLuogoCulto,
    diarioInizioVisto,
    simulationEnabled,
    accettaRichiestaLuogoCulto,
    rifiutaRichiestaLuogoCulto,
    rimandaRichiestaLuogoCulto
  } = useGameContext();
  return (
    <RichiestaLuogoCultoModal
      visible={simulationEnabled && diarioInizioVisto && pendingRichiestaLuogoCulto != null}
      nomeCapo={pendingRichiestaLuogoCulto?.nome ?? ""}
      religione={pendingRichiestaLuogoCulto?.religione ?? "Culto del Sole"}
      onAccetta={accettaRichiestaLuogoCulto}
      onRifiuta={rifiutaRichiestaLuogoCulto}
      onRimanda={rimandaRichiestaLuogoCulto}
    />
  );
}

export function GameProvider({ children }: { children: ReactNode }) {
  const gameState = useGameState();
  const mappa = useSyncExternalStore(subscribeMappaSessione, getMappaSessione, getMappaSessione);
  const repositoryRef = useRef<SaveRepository | null>(null);
  const pendingLoadRef = useRef<LoadSaveResult | null>(null);
  const metadataRef = useRef<SaveEnvelopeV1["metadata"] | null>(null);
  const latestStateRef = useRef(gameState);
  latestStateRef.current = gameState;
  const [startup, setStartup] = useState<"loading" | "choice" | "mode-choice" | "sector-play" | "outfit-editor" | "active">("loading");
  const editorReturnRef=useRef<"choice"|"mode-choice">("choice");
  const [startupError, setStartupError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirtyRef = useRef(false);
  const dirtyTrackingInitializedRef = useRef(false);
  const lastPersistableStateTokenRef = useRef<typeof gameState.createPersistableState | null>(null);
  const lastMapTokenRef = useRef<typeof mappa>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const storage = await createAsyncStoragePersistentStorage();
        const repository = new SaveRepository(storage);
        repositoryRef.current = repository;
        const result = await repository.loadBestAvailable();
        if (cancelled) return;
        pendingLoadRef.current = result;

        // Le divise hanno una chiave separata dai salvataggi; un archivio danneggiato
        // non deve impedire di aprire la partita e non va sovrascritto in automatico.
        try { await loadProfessionUniforms(AsyncStorage); } catch { /* editor shows recovery UI */ }

        // Precarica gli sprite LPC del Re e del Consigliere prima della schermata iniziale.
        try {
          const abitantiDaScaldare =
            result.source === "none"
              ? gameState.abitanti
              : gameSaveV1ToGameState(result.save.payload).abitanti;
          await warmStartupCharacterAssets(abitantiDaScaldare);
        } catch {
          // Il preload è un'ottimizzazione: non deve impedire l'avvio della partita.
        }
        if (cancelled) return;

        if (decideStartup(result) === "start-new") {
          setStartup("mode-choice");
        } else {
          setStartup("choice");
        }
      } catch {
        if (cancelled) return;
        setStartupError("Salvataggio non disponibile. La partita può continuare senza persistenza.");
        setSaveStatus("error");
        pendingLoadRef.current = { source: "none", save: null };
        setStartup("mode-choice");
      }
    })();
    return () => { cancelled = true; };
    // Bootstrap una sola volta: lo stato iniziale non deve mai avviare scritture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const continua = useCallback(() => {
    const loaded = pendingLoadRef.current;
    if (!loaded || loaded.source === "none") return;
    metadataRef.current = loaded.save.metadata;
    gameState.restorePersistableState(gameSaveV1ToGameState(loaded.save.payload));
    dirtyTrackingInitializedRef.current = false;
    lastPersistableStateTokenRef.current = null;
    lastMapTokenRef.current = null;
    dirtyRef.current = false;
    setStartup("active");
    if (loaded.source === "backup") Alert.alert("Backup ripristinato", "Il salvataggio principale non era disponibile. È stato caricato il backup.");
  }, [gameState]);

  const nuovaPartita = useCallback(() => {
    setStartupError(null);
    setStartup("mode-choice");
  }, []);

  const avviaNuovaPartita = useCallback((mode: GameMode) => {
    void (async () => {
      try {
        await repositoryRef.current?.clearAll();
      } catch {
        setStartupError("Non è stato possibile eliminare il vecchio salvataggio.");
        return;
      }
      pendingLoadRef.current = null;
      metadataRef.current = null;
      dirtyTrackingInitializedRef.current = false;
      lastPersistableStateTokenRef.current = null;
      lastMapTokenRef.current = null;
      dirtyRef.current = true;
      gameState.startNewGame(mode);
      setStartup("active");
    })();
  }, [gameState]);

  const apriEditorDivise=useCallback(()=>{
    if(startup!=="choice" && startup!=="mode-choice")return;
    editorReturnRef.current=startup;
    setStartup("outfit-editor");
  },[startup]);

  // Separate local demo: never clear or overwrite the main game's save.
  const provaSettori = useCallback(() => {
    setStartupError(null);
    setStartup("sector-play");
  }, []);

  const annullaSceltaModalita = useCallback(() => {
    const loaded = pendingLoadRef.current;
    if (loaded && loaded.source !== "none") {
      setStartup("choice");
    }
  }, []);

  const salvaPartita = useCallback(async () => {
    const repository = repositoryRef.current;
    const currentMap = getMappaSessione();
    const state = latestStateRef.current;
    if (!repository || !currentMap || !state.simulationEnabled) return;
    const savedStateToken = state.createPersistableState;
    const savedMapToken = currentMap;
    setSaveStatus("saving");
    try {
      const now = new Date().toISOString();
      const metadata = metadataRef.current ?? {
        saveId: `save-${Date.now()}`,
        gameVersion: "0.1.0",
        createdAt: now,
        updatedAt: now
      };
      const envelope: SaveEnvelopeV1 = {
        format: SAVE_FORMAT,
        schemaVersion: SAVE_SCHEMA_VERSION,
        metadata: { ...metadata, updatedAt: now },
        payload: gameStateToGameSaveV1(state.createPersistableState(currentMap))
      };
      await repository.save(envelope);
      metadataRef.current = envelope.metadata;
      // Se qualcosa è cambiato mentre la scrittura era in corso, deve restare dirty.
      dirtyRef.current =
        latestStateRef.current.createPersistableState !== savedStateToken ||
        getMappaSessione() !== savedMapToken;
      setSaveStatus("saved");
    } catch {
      dirtyRef.current = true;
      setSaveStatus("error");
    }
  }, []);

  useEffect(() => {
    if (startup !== "active" || !gameState.simulationEnabled || !mappa) return;

    // createPersistableState è memoizzata sulle sole parti persistite dello stato:
    // la sua identità funziona quindi come token di revisione O(1), senza serializzare
    // l'intero salvataggio ad ogni render. La mappa usa allo stesso modo il suo snapshot.
    const stateToken = gameState.createPersistableState;
    if (!dirtyTrackingInitializedRef.current) {
      dirtyTrackingInitializedRef.current = true;
      lastPersistableStateTokenRef.current = stateToken;
      lastMapTokenRef.current = mappa;
      dirtyRef.current = metadataRef.current == null;
      return;
    }

    if (lastPersistableStateTokenRef.current !== stateToken || lastMapTokenRef.current !== mappa) {
      lastPersistableStateTokenRef.current = stateToken;
      lastMapTokenRef.current = mappa;
      dirtyRef.current = true;
    }
  }, [startup, gameState.simulationEnabled, gameState.createPersistableState, mappa]);

  useEffect(() => {
    const id = setInterval(() => {
      if (shouldAutosave({ dirty: dirtyRef.current, phase: latestStateRef.current.gamePhase, startupActive: startup === "active" })) void salvaPartita();
    }, 60_000);
    return () => clearInterval(id);
  }, [salvaPartita, startup]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active" && dirtyRef.current) void salvaPartita();
    });
    const visibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden" && dirtyRef.current) void salvaPartita();
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", visibility);
    return () => {
      subscription.remove();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", visibility);
    };
  }, [salvaPartita]);


  const contextValue = { ...gameState, saveStatus, salvaPartita };
  const re = gameState.abitanti.find((abitante) => abitante.id === ID_GIOCATORE);
  const gameOverPerMorteRe =
    startup === "active" &&
    gameState.simulationEnabled &&
    re != null &&
    re.salute <= 0;

  useEffect(() => {
    if (gameOverPerMorteRe) {
      setOrologioGiocoBloccatoDallaFase(true);
    }
  }, [gameOverPerMorteRe]);

  if (startup === "outfit-editor") {
    return <ProfessionOutfitEditorScreen onExit={()=>setStartup(editorReturnRef.current)} />;
  }

  if (startup === "sector-play") {
    return <SectorPlayableScreen onExit={() => setStartup("mode-choice")} />;
  }

  if (startup === "mode-choice") {
    return (
      <GameModeSelectionScreen
        error={startupError}
        canCancel={pendingLoadRef.current != null && pendingLoadRef.current.source !== "none"}
        onSelect={avviaNuovaPartita}
        onTrySectors={provaSettori}
        onEditOutfits={apriEditorDivise}
        onCancel={annullaSceltaModalita}
      />
    );
  }

  if (startup !== "active") {
    return (
      <StartGameScreen
        loading={startup === "loading"}
        hasSave={startup === "choice"}
        error={startupError}
        confirmNewGame={shouldConfirmNewGame(pendingLoadRef.current)}
        onContinue={continua}
        onNewGame={nuovaPartita}
        onTrySectors={provaSettori}
        onEditOutfits={apriEditorDivise}
      />
    );
  }

  return (
    <GameContext.Provider value={contextValue}>
      <TutorialSpotlightProvider>
        {children}
        <CreazioneGiocatoreWrapper />
        <IntroConsigliereDialogWrapper />
        <RichiestaLuogoCultoDialogWrapper />
        <EmigrazioneDialogWrapper />
        <GameOverModal
          visible={gameOverPerMorteRe}
          description="Il Re è stato assassinato. Il regno è caduto..."
          onRestart={nuovaPartita}
        />
        <TutorialSpotlightOverlay />
      </TutorialSpotlightProvider>
    </GameContext.Provider>
  );
}

export function useGameContext() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGameContext must be used within a GameProvider");
  }
  return context;
}
