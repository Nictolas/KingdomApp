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

type GameContextType = Omit<ReturnType<typeof useGameState>, "avanzaMese"> & {
  saveStatus: "idle" | "saving" | "saved" | "error";
  salvaPartita: () => Promise<void>;
  avanzaMese: () => Promise<void>;
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
