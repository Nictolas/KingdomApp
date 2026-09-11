import type { Edificio, EventoInCorso, OrdineMercato, Razza, Risorsa, Abitante } from "../types";
import type { MappaRuntimeState } from "../game/mappaTypes";
import type { PenaReatiConfig } from "../game/reati";
import type { ReligioneConCulto } from "../game/luogoCulto";
import type { RichiestaInAttesa } from "../game/richieste";
import type { VoceInventario } from "../game/inventario";

export const SAVE_FORMAT = "mykingdom-save" as const;
export const SAVE_SCHEMA_VERSION = 1 as const;

export type SaveGamePhase = "commander-creation" | "activating" | "running";

export type SaveMetadata = {
  saveId: string;
  gameVersion: string;
  createdAt: string;
  updatedAt: string;
};

export type ScaglioneSalvato = { min: number; max: number; percentuale: number };

export type GameSaveV1 = {
  gamePhase: SaveGamePhase;
  introductionCompleted: boolean;
  diarioInizioVisto: boolean;
  /** Opzionale: salvataggi precedenti non lo hanno. */
  introConsigliereVisto?: boolean;
  population: {
    abitanti: Abitante[];
    abitantiProposti: Abitante[];
    nextId: number;
    razzaNativi: Razza;
    nativiNonIntegrati: number;
  };
  colony: {
    edifici: Edificio[];
    risorse: Risorsa[];
    inventarioGiocatore: VoceInventario[];
    inventarioMensaByEdificioId: Record<number, VoceInventario[]>;
    /** Opzionale: salvataggi precedenti non lo hanno. */
    inventarioEmporioByEdificioId?: Record<number, VoceInventario[]>;
    moneteGiocatore: number;
    prezzoResidenze: Record<string, number>;
  };
  calendar: {
    mese: number;
    anno: number;
    giorno: number;
    minutiDaMezzanotte: number;
    pausaManuale: boolean;
  };
  simulationCursors: {
    ultimoGiornoPasti: number;
    ultimoGiornoProduzioneSerra: number;
    ultimoGiornoEconomiaPubblica: number;
  };
  policies: {
    tipoTassaReddito: "flat" | "scaglioni";
    flatTaxPercentuale: number;
    scaglioniConfig: ScaglioneSalvato[];
    /** Opzionale: salvataggi precedenti. */
    tassaPatrimonioPercentuale?: number;
    /** Opzionale: salvataggi precedenti. */
    ivaPercentuale?: number;
    politicaNascite: "figlio-unico" | "incentivi" | "nessuna";
    punteggioSanzioni: number;
    penaDiMorteAttiva: boolean;
    penaReati: PenaReatiConfig;
    politicaReligiosa: "ateismo-stato" | "religione-stato" | "liberta-culto";
    religioneDiStato: Abitante["religione"] | null;
    /** Religioni create dal giocatore. Opzionale per salvataggi precedenti. */
    religioniCustom?: import("../game/fedeleCulto").ReligioneCustom[];
    leggeRazzialeAttiva: boolean;
    razzaCampoLavoro: Razza | null;
    razzaCampoSterminio: Razza | null;
    etaMinimaLavoro: number;
    etaPensionabile: number;
    assegnoPensionati: number;
    leggeDroghe: "vietate" | "legali" | "parziali";
    /** Opzionale per mantenere compatibili i salvataggi creati prima della legge. */
    nudismoAttivo?: boolean;
    divietoEspatrioAttivo: boolean;
    coprifuocoAttivo: boolean;
    coprifuocoInizioMinuti: number;
    coprifuocoFineMinuti: number;
    iusPrimaeNoctisAttivo: boolean;
    tipologieFamigliaAccettate: {
      tradizionale: boolean;
      interrazziale: boolean;
      arcobaleno: boolean;
      monogenitoriale: boolean;
      matrimonioUmanoRobot: boolean;
      matrimonioIntercasta: boolean;
    };
    redditoCittadinanza: number;
    modalitaSanita: "privata" | "pubblica";
  };
  events: {
    ordiniMercato: OrdineMercato[];
    eventiInCorso: EventoInCorso[];
    soddisfazioneFazioni: Record<string, number>;
    /** Modalità presenza del Re sul regno. Opzionale per salvataggi vecchi. */
    modalitaRe?: "nel_castello" | "a_giro" | "in_visita";
    edificioVisitaReId?: number | null;
    popolaritaRe?: number;
    mesiConsecutiviNelCastello?: number;
    faseDisordine?: "nessuna" | "protesta" | "ribellione";
    avvisoReAssenteEmesso?: boolean;
    pendingAssimilazione: number | null;
    pendingMatrimonio: { idA: number; idB: number; nomeA: string; nomeB: string } | null;
    messaggioEmigrazione: string | null;
    diarioRighe: string[];
    /** Opzionale: salvataggi precedenti non lo hanno. */
    registrazioniEmporio?: {
      id: string;
      giorno: number;
      minutiDaMezzanotte: number;
      venditoreId: number;
      venditoreNome: string;
      mercanteId: number;
      mercanteNome: string;
      itemId: string;
      itemNome: string;
      itemEmoji: string;
      prezzoMonete: number;
      emporioId: number;
    }[];
    /** Log unificato scambi moneta↔oggetto e raccolte. */
    registrazioniScambi?: {
      id: string;
      giorno: number;
      minutiDaMezzanotte: number;
      luogoEdificioId: number | null;
      luogoNome: string;
      daId: number | null;
      daNome: string;
      aId: number | null;
      aNome: string;
      itemId: string;
      itemNome: string;
      itemEmoji: string;
      prezzoMonete: number;
      tipo?: "scambio" | "raccolta";
    }[];
    capoReligiosoSole: number | null;
    capoReligiosoAlieni: number | null;
    pendingRichiestaLuogoCulto: { id: number; nome: string; religione: ReligioneConCulto } | null;
    richiesteInAttesa: RichiestaInAttesa[];
    luoghiCultoRifiutati: ReligioneConCulto[];
    luoghiCultoPendentiMappa: { religione: ReligioneConCulto; edificioGlobaleId: number }[];
    /** Id obiettivi completati in modalità Avventura. */
    obiettiviCompletati?: string[];
    /** Id colture Serra sbloccate (Avventura). Assente nei salvataggi vecchi. */
    coltureSerraSbloccate?: string[];
  };
  /** Modalità di gioco scelta al primo avvio. */
  modalitaGioco?: "creativa" | "avventura";
  map: MappaRuntimeState;
};

export type SaveEnvelopeV1 = {
  format: typeof SAVE_FORMAT;
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  metadata: SaveMetadata;
  payload: GameSaveV1;
};
