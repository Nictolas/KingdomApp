import React, { createContext, useContext, ReactNode } from "react";
import { useGameState } from "../hooks/useGameState";
import type { Abitante, Risorsa, Edificio, OrdineMercato, EventoInCorso, Razza } from "../types";
import type { EventoDef } from "../game/eventi";
import { DialogInizioPartitaModal } from "../ui/DialogInizioPartitaModal";
import { RichiestaLuogoCultoModal } from "../ui/RichiestaLuogoCultoModal";
import type { ReligioneConCulto } from "../game/luogoCulto";
import type { RichiestaInAttesa } from "../game/richieste";

type ScaglioneConfig = {
  min: number;
  max: number;
  percentuale: number;
};

type GameContextType = {
  abitanti: Abitante[];
  /** Inventario cibo del giocatore (colonia). */
  inventarioGiocatore: { itemId: string; quantità: number }[];
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
  religioneDiStato: "Ateo" | "Deista" | "Agnostico" | "Culto del Sole" | "Culto degli Alieni" | null;
  etaMinimaLavoro: number;
  etaPensionabile: number;
  assegnoPensionati: number;
  leggeDroghe: "vietate" | "legali" | "parziali";
  divietoEspatrioAttivo: boolean;
  iusPrimaeNoctisAttivo: boolean;
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
  setReligioneDiStato: (religione: "Ateo" | "Deista" | "Agnostico" | "Culto del Sole" | "Culto degli Alieni" | null) => void;
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
  /** Aggiunge un edificio reale (istanza con id nuovo) dal catalogo; restituisce l'id creato o null. */
  aggiungiEdificioDaTemplate: (templateId: number) => number | null;
  rimuoviEdificioPerId: (id: number) => void;
  /** Prezzo mensile (crediti) per tipo di residenza. Chiave = nome residenza (es. "Baracca"). Se assente si usa il default del catalogo. */
  prezzoResidenze: Record<string, number>;
  setPrezzoResidenza: (nomeResidenza: string, prezzo: number) => void;
  aggiungiAlCampoDiLavoroTuttiQuelliChe: (filtro: {
    personalità?: string;
    razza?: string;
    religione?: string;
  }) => void;
  /** Assegna un Servo della gleba a un edificio con posto libero (assegnazione coattiva del giocatore). */
  assegnaServoDellaGlebaAEdificio: (abitanteId: number, edificioId: number) => void;
  /** Compra/vende/trasferisce uno schiavo. `nuovoProprietarioId: null` = colonia. Restituisce true se riuscito. */
  trasferisciProprietaSchiavo: (schiavoId: number, nuovoProprietarioId: number | null, prezzo?: number) => boolean;
  /** Uccide uno schiavo di proprietà (`uccisoreId: null` = colonia). Senza conseguenze legali. */
  uccidiSchiavo: (uccisoreId: number | null, schiavoId: number) => boolean;
  nominaMinistro: (abitanteId: number, ministero: string) => void;
  rimuoviMinistro: (abitanteId: number) => void;
  setNomeAbitante: (abitanteId: number, nuovoNome: string) => void;
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
  graziaCriminale: (abitanteId: number) => void;
  condannaAMorte: (abitanteId: number) => void;
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
  alertInizioPartita: { titolo: string; messaggio: string } | null;
  chiudiAlertInizioPartita: () => void;
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

function DialogInizioPartitaWrapper() {
  const { alertInizioPartita, chiudiAlertInizioPartita } = useGameContext();
  return (
    <DialogInizioPartitaModal
      visible={!!alertInizioPartita}
      titolo={alertInizioPartita?.titolo ?? ""}
      messaggio={alertInizioPartita?.messaggio ?? ""}
      onClose={chiudiAlertInizioPartita}
    />
  );
}

function EmigrazioneDialogWrapper() {
  const { messaggioEmigrazione, chiudiMessaggioEmigrazione } = useGameContext();
  return (
    <DialogInizioPartitaModal
      visible={!!messaggioEmigrazione}
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
    accettaRichiestaLuogoCulto,
    rifiutaRichiestaLuogoCulto,
    rimandaRichiestaLuogoCulto
  } = useGameContext();
  return (
    <RichiestaLuogoCultoModal
      visible={pendingRichiestaLuogoCulto != null}
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

  return (
    <GameContext.Provider value={gameState}>
      {children}
      <RichiestaLuogoCultoDialogWrapper />
      <DialogInizioPartitaWrapper />
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
