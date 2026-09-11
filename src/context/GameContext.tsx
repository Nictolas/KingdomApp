import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, ReactNode } from "react";
import { usePathname } from "expo-router";
import { Alert, AppState, View } from "react-native";
import { useGameState } from "../hooks/useGameState";
import type { Abitante, Risorsa, Edificio, OrdineMercato, EventoInCorso, Razza, Casta } from "../types";
import type { EventoDef } from "../game/eventi";
import { DialogInizioPartitaModal } from "../ui/DialogInizioPartitaModal";
import { ConsigliereIntroModal } from "../ui/ConsigliereIntroModal";
import { CreazioneGiocatoreModal, type DatiCreazioneGiocatore } from "../ui/CreazioneGiocatoreModal";
import { RichiestaLuogoCultoModal } from "../ui/RichiestaLuogoCultoModal";
import type { ReligioneConCulto } from "../game/luogoCulto";
import type { RichiestaInAttesa } from "../game/richieste";
import type { RegistrazioneScambio } from "../game/registrazioniScambi";
import type { PenaReatiConfig, ReatoPunibile } from "../game/reati";
import type { RisultatoGiudizio } from "../game/tribunale";
import type { GamePhase } from "../game/gamePhase";
import { getMappaSessione, subscribeMappaSessione } from "../game/mappaSessione";
import { resetMappaPersonaggiRuntime } from "../game/mappaPersonaggiRuntimeStore";
import { createAsyncStoragePersistentStorage } from "../persistence/asyncStorageAdapter";
import { gameSaveV1ToGameState, gameStateToGameSaveV1 } from "../persistence/gameStateMapping";
import { SaveRepository, type LoadSaveResult } from "../persistence/saveRepository";
import { SAVE_FORMAT, SAVE_SCHEMA_VERSION, type SaveEnvelopeV1 } from "../persistence/saveTypes";
import { decideStartup, runMutationThenSave, shouldAutosave } from "../persistence/saveRuntimePolicy";
import { warmStartupCharacterAssets } from "../game/warmStartupCharacters";
import { StartGameScreen } from "../ui/StartGameScreen";
import { TutorialSpotlightProvider, useTutorialSpotlight } from "../tutorial/TutorialSpotlightContext";
import { TutorialSpotlightOverlay } from "../tutorial/TutorialSpotlightOverlay";
import { SPOTLIGHT_TARGET_IDS } from "../tutorial/spotlightTypes";

type ScaglioneConfig = {
  min: number;
  max: number;
  percentuale: number;
};

type GameContextType = {
  gamePhase: GamePhase;
  simulationEnabled: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  salvaPartita: () => Promise<void>;
  abitanti: Abitante[];
  /** Inventario cibo del giocatore (regno). */
  inventarioGiocatore: { itemId: string; quantità: number }[];
  /** Tesoro del giocatore (monete per stipendi edifici pubblici). */
  moneteGiocatore: number;
  /** Scorte cibo per edificio Mensa Pubblica (chiave = id edificio). */
  inventarioMensaByEdificioId: Record<number, { itemId: string; quantità: number }[]>;
  /** Scorte alimenti Emporio (acquisti dai Raccoglitori). */
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
  /** Aliquota % Tassa sul Patrimonio (monete inventario). */
  tassaPatrimonioPercentuale: number;
  /** Aliquota % Imposta sul Valore Aggiunto. */
  ivaPercentuale: number;
  politicaNascite: "figlio-unico" | "incentivi" | "nessuna";
  punteggioSanzioni: number;
  penaDiMorteAttiva: boolean;
  politicaReligiosa: "ateismo-stato" | "religione-stato" | "liberta-culto";
  leggeRazzialeAttiva: boolean;
  razzaCampoLavoro: Razza | null;
  razzaCampoSterminio: Razza | null;
  capoReligiosoSole: number | null;
  capoReligiosoAlieni: number | null;
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
    matrimonioUmanoRobot: boolean;
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
  setReligioneDiStato: (
    religione: "Ateo" | "Deista" | "Agnostico" | "Culto del Sole" | "Culto delle Ombre" | string | null
  ) => void;
  setLeggeRazzialeAttiva: (attiva: boolean) => void;
  setRazzaCampoLavoro: (razza: Razza | null) => void;
  setRazzaCampoSterminio: (razza: Razza | null) => void;
  setCapoReligiosoSole: (id: number | null) => void;
  setCapoReligiosoAlieni: (id: number | null) => void;
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
    matrimonioUmanoRobot: boolean;
    matrimonioIntercasta: boolean;
  }) => void;
  /** Importo mensile del Reddito di Cittadinanza per ogni disoccupato non schiavo. */
  redditoCittadinanza: number;
  setRedditoCittadinanza: (importo: number) => void;
  /** Imposta la modalità del sistema sanitario (Privata/Pubblica). */
  setModalitaSanita: (modalita: "privata" | "pubblica") => void;
  /**
   * Prelievo forzoso immediato (legge). Restituisce gettito e numero soggetti.
   */
  eseguiPrelievoForzosoRe: (importoPerAbitante: number) => { gettito: number; soggettiColpiti: number };
  avanzaMese: () => Promise<void>;
  assegnaAbitanteAEdificio: (abitanteId: number, edificioId: number) => void;
  rimuoviAbitanteDaEdificio: (abitanteId: number, edificioId: number) => void;
  setStipendioEdificio: (edificioId: number, stipendioPerLavoratore: number) => void;
  setColturaSerra: (edificioId: number, colturaItemId: string) => void;
  /** Colture della Serra selezionabili (in Avventura partono da una sola). */
  coltureSerraSbloccate: string[];
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
  /** Disoccupato che entra nell’Emporio → Mercante (max 4). */
  assumiDisoccupatoInEmporioDaMappa: (abitanteId: number) => boolean;
  /** Disoccupato che entra nel Bosco → Raccoglitore. */
  assumiDisoccupatoNelBoscoDaMappa: (abitanteId: number) => boolean;
  assumiDisoccupatoNellaMinieraDaMappa: (abitanteId: number) => boolean;
  /** Disoccupato che entra nel Castello → Guardia (max 4). */
  assumiDisoccupatoComeGuardiaDaMappa: (abitanteId: number) => boolean;
  /**
   * Lavoro irraggiungibile a piedi: altro posto raggiungibile, altrimenti Bosco/Raccoglitore.
   * Restituisce path e nuovo edificio per chi è stato ricollocato.
   */
  ricollocaLavoroIrraggiungibileDaMappa: (
    richieste: { abitanteId: number; fromCell: number }[],
    edificiInMappa: Record<
      number,
      {
        id: number;
        nome: string;
        edificioGlobaleId?: number;
        footprintRef?: number;
        footprint?: { w: number; h: number };
      }
    >,
    cols: number,
    rows: number,
    isWalkable: (i: number) => boolean
  ) => Record<number, { path: number[] | null; nuovoEdificioId?: number }>;
  /** Raccoglitore vende 1 alimento all’Emporio (Mercante −1 moneta). */
  vendeAlimentoAllEmporioDaMappa: (abitanteId: number) => boolean;
  /** Compra/vende/trasferisce uno schiavo. `nuovoProprietarioId: null` = regno. Restituisce true se riuscito. */
  trasferisciProprietaSchiavo: (schiavoId: number, nuovoProprietarioId: number | null, prezzo?: number) => boolean;
  /** Uccide uno schiavo di proprietà (`uccisoreId: null` = regno). Senza conseguenze legali. */
  uccidiSchiavo: (uccisoreId: number | null, schiavoId: number) => boolean;
  nominaMinistro: (abitanteId: number, ministero: string) => void;
  rimuoviMinistro: (abitanteId: number) => void;
  setNomeAbitante: (abitanteId: number, nuovoNome: string) => void;
  /** Aggiorna un abitante (es. effetti bisogni da mappa). */
  aggiornaAbitanteById: (abitanteId: number, fn: (a: Abitante) => Abitante) => void;
  /** Aggiorna un edificio (es. cassa Impresa). */
  aggiornaEdificioById: (edificioId: number, fn: (e: Edificio) => Edificio) => void;
  /** Se il Bar è senza lavoratori, assume il primo entrante come Barista. */
  provaAssumiBaristaBarVuotoDaMappa: (abitanteId: number, barEdificioId: number) => boolean;
  /** Incassa monete nella cassa di un'Impresa (+ fatturato mese). */
  incassaImpresa: (edificioId: number, monete: number) => void;
  /** Fine turno Bar: stipendio fisso da cassa + tip residuo ai baristi in servizio. */
  applicaPagaETipBarFineTurno: (baristiInServizioByBar: Record<number, number[]>) => void;
  /** Esito sociale di una chiacchiera «in giro» (amici/rivali, simmetrico). */
  applicaEsitoChiacchieraAbitanti: (idA: number, idB: number) => void;
  /** Adotta un abitante senza genitori vivi (es. dal Re). */
  adottaFiglio: (genitoreId: number, figlioId: number) => boolean;
  /** Accredita monete al tesoro del giocatore (es. pagamenti bar/negozio). */
  accreditaMoneteGiocatore: (quantità: number) => void;
  /** Addebita monete dal tesoro (es. costruzione Ponte). `false` se insufficienti. */
  addebitaMoneteGiocatore: (quantità: number) => boolean;
  /** Appende una riga al diario (avvisi soft). */
  appendDiarioRiga: (riga: string) => void;
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
  /** Presenza del Re: castello / a giro / in visita. */
  modalitaRe: "nel_castello" | "a_giro" | "in_visita";
  edificioVisitaReId: number | null;
  popolaritaRe: number;
  faseDisordine: "nessuna" | "protesta" | "ribellione";
  mesiConsecutiviNelCastello: number;
  setModalitaRe: (modalita: "nel_castello" | "a_giro" | "in_visita", edificioId?: number | null) => void;
  nativiNonIntegrati: number;
  pendingAssimilazione: number | null;
  accettaAssimilazione: () => void;
  rifiutaAssimilazione: () => void;
  pendingMatrimonio: { idA: number; idB: number; nomeA: string; nomeB: string } | null;
  confermaMatrimonio: (idA: number, idB: number) => void;
  rifiutaMatrimonio: () => void;
  /** Il Re cambia la casta di un abitante. Per «Schiavo» si può indicare il padrone. */
  setCastaAbitante: (abitanteId: number, casta: Casta, schiavistaId?: number | null) => void;
  eventiInCorso: EventoInCorso[];
  eventiCatalogo: EventoDef[];
  creazioneGiocatoreAperta: boolean;
  configuraGiocatore: (dati: DatiCreazioneGiocatore) => void | Promise<void>;
  introConsigliereAperta: boolean;
  chiudiIntroConsigliere: () => void;
  suggerimentoPonteAperto: boolean;
  chiudiSuggerimentoPonte: () => void;
  dialogPiazzaPonteAperto: boolean;
  apriDialogPiazzaPonte: () => void;
  chiudiDialogPiazzaPonte: () => void;
  introConsigliereVisto: boolean;
  diarioInizioVisto: boolean;
  nominaConsigliere: (abitanteId: number) => void;
  completaObiettivo: (obiettivoId: string) => void;
  messaggioEmigrazione: string | null;
  chiudiMessaggioEmigrazione: () => void;
  diarioRighe: string[];
  /** Log scambi commerciali e raccolte (Emporio, Bar, Negozio/Serra, Bosco, …). */
  registrazioniScambi: RegistrazioneScambio[];
  /** @deprecated Usa registrazioniScambi. */
  registrazioniEmporio?: RegistrazioneScambio[];
  /** Registra uno scambio commerciale o una raccolta (orologio di gioco automatico). */
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
  /** Id obiettivi completati nel salvataggio corrente. */
  obiettiviCompletati: string[];
  /** Modalità di gioco scelta. "creativa" = tutto disponibile; "avventura" = progressione. */
  modalitaGioco: "creativa" | "avventura";
  setModalitaGioco: (m: "creativa" | "avventura") => void;
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
  const { showSpotlight } = useTutorialSpotlight();
  const re = abitanti.find((a) => a.id === 1);
  const consigliere = abitanti.find((a) => a.lavoro === "Consigliere" && a.id !== 1);
  const nomeCompletoRe = re?.nome?.trim() && re.nome !== "—" ? re.nome.trim() : "Sovrano";
  const nomeRe = nomeCompletoRe.split(/\s+/)[0] || nomeCompletoRe;
  const nomeConsigliere = consigliere?.nome?.trim() || "il tuo Consigliere";
  const messaggioIntro =
    `Benvenuto Re ${nomeRe}. Io sono ${nomeConsigliere}, il tuo Consigliere. ` +
    `Dato che hai succeduto tuo padre alla tenera età di 10 anni, ora ti aiuterò a imparare a guidare il tuo Regno!`;
  const messaggioPonte =
    "Un fiume separa il nostro Regno, mio Re.\nPer unire le sponde piazzaremo un cantiere sul fiume: gli Edili dell'Ufficio Edile lo completeranno ora dopo ora.";
  const messaggioPiazzaPonte =
    "Ben fatto mio Re!\nScegli il punto sul fiume: nascerà un cantiere con barra di avanzamento.\nAssumi Edili nell'Ufficio Edile: ogni ora avanzano di 1 punto a testa!";

  const onChiudiPonte = () => {
    chiudiSuggerimentoPonte();
    showSpotlight({ targetId: SPOTLIGHT_TARGET_IDS.MAPPA_COSTRUISCI, padding: 10 });
  };

  return (
    <>
      <ConsigliereIntroModal
        visible={introConsigliereAperta}
        consigliere={consigliere}
        messaggio={messaggioIntro}
        onClose={chiudiIntroConsigliere}
      />
      <ConsigliereIntroModal
        visible={suggerimentoPonteAperto}
        consigliere={consigliere}
        messaggio={messaggioPonte}
        onClose={onChiudiPonte}
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
  const [startup, setStartup] = useState<"loading" | "choice" | "active">("loading");
  const [startupError, setStartupError] = useState<string | null>(null);
  const [startupLoadingLabel, setStartupLoadingLabel] = useState("Preparazione…");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [hasSave, setHasSave] = useState(false);
  const dirtyRef = useRef(false);
  const lastFingerprintRef = useRef<string | null>(null);
  const characterAssetsReadyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setStartupLoadingLabel("Caricamento salvataggio…");
        const storage = await createAsyncStoragePersistentStorage();
        const repository = new SaveRepository(storage);
        repositoryRef.current = repository;
        const result = await repository.loadBestAvailable();
        if (cancelled) return;
        pendingLoadRef.current = result;

        // Sprite Re + Consigliere (e tab Identità) prima di Continua / Nuova partita.
        setStartupLoadingLabel("Caricamento personaggi…");
        try {
          await warmStartupCharacterAssets(gameState.abitanti);
          characterAssetsReadyRef.current = true;
        } catch {
          characterAssetsReadyRef.current = false;
        }
        if (cancelled) return;

        // Sempre splash: senza save solo "Nuova partita" → scelta Creativa/Avventura.
        setHasSave(decideStartup(result) === "show-choice");
        setStartup("choice");
      } catch {
        if (cancelled) return;
        setStartupError("Salvataggio non disponibile. La partita può continuare senza persistenza.");
        setSaveStatus("error");
        setStartupLoadingLabel("Caricamento personaggi…");
        try {
          await warmStartupCharacterAssets(gameState.abitanti);
          characterAssetsReadyRef.current = true;
        } catch {
          characterAssetsReadyRef.current = false;
        }
        if (cancelled) return;
        setHasSave(false);
        setStartup("choice");
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
    lastFingerprintRef.current = null;
    dirtyRef.current = false;
    setStartup("active");
    if (loaded.source === "backup") Alert.alert("Backup ripristinato", "Il salvataggio principale non era disponibile. È stato caricato il backup.");
  }, [gameState]);

  const nuovaPartita = useCallback((modalita: "creativa" | "avventura") => {
    const create = async () => {
      // Se per qualche motivo il warm iniziale non ha finito, ripeti prima di aprire la creazione.
      if (!characterAssetsReadyRef.current) {
        setStartup("loading");
        setStartupLoadingLabel("Caricamento personaggi…");
        try {
          await warmStartupCharacterAssets(latestStateRef.current.abitanti);
          characterAssetsReadyRef.current = true;
        } catch {
          /* prosegui comunque */
        }
      }
      try {
        await repositoryRef.current?.clearAll();
      } catch {
        setStartupError("Non è stato possibile eliminare il vecchio salvataggio.");
        setStartup("choice");
        return;
      }
      pendingLoadRef.current = null;
      metadataRef.current = null;
      lastFingerprintRef.current = null;
      dirtyRef.current = true;
      resetMappaPersonaggiRuntime();
      setStartup("active");
      gameState.startNewGame(modalita);
    };
    void create();
  }, [gameState]);

  const salvaPartita = useCallback(async () => {
    const repository = repositoryRef.current;
    const currentMap = getMappaSessione();
    const state = latestStateRef.current;
    if (!repository || !currentMap || !state.simulationEnabled) return;
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
      dirtyRef.current = false;
      setSaveStatus("saved");
    } catch {
      dirtyRef.current = true;
      setSaveStatus("error");
    }
  }, []);

  useEffect(() => {
    if (startup !== "active" || !gameState.simulationEnabled || !mappa) return;
    const payload = gameStateToGameSaveV1(gameState.createPersistableState(mappa));
    const fingerprintPayload = { ...payload, calendar: { ...payload.calendar, giorno: 0, minutiDaMezzanotte: 0 } };
    const fingerprint = JSON.stringify(fingerprintPayload, (_key, value) => value === Infinity ? "__Infinity__" : value);
    if (lastFingerprintRef.current == null) {
      lastFingerprintRef.current = fingerprint;
      dirtyRef.current = metadataRef.current == null;
    } else if (lastFingerprintRef.current !== fingerprint) {
      lastFingerprintRef.current = fingerprint;
      dirtyRef.current = true;
    }
  }, [startup, gameState, mappa]);

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

  const avanzaMeseConSalvataggio = useCallback(async () => {
    await runMutationThenSave(
      gameState.avanzaMese,
      async () => {
        dirtyRef.current = true;
        await new Promise((resolve) => setTimeout(resolve, 0));
        await salvaPartita();
      }
    );
  }, [gameState, salvaPartita]);

  const contextValue = { ...gameState, avanzaMese: avanzaMeseConSalvataggio, saveStatus, salvaPartita };

  if (startup !== "active") {
    return <StartGameScreen loading={startup === "loading"} hasSave={hasSave} error={startupError} loadingLabel={startupLoadingLabel} onContinue={continua} onNewGame={nuovaPartita} />;
  }

  return (
    <GameContext.Provider value={contextValue}>
      <TutorialSpotlightProvider>
        <View style={{ flex: 1 }}>
          {children}
          <CreazioneGiocatoreWrapper />
          <IntroConsigliereDialogWrapper />
          <RichiestaLuogoCultoDialogWrapper />
          <EmigrazioneDialogWrapper />
          <TutorialSpotlightOverlay />
        </View>
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
