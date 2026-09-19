import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, ReactNode } from "react";
import { usePathname } from "expo-router";
import { Alert, AppState } from "react-native";
import { useGameState } from "../hooks/useGameState";
import type { Abitante, Risorsa, Edificio, OrdineMercato, EventoInCorso, Razza } from "../types";
import type { EventoDef } from "../game/eventi";
import { DialogInizioPartitaModal } from "../ui/DialogInizioPartitaModal";
import { CreazioneGiocatoreModal, type DatiCreazioneGiocatore } from "../ui/CreazioneGiocatoreModal";
import { RichiestaLuogoCultoModal } from "../ui/RichiestaLuogoCultoModal";
import type { ReligioneConCulto } from "../game/luogoCulto";
import type { RichiestaInAttesa } from "../game/richieste";
import type { PenaReatiConfig, ReatoPunibile } from "../game/reati";
import type { RisultatoGiudizio } from "../game/tribunale";
import type { GamePhase } from "../game/gamePhase";
import type { GameMode } from "../game/gameMode";
import { getMappaSessione, subscribeMappaSessione } from "../game/mappaSessione";
import { createAsyncStoragePersistentStorage } from "../persistence/asyncStorageAdapter";
import { gameSaveV1ToGameState, gameStateToGameSaveV1 } from "../persistence/gameStateMapping";
import { SaveRepository, type LoadSaveResult } from "../persistence/saveRepository";
import { SAVE_FORMAT, SAVE_SCHEMA_VERSION, type SaveEnvelopeV1 } from "../persistence/saveTypes";
import { decideStartup, runMutationThenSave, shouldAutosave, shouldConfirmNewGame } from "../persistence/saveRuntimePolicy";
import { StartGameScreen } from "../ui/StartGameScreen";
import { GameModeSelectionScreen } from "../ui/GameModeSelectionScreen";

type ScaglioneConfig = {
  min: number;
  max: number;
  percentuale: number;
};

type GameContextType = {
  gameMode: GameMode;
  /** Alias UI legacy: stessa modalità di gameMode. */
  modalitaGioco: "creativa" | "avventura";
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
  setPoliticaNascite: (politica: "figlio-unico" | "incentivi" | "nessuna") => void;
  setPenaDiMorteAttiva: (attiva: boolean) => void;
  setPoliticaReligiosa: (politica: "ateismo-stato" | "religione-stato" | "liberta-culto") => void;
  setReligioneDiStato: (religione: "Ateo" | "Deista" | "Agnostico" | "Culto del Sole" | "Culto delle Ombre" | string | null) => void;
  setLeggeRazzialeAttiva: (attiva: boolean) => void;
  setRazzaCampoLavoro: (razza: Razza | null) => void;
  setRazzaCampoSterminio: (razza: Razza | null) => void;
  setCapoReligiosoSole: (id: number | null) => void;
  setCapoReligiosoAlieni: (id: number | null) => void;
  setEtaMinimaLavoro: (eta: number) => void;
  setEtaPensionabile: (eta: number) => void;
  setAssegnoPensionati: (importo: number) => void;
  setLeggeDroghe: (legge: "vietate" | "legali" | "parziali") => void;
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
  avanzaMese: () => Promise<void>;
  assegnaAbitanteAEdificio: (abitanteId: number, edificioId: number) => void;
  rimuoviAbitanteDaEdificio: (abitanteId: number, edificioId: number) => void;
  setStipendioEdificio: (edificioId: number, stipendioPerLavoratore: number) => void;
  setColturaSerra: (edificioId: number, colturaItemId: string) => void;
  /** Aggiunge un edificio reale (istanza con id nuovo) dal catalogo; restituisce l'id creato o null. */
  aggiungiEdificioDaTemplate: (
    templateId: number,
    options?: { costoMateriale?: number; stato?: Edificio["stato"] }
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
  /** Compra/vende/trasferisce uno schiavo. `nuovoProprietarioId: null` = colonia. Restituisce true se riuscito. */
  trasferisciProprietaSchiavo: (schiavoId: number, nuovoProprietarioId: number | null, prezzo?: number) => boolean;
  /** Uccide uno schiavo di proprietà (`uccisoreId: null` = colonia). Senza conseguenze legali. */
  uccidiSchiavo: (uccisoreId: number | null, schiavoId: number) => boolean;
  nominaMinistro: (abitanteId: number, ministero: string) => void;
  rimuoviMinistro: (abitanteId: number) => void;
  setNomeAbitante: (abitanteId: number, nuovoNome: string) => void;
  /** Aggiorna un abitante (es. effetti bisogni da mappa). */
  aggiornaAbitanteById: (abitanteId: number, fn: (a: Abitante) => Abitante) => void;
  /** Esito sociale di una chiacchiera «in giro» (amici/rivali, simmetrico). */
  applicaEsitoChiacchieraAbitanti: (idA: number, idB: number) => void;
  /** Accredita monete al tesoro del giocatore (es. pagamenti bar/negozio). */
  accreditaMoneteGiocatore: (quantità: number) => void;
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
  diarioInizioVisto: boolean;
  messaggioEmigrazione: string | null;
  chiudiMessaggioEmigrazione: () => void;
  diarioRighe: string[];
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
  const [startup, setStartup] = useState<"loading" | "choice" | "mode-choice" | "active">("loading");
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
      setStartup("active");
      gameState.startNewGame(mode);
    })();
  }, [gameState]);

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

  if (startup === "mode-choice") {
    return (
      <GameModeSelectionScreen
        error={startupError}
        canCancel={pendingLoadRef.current != null && pendingLoadRef.current.source !== "none"}
        onSelect={avviaNuovaPartita}
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
      />
    );
  }

  return (
    <GameContext.Provider value={contextValue}>
      {children}
      <CreazioneGiocatoreWrapper />
      <RichiestaLuogoCultoDialogWrapper />
      <EmigrazioneDialogWrapper />
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
