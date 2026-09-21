import type { Edificio, EventoInCorso, OrdineMercato, Razza, Risorsa, Abitante } from "../types";
import type { MappaRuntimeState } from "../game/mappaTypes";
import type { PenaReatiConfig } from "../game/reati";
import type { ReligioneConCulto } from "../game/luogoCulto";
import type { RichiestaInAttesa } from "../game/richieste";
import type { VoceInventario } from "../game/inventario";
import type { GameMode } from "../game/gameMode";
import type { RegistrazioneScambio } from "../game/registrazioniScambi";

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
  gameMode?: GameMode;
  gamePhase: SaveGamePhase;
  introductionCompleted: boolean;
  diarioInizioVisto: boolean;
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
    /** Scorte alimentari Emporio; assente nei salvataggi precedenti. */
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
    /** Assente nei salvataggi precedenti al ripristino fiscale. */
    tassaPatrimonioPercentuale?: number;
    /** Assente nei salvataggi precedenti al ripristino fiscale. */
    ivaPercentuale?: number;
    politicaNascite: "figlio-unico" | "incentivi" | "nessuna";
    punteggioSanzioni: number;
    penaDiMorteAttiva: boolean;
    penaReati: PenaReatiConfig;
    politicaReligiosa: "ateismo-stato" | "religione-stato" | "liberta-culto";
    religioneDiStato: Abitante["religione"] | null;
    /** Religioni create dal giocatore; assente nei vecchi salvataggi. */
    religioniCustom?: import("../game/fedeleCulto").ReligioneCustom[];
    leggeRazzialeAttiva: boolean;
    razzaCampoLavoro: Razza | null;
    razzaCampoSterminio: Razza | null;
    etaMinimaLavoro: number;
    etaPensionabile: number;
    assegnoPensionati: number;
    leggeDroghe: "vietate" | "legali" | "parziali";
    /** Assente nei salvataggi creati dopo il refactoring che aveva rimosso la policy. */
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
    /** Stato della presenza/politica del Re; assente nei salvataggi precedenti. */
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
    /** Registro economico/raccolte; assente nei salvataggi precedenti. */
    registrazioniScambi?: RegistrazioneScambio[];
    capoReligiosoSole: number | null;
    capoReligiosoOmbre: number | null;
    /** @deprecated Compatibilità con salvataggi precedenti. */
    capoReligiosoAlieni?: number | null;
    pendingRichiestaLuogoCulto: { id: number; nome: string; religione: ReligioneConCulto } | null;
    richiesteInAttesa: RichiestaInAttesa[];
    luoghiCultoRifiutati: ReligioneConCulto[];
    luoghiCultoPendentiMappa: { religione: ReligioneConCulto; edificioGlobaleId: number }[];
    /** Id obiettivi completati in modalità Avventura. Assente nei salvataggi precedenti. */
    obiettiviCompletati?: string[];
    /** Colture Serra sbloccate in Avventura. Assente nei salvataggi precedenti. */
    coltureSerraSbloccate?: string[];
  };
  map: MappaRuntimeState;
};

export type SaveEnvelopeV1 = {
  format: typeof SAVE_FORMAT;
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  metadata: SaveMetadata;
  payload: GameSaveV1;
};
