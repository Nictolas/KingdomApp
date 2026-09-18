import type { Edificio, EventoInCorso, OrdineMercato, Razza, Risorsa, Abitante } from "../types";
import type { MappaRuntimeState } from "../game/mappaTypes";
import type { PenaReatiConfig } from "../game/reati";
import type { ReligioneConCulto } from "../game/luogoCulto";
import type { RichiestaInAttesa } from "../game/richieste";
import type { VoceInventario } from "../game/inventario";
import type { GameMode } from "../game/gameMode";

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
    politicaNascite: "figlio-unico" | "incentivi" | "nessuna";
    punteggioSanzioni: number;
    penaDiMorteAttiva: boolean;
    penaReati: PenaReatiConfig;
    politicaReligiosa: "ateismo-stato" | "religione-stato" | "liberta-culto";
    religioneDiStato: Abitante["religione"] | null;
    leggeRazzialeAttiva: boolean;
    razzaCampoLavoro: Razza | null;
    razzaCampoSterminio: Razza | null;
    etaMinimaLavoro: number;
    etaPensionabile: number;
    assegnoPensionati: number;
    leggeDroghe: "vietate" | "legali" | "parziali";
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
    pendingAssimilazione: number | null;
    pendingMatrimonio: { idA: number; idB: number; nomeA: string; nomeB: string } | null;
    messaggioEmigrazione: string | null;
    diarioRighe: string[];
    capoReligiosoSole: number | null;
    capoReligiosoAlieni: number | null;
    pendingRichiestaLuogoCulto: { id: number; nome: string; religione: ReligioneConCulto } | null;
    richiesteInAttesa: RichiestaInAttesa[];
    luoghiCultoRifiutati: ReligioneConCulto[];
    luoghiCultoPendentiMappa: { religione: ReligioneConCulto; edificioGlobaleId: number }[];
  };
  map: MappaRuntimeState;
};

export type SaveEnvelopeV1 = {
  format: typeof SAVE_FORMAT;
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  metadata: SaveMetadata;
  payload: GameSaveV1;
};
