import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle
} from "react-native";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Redirect, useRouter } from "expo-router";
import { edificiData } from "../src/data/edificiData";
import { useGameContext } from "../src/context/GameContext";
import {
  applyTerrenoGrassAndSandContinuity,
  buildTerrenoFromRivers,
  ensureStradaErbaTerrainBoundaryRules,
  fillErbaEnclosedByWater,
  generateRivers,
  hasOrthogonalSandNeighbor,
  hasOrthogonalWaterNeighbor,
  isTerrenoAcqua,
  type TerrenoType
} from "../src/game/riverGeneration";
import type { Abitante, Edificio, Risorsa } from "../src/types";
import {
  azzeraAperturaResidenzaPending,
  getAperturaResidenzaPending
} from "../src/game/mappaAperturaPending";
import { getMappaSessione, setMappaSessione } from "../src/game/mappaSessione";
import {
  aggiungiAbitanteAlCultoEdificio,
  èNomeLuogoCulto,
  nomeEdificioLuogoCulto,
  piazzaLuogoCultoSuMappa,
  religioneDaNomeEdificioLuogoCulto,
  rimuoviAbitanteDaTuttiCulti,
  trovaLuoghiCultoDaPiazzareSuMappa,
  type ReligioneConCulto
} from "../src/game/luogoCulto";
import type { MappaRuntimeState } from "../src/game/mappaTypes";
import {
  distribuisciAbitantiSuAnchorCapanne,
  elencoAnchorCelleCapanne,
  getAnchorCellPerEdificio,
  idGlobalePerResidenzaInCella,
  NOMI_RESIDENZE_MAPPA,
  POSTI_PER_CASA_MAPPA,
  preparaResidenzeMappaPerLookup,
  residenzaGlobaleDi,
  risolviAnchorCasaAbitante,
  trovaCellaAnchorCasaSuMappa,
  èResidenzaMappa
} from "../src/game/residenzaMappa";
import { AbitanteInfoModal } from "../src/ui/AbitanteInfoModal";
import { CapannaFullscreenModal } from "../src/ui/CapannaFullscreenModal";
import { LuogoCultoFullscreenModal } from "../src/ui/LuogoCultoFullscreenModal";
import { abitanteDeveAndareAlCultoOra, abitanteNascostoNelCultoOra } from "../src/game/presenzaLuogoCulto";
import { RichiesteModal } from "../src/ui/RichiesteModal";
import { EventiModal } from "../src/ui/EventiModal";
import { calcolaEventiUI } from "../src/game/eventiDisponibili";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import {
  RpgFootprintAdmin3x2,
  RpgFootprintCapanna2x1,
  RpgFootprintDorm2x2,
  RpgFootprintBar2x2,
  RpgFootprintTribunale2x2,
  RpgFootprintUfficioImmigrazione2x2,
  RpgFootprintUfficioEdile2x2,
  RpgFootprintCantiere,
  RpgFootprintLuogoCultoSole2x2,
  RpgFootprintLuogoCultoAlieni2x2,
  RpgFootprintCarcere2x2,
  RpgFootprintCampoLavoro2x2,
  RpgFootprintCampoSterminio2x2,
  RpgFootprintCaserma2x2,
  RpgFootprintCentralePolizia2x2,
  RpgFootprintMercato2x2,
  RpgFootprintNegozio2x2,
  RpgFootprintDissalatore2x2,
  RpgFootprintSerra2x1,
  RpgFootprintSpazioporto4x3
} from "../src/components/RpgFootprintBuilding";
import { MapWandererCharacter } from "../src/components/MapWandererCharacter";
import { abitanteSoggettoACoprifuoco } from "../src/game/coprifuoco";
import {
  applicaRecuperoBar,
  applicaRecuperoCulto,
  applicaRecuperoEnergiaSonno,
  abitanteUsaBisogniUmani,
  abitanteVuolePrendereLavoro,
  COSTO_BAR_MONETE,
  getBisogniAbitante,
  patchBisogni,
  scegliAzioneTempoLibero
} from "../src/game/bisogni";
import { getCastaAbitante, getEmojiCasta } from "../src/game/casta";
import { elencoEdificiConPostoPerDisoccupato } from "../src/game/edificiLavoro";
import { getEdificioAbitazione } from "../src/game/abitanteEdifici";
import {
  getTotaleOggettiInventarioGiocatore,
  getMoneteInventarioAbitante,
  provaSpendiMoneteInventarioAbitante
} from "../src/game/inventario";
import { abitanteHaBisognoMensa } from "../src/game/mensaPubblica";
import { abitanteVuoleNegozio, compraEMangiaAlNegozio, tentaSnackDaInventario } from "../src/game/negozio";
import { MapTerrainCell } from "../src/components/MapTerrainCell";
import { MapWaterCellsLayer } from "../src/components/MapWaterCellsLayer";
import { PhaserMapSurface } from "../src/components/PhaserMapSurface";
import { buildPhaserMapSnapshot } from "../src/phaser/adapters/buildPhaserMapSnapshot";
import type { PhaserMapCharacter, PhaserMapInteraction } from "../src/phaser/adapters/mapSceneBridge";
import { MondoLoadingScreen } from "../src/components/MondoLoadingScreen";
import {
  buildVisibleCellIndices,
  computeVisibleCellRange,
  footprintIntersectsRange,
  type MapTransformState
} from "../src/game/mapViewportCulling";
import {
  assicuraEdificiCollegatiDaStrada,
  buildExcludeSandByRoads,
  indiciViciniOrtogonaliStrada
} from "../src/game/roadConnectivity";
import {
  abitanteAlBarRoutineOra,
  abitanteInOrarioLavoroEdificio,
  fasciaPerEdificio,
  minutiInFascia,
  primoEdificioLavoroOrarioPerAbitante
} from "../src/game/orariLavoroMappa";
import {
  calcolaPercorsoVersoAnchorEdificio,
  pianificaCommuteMattina,
  pianificaCommuteSeraACasa,
  pianificaCommuteVersoBarDaCella,
  pianificaCommuteVersoEdificioGlobaleDaCella,
  scegliBarEdificioIdPiuVicino,
  scegliEdificioIdPiuVicinoPerNome,
  scegliLuogoCultoEdificioIdPiuVicino,
  scegliMensaEdificioIdPiuVicino,
  trovaAnchorEdificioGlobaleSuMappa,
  trovaCellaPortaEdificio
} from "../src/game/commutePathsMappa";
import { SEZIONE_AMBIENTE, SEZIONI_COSTRUZIONE, type TerrenoCostruzioneKind } from "../src/game/costruzioneSezioni";
import {
  costoMaterialeEdilePerFootprint,
  haMaterialeEdileSufficiente,
  quantitaMaterialeEdile
} from "../src/game/costruzioneEdifici";
import { setBarArrivatiMappaSnapshot } from "../src/game/mappaBarArrivatiStore";
import { computeStatoCielo } from "../src/game/cicloCielo";
import { formatOrologioGioco, getGiornoGiocoSnapshot } from "../src/game/orologioGiocoSession";
import { useOrologioGioco } from "../src/hooks/useOrologioGioco";
import { descriviAzioneCorrenteAbitante } from "../src/game/azioneAbitanteMappa";
import {
  abitantePuòTentareRapina,
  resolveRapina,
  scegliBersaglioRapina,
  type RapinaTarget
} from "../src/game/rapina";
import {
  applicaStradaFootprint2x2,
  calcolaAnchorStrada2x2,
  footprintStrada2x2Valido,
  isCellaOkPerStrada,
  piazzaStrada2x2CheContiene,
  STRADA_FOOTPRINT_H,
  STRADA_FOOTPRINT_W
} from "../src/game/stradaFootprint";
import {
  buildCoastalAssetLookups,
  buildErbaAssetLookup,
  buildStradaAssetLookup,
  erbaExtraDecorCasuale,
  sandWaterEdgeMaskAt
} from "../src/game/terrainSpriteHelpers";

/** Dimensione fissa della mappa: non dipende dal viewport. Stabilita una sola volta all'avvio. */
const FIXED_MAP_COLS = 50;
const FIXED_MAP_ROWS = 50;
/** Footprint del complesso amministrativo: 3 colonne × 2 righe (largo × alto). */
const ADMIN_FOOTPRINT_W = 3;
const ADMIN_FOOTPRINT_H = 2;
/** Footprint dormitori iniziali: 2×2. */
const DORMITORIO_FOOTPRINT_W = 2;
const DORMITORIO_FOOTPRINT_H = 2;
/** Bar: stesso ingombro 2×2 del dormitorio. */
const BAR_FOOTPRINT_W = 2;
const BAR_FOOTPRINT_H = 2;
/** Tribunale: 2×2 (emoji bilancia ⚖️ sul catalogo). */
const TRIBUNALE_FOOTPRINT_W = 2;
const TRIBUNALE_FOOTPRINT_H = 2;
/** Ufficio Immigrazione: 2×2 (stesso stile del Tribunale). */
const UFFICIO_IMMIGRAZIONE_FOOTPRINT_W = 2;
const UFFICIO_IMMIGRAZIONE_FOOTPRINT_H = 2;
/** Ufficio Edile: 2×2 (stesso stile istituzionale). */
const UFFICIO_EDILE_FOOTPRINT_W = 2;
const UFFICIO_EDILE_FOOTPRINT_H = 2;
/** Mercato: 2×2 (tenda verde/rossa, facciata commerciale). */
const MERCATO_FOOTPRINT_W = 2;
const MERCATO_FOOTPRINT_H = 2;
/** Negozio: 2×2 (vendita al dettaglio). */
const NEGOZIO_FOOTPRINT_W = 2;
const NEGOZIO_FOOTPRINT_H = 2;
/** Dissalatore: 2×2 con 2 celle sabbia + 2 celle mare (confine `isAcqua`). */
const DISSALATORE_FOOTPRINT_W = 2;
const DISSALATORE_FOOTPRINT_H = 2;
/** Spazioporto: edificio + area lancio (sprite orizzontale). */
const SPAZIOPORTO_FOOTPRINT_W = 4;
const SPAZIOPORTO_FOOTPRINT_H = 3;
/** Serra: due celle in orizzontale × una in verticale. */
const SERRA_FOOTPRINT_W = 2;
const SERRA_FOOTPRINT_H = 1;
/** Capanna procedurale: stesso footprint 2×1 della Serra. */
const CAPANNA_FOOTPRINT_W = 2;
const CAPANNA_FOOTPRINT_H = 1;
/** Strada, Acqua, Spiaggia, Erba (costruzione giocatore): sempre 2×2. */
const COSTRUZIONE_TERRENO_FOOTPRINT_W = 2;
const COSTRUZIONE_TERRENO_FOOTPRINT_H = 2;
/** Dimensione fissa di ogni cella in pixel (nessuna percentuale, solo px). */
const CELL_SIZE_PX = 40;
/** Gap tra le celle (0 = griglia compatta 2000x2000). */
const GAP = 0;

/**
 * Celle senza griglia: bordi azzerati in modo esplicito (su web anche outline/focus su Pressable).
 * Il layer emoji non deve mai ridisegnare i bordi sopra al terreno (altrimenti linee doppie / punti agli incroci).
 */
const CELLA_SENZA_GRIGLIA: ViewStyle = Platform.select<any>({
  web: {
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 0,
    outlineWidth: 0,
    outlineStyle: "none",
    boxShadow: "none"
  },
  default: {
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 0
  }
}) as ViewStyle;
const DOPPIO_TAP_MS = 400;

/**
 * Su web, `display: grid` + `transform: scale()` (zoom mappa) fa posizionare le celle su coordinate
 * subpixel: compaiono fessure di 1px e si vede lo sfondo nero (#000) — tipicamente righe orizzontali.
 * Posizionamento assoluto con left/top interi elimina quelle crepe.
 */
function webCellAbsolutePosition(index: number, cols: number, cellPx: number): ViewStyle {
  return {
    position: "absolute",
    left: (index % cols) * cellPx,
    top: Math.floor(index / cols) * cellPx
  };
}

/** Calcola indici edifici iniziali in funzione di cols/rows (centro griglia). */
function getIndiciEdificiIniziali(cols: number, rows: number) {
  const centro = Math.floor((cols * rows) / 2) - Math.floor(cols / 2);
  return {
    CENTRO_COMANDO_INDEX: centro,
    SPAZIOPORTO_INDEX: centro + 1,
    TRIBUNALE_INDEX: centro + cols,
    SERRA_INDEX: centro - 1,
    /** Preferenza posizionamento seconda Serra (2×1), lontano dalla prima. */
    SERRA_2_INDEX: centro - 4,
    DORMITORIO_1_INDEX: centro + 2,
    DORMITORIO_2_INDEX: centro - cols,
    DORMITORIO_3_INDEX: centro + cols + 1,
    /** Bar 2×2: preferenza a sud-est del nucleo (trovaAnchor risolve conflitti). */
    BAR_INDEX: centro + 2 * cols + 3
  };
}

/** Route per edificio (come in app/edifici). */
const EDIFICIO_TO_ROUTE: Record<string, string> = {
  "Centro di Comando": "/amministrazione",
  "Serra": "/serra",
  "Centrale Energetica": "/centrale-energetica",
  "Raffineria Mineraria": "/raffineria-mineraria",
  "Impianto di Riciclo": "/impianto-riciclo",
  "Baracca": "/residenze",
  "Capanna": "/residenze",
  "Dormitorio": "/residenze",
  "Scuola": "/scuola",
  "Asilo": "/scuola",
  "Scuola Elementare": "/scuola",
  "Scuola Superiore": "/scuola",
  "Università": "/scuola",
  "Ospedale": "/ospedale",
  "Centrale": "/centrale",
  "Tribunale": "/tribunale",
  "Ufficio Immigrazione": "/immigrazione",
  "Ufficio Edile": "/ufficio-edile",
  "Mercato": "/mercato",
  "Dissalatore": "/dissalatore",
  "Laboratorio di Ricerca": "/laboratorio",
  "Bar": "/bar",
  "Mensa Pubblica": "/mensa",
  "Caserma": "/caserma",
  "Carcere": "/carcere",
  "Spazioporto": "/spazioporto"
};

type EdificioInCella = {
  id: number;
  nome: string;
  emoji: string;
  /** Istanza in useGameState (edifici) per residenze costruite o edifici con id non di catalogo. */
  edificioGlobaleId?: number;
  /** Indice dell'angolo in alto a sinistra dell'edificio multi-cella (solo sulle celle "schiena"). */
  footprintRef?: number;
  /** Solo sulla cella anchor: larghezza/altezza in celle del rettangolo. */
  footprint?: { w: number; h: number };
};

/** Fiumi come insieme di indici (per regole di piazzamento con cuscino). */
function riverSetDaTerreno(terreno: Record<number, TerrenoType>): Set<number> {
  const s = new Set<number>();
  for (const [k, v] of Object.entries(terreno)) {
    if (v === "river") s.add(Number(k));
  }
  return s;
}

/** Footprint costruzioni giocatore (allineato agli edifici procedurali iniziali). */
const FOOTPRINT_COSTRUZIONE: Record<string, { w: number; h: number }> = {
  Strada: { w: STRADA_FOOTPRINT_W, h: STRADA_FOOTPRINT_H },
  Serra: { w: SERRA_FOOTPRINT_W, h: SERRA_FOOTPRINT_H },
  Capanna: { w: CAPANNA_FOOTPRINT_W, h: CAPANNA_FOOTPRINT_H },
  Dormitorio: { w: DORMITORIO_FOOTPRINT_W, h: DORMITORIO_FOOTPRINT_H },
  Bar: { w: BAR_FOOTPRINT_W, h: BAR_FOOTPRINT_H },
  Tribunale: { w: TRIBUNALE_FOOTPRINT_W, h: TRIBUNALE_FOOTPRINT_H },
  "Ufficio Immigrazione": { w: UFFICIO_IMMIGRAZIONE_FOOTPRINT_W, h: UFFICIO_IMMIGRAZIONE_FOOTPRINT_H },
  "Ufficio Edile": { w: UFFICIO_EDILE_FOOTPRINT_W, h: UFFICIO_EDILE_FOOTPRINT_H },
  Mercato: { w: MERCATO_FOOTPRINT_W, h: MERCATO_FOOTPRINT_H },
  Negozio: { w: NEGOZIO_FOOTPRINT_W, h: NEGOZIO_FOOTPRINT_H },
  "Mensa Pubblica": { w: MERCATO_FOOTPRINT_W, h: MERCATO_FOOTPRINT_H },
  Dissalatore: { w: DISSALATORE_FOOTPRINT_W, h: DISSALATORE_FOOTPRINT_H },
  Spazioporto: { w: SPAZIOPORTO_FOOTPRINT_W, h: SPAZIOPORTO_FOOTPRINT_H },
  "Luogo di Culto del Sole": { w: 2, h: 2 },
  "Luogo di Culto degli Alieni": { w: 2, h: 2 },
  Carcere: { w: 2, h: 2 },
  "Campo di Lavoro": { w: 2, h: 2 },
  "Campo di Sterminio": { w: 2, h: 2 }
};

/** Sabbia = terreno sabbia su terraferma (non mare). */
function cellaÈSabbiaDissalatore(
  index: number,
  terrenoInMappa: Record<number, TerrenoType>,
  cols: number,
  rows: number
): boolean {
  if (isAcqua(index, cols, rows)) return false;
  return (terrenoInMappa[index] ?? "erba") === "sabbia";
}

/**
 * Rettangolo 2×2 con esattamente 2 celle sul mare (bordo mappa) e 2 sulla sabbia; niente fiume né edifici.
 */
function footprintDissalatoreMareSabbiaValido(
  anchor: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, EdificioInCella>
): boolean {
  const w = DISSALATORE_FOOTPRINT_W;
  const h = DISSALATORE_FOOTPRINT_H;
  const ac = anchor % cols;
  const ar = Math.floor(anchor / cols);
  if (ac + w > cols || ar + h > rows) return false;
  const celle = getIndiciFootprint(anchor, w, h, cols);
  let nMare = 0;
  let nSabbia = 0;
  for (const i of celle) {
    if (edificiInMappa[i]) return false;
    const t = terrenoInMappa[i] ?? "erba";
    if (t === "river") return false;
    if (isAcqua(i, cols, rows)) nMare++;
    else if (cellaÈSabbiaDissalatore(i, terrenoInMappa, cols, rows)) nSabbia++;
    else return false;
  }
  return nMare === 2 && nSabbia === 2;
}

/** Cerca un ancoraggio 2×2 valido per il Dissalatore, partendo dalla cella toccata. */
function trovaAnchorDissalatore(
  preferredCell: number,
  edificiInMappa: Record<number, EdificioInCella>,
  terrenoInMappa: Record<number, TerrenoType>,
  cols: number,
  rows: number
): number | null {
  const w = DISSALATORE_FOOTPRINT_W;
  const h = DISSALATORE_FOOTPRINT_H;
  const pc = preferredCell % cols;
  const pr = Math.floor(preferredCell / cols);
  const dist = (an: number) => {
    const aac = an % cols;
    const aar = Math.floor(an / cols);
    return Math.abs(aac - pc) + Math.abs(aar - pr);
  };
  const candidati = new Set<number>();
  for (let dr = 0; dr < h; dr++) {
    for (let dc = 0; dc < w; dc++) {
      const ac = pc - dc;
      const ar = pr - dr;
      if (ac < 0 || ar < 0) continue;
      if (ac + w > cols || ar + h > rows) continue;
      candidati.add(ar * cols + ac);
    }
  }
  const sortedNear = [...candidati].sort((a, b) => dist(a) - dist(b));
  for (const an of sortedNear) {
    if (footprintDissalatoreMareSabbiaValido(an, cols, rows, terrenoInMappa, edificiInMappa)) return an;
  }
  /** Solo ancore che includono la cella toccata: coerente con anteprima verde/rossa. */
  return null;
}

/** Scrive l'occupazione multi-cella sulla griglia (come aggiungiSerraFootprint ma con anchor già scelto). */
function applicaEdificioFootprintCostruzione(
  out: Record<number, EdificioInCella>,
  anchor: number,
  w: number,
  h: number,
  cols: number,
  base: { id: number; nome: string; emoji: string; edificioGlobaleId?: number }
): void {
  const celle = getIndiciFootprint(anchor, w, h, cols);
  if (w === 1 && h === 1) {
    out[anchor] = {
      id: base.id,
      nome: base.nome,
      emoji: base.emoji,
      edificioGlobaleId: base.edificioGlobaleId
    };
    return;
  }
  out[anchor] = {
    id: base.id,
    nome: base.nome,
    emoji: "",
    footprint: { w, h },
    edificioGlobaleId: base.edificioGlobaleId
  };
  for (const i of celle) {
    if (i === anchor) continue;
    out[i] = {
      id: base.id,
      nome: base.nome,
      emoji: "",
      footprintRef: anchor,
      edificioGlobaleId: base.edificioGlobaleId
    };
  }
}

/** Cella è acqua (blu) se true, altrimenti erba (verde). Bordi della mappa = mare. */
function isAcqua(index: number, cols: number, rows: number): boolean {
  const row = Math.floor(index / cols);
  const col = index % cols;
  return row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
}

/** Mare, fiume, sabbia o confine con acqua: nessuna cella strada (vedi {@link isCellaOkPerStrada}). */

function giacimentoIndicesDaEdifici(edificiInMappa: Record<number, EdificioInCella>): Set<number> {
  return new Set(
    Object.keys(edificiInMappa)
      .map(Number)
      .filter((i) => edificiInMappa[i]?.nome === "Giacimento")
  );
}

/** Dopo strade/fiumi: niente strada adiacente ad acqua o sabbia; erba costiera → sabbia. */
function applicaRegoleConfineTerreno(
  edificiInMappa: Record<number, EdificioInCella>,
  terrenoInMappa: Record<number, TerrenoType>,
  cols: number,
  rows: number,
  options?: { collegaEdificiAllaStrada?: boolean }
): void {
  const giacimenti = giacimentoIndicesDaEdifici(edificiInMappa);
  const collegaEdifici = options?.collegaEdificiAllaStrada ?? true;
  ensureStradaErbaTerrainBoundaryRules(
    edificiInMappa,
    terrenoInMappa,
    cols,
    rows,
    giacimenti,
    collegaEdifici
      ? (edifici, terreno, c, r) =>
          assicuraEdificiCollegatiDaStrada(edifici, terreno, c, r, STRADA_OPZIONE)
      : () => {}
  );
  applyTerrenoGrassAndSandContinuity(
    terrenoInMappa,
    cols,
    rows,
    buildExcludeSandByRoads(edificiInMappa, terrenoInMappa, cols, rows, giacimenti)
  );
  fillErbaEnclosedByWater(terrenoInMappa, cols, rows);
}

const GIACIMENTO: EdificioInCella = { id: 0, nome: "Giacimento", emoji: "⛰️" };
const RAFFINERIA_MINERARIA: EdificioInCella = { id: 3, nome: "Raffineria Mineraria", emoji: "⚙️" };
/** Opzione "Strada" per il dialog costruzione (cella diventa lastricato strada). */
const STRADA_OPZIONE: EdificioInCella = { id: -1, nome: "Strada", emoji: "🛤️" };

const DORMITORIO: EdificioInCella = { id: 14, nome: "Dormitorio", emoji: "🛏️" };
const BAR_EDIFICIO: EdificioInCella = { id: 17, nome: "Bar", emoji: "🍺" };
const TRIBUNALE_EDIFICIO: EdificioInCella = { id: 12, nome: "Tribunale", emoji: "⚖️" };
const SERRA_EDIFICIO: EdificioInCella = { id: 2, nome: "Serra", emoji: "🌱" };
const SERRA_2_EDIFICIO: EdificioInCella = { id: 21, nome: "Serra", emoji: "🌱" };
const CAPANNA: EdificioInCella = { id: 20, nome: "Capanna", emoji: "⛺" };

/** Emoji per decorazioni procedurali sulla mappa (alberi, palme, cactus, vulcano). */
const DECORAZIONI_EMOJI = ["🌳", "🌲", "🌴", "🌵", "🌋"] as const;

/** Indici di tutte le celle occupate da un footprint ancorato in `anchor`. */
function getIndiciFootprint(anchor: number, w: number, h: number, cols: number): number[] {
  const ac = anchor % cols;
  const ar = Math.floor(anchor / cols);
  const out: number[] = [];
  for (let dr = 0; dr < h; dr++) {
    for (let dc = 0; dc < w; dc++) {
      out.push((ar + dr) * cols + (ac + dc));
    }
  }
  return out;
}

function dimensioniFootprintEdificioInMappa(
  anchor: number,
  edificiInMappa: Record<number, EdificioInCella>
): { w: number; h: number } {
  const cap = edificiInMappa[anchor];
  if (!cap) return { w: 1, h: 1 };
  if (cap.footprint) return cap.footprint;
  return FOOTPRINT_COSTRUZIONE[cap.nome] ?? { w: 1, h: 1 };
}

function rimuoviFootprintEdificioDaMappa(
  out: Record<number, EdificioInCella>,
  anchor: number,
  w: number,
  h: number,
  cols: number
): void {
  for (const i of getIndiciFootprint(anchor, w, h, cols)) {
    delete out[i];
  }
}

/** Celle occupate dagli edifici presenti allo stato iniziale della mappa (non demolibili). */
function indiciFootprintProtettiIniziali(
  edificiIniziali: Record<number, EdificioInCella>,
  cols: number
): Set<number> {
  const protetti = new Set<number>();
  for (const idxStr of Object.keys(edificiIniziali)) {
    const idx = Number(idxStr);
    const e = edificiIniziali[idx];
    if (!e || e.footprintRef != null) continue;
    const { w, h } = dimensioniFootprintEdificioInMappa(idx, edificiIniziali);
    for (const i of getIndiciFootprint(idx, w, h, cols)) protetti.add(i);
  }
  return protetti;
}

/**
 * True se la cella fa parte dell’impronta di una residenza (Baracca, Capanna, Dormitorio).
 * Il passeggiatore sopra non deve rubare il doppio tap alla griglia (elenco residenti).
 */
function cellaÈNelFootprintResidenzaMappa(
  cellIndex: number,
  edificiInMappa: Record<number, EdificioInCella>,
  cols: number
): boolean {
  const e = edificiInMappa[cellIndex];
  if (!e || !èResidenzaMappa(e.nome)) return false;
  const anchor = getAnchorCellPerEdificio(cellIndex, edificiInMappa);
  const cap = edificiInMappa[anchor];
  if (!cap || !èResidenzaMappa(cap.nome)) return false;
  const w = cap.footprint?.w ?? 1;
  const h = cap.footprint?.h ?? 1;
  return getIndiciFootprint(anchor, w, h, cols).includes(cellIndex);
}

/** 8 vicini (ortogonali + diagonali). */
function getVicini8(index: number, cols: number, rows: number): number[] {
  const c = index % cols;
  const r = Math.floor(index / cols);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r2 = r + dr;
      const c2 = c + dc;
      if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
      out.push(r2 * cols + c2);
    }
  }
  return out;
}

function haVicinoFiume(index: number, riverSet: Set<number>, cols: number, rows: number): boolean {
  return getVicini8(index, cols, rows).some((n) => riverSet.has(n));
}

/**
 * Anello di celle intorno al rettangolo w×h (una cella in ogni direzione, inclusi gli obliqui).
 * Non include l'interno dell'edificio.
 */
function getIndiciCuscinoErba(anchor: number, w: number, h: number, cols: number, rows: number): number[] {
  const ac = anchor % cols;
  const ar = Math.floor(anchor / cols);
  const foot = new Set(getIndiciFootprint(anchor, w, h, cols));
  const out: number[] = [];
  for (let dr = -1; dr <= h; dr++) {
    for (let dc = -1; dc <= w; dc++) {
      const inside = dr >= 0 && dr < h && dc >= 0 && dc < w;
      if (inside) continue;
      const r = ar + dr;
      const c = ac + dc;
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
      const i = r * cols + c;
      if (!foot.has(i)) out.push(i);
    }
  }
  return out;
}

/** Cella adatta a “solo erba”: no mare, no fiume; se adiacente a un fiume diventerebbe sabbia → esclusa. */
function cellaSoloErba(index: number, cols: number, rows: number, riverSet: Set<number>): boolean {
  if (isAcqua(index, cols, rows) || riverSet.has(index)) return false;
  if (haVicinoFiume(index, riverSet, cols, rows)) return false;
  return true;
}

/**
 * `vietato` = unione (footprint ∪ cuscino) degli edifici già piazzati: il nuovo blocco
 * non può invadere quell'area (mantiene almeno un anello d'erba tra strutture).
 */
function puòPiazzareFootprintConCuscino(
  anchor: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>
): boolean {
  const ac = anchor % cols;
  const ar = Math.floor(anchor / cols);
  if (ac + w > cols || ar + h > rows) return false;
  for (let dr = 0; dr < h; dr++) {
    for (let dc = 0; dc < w; dc++) {
      const i = (ar + dr) * cols + (ac + dc);
      if (vietato.has(i) || isAcqua(i, cols, rows) || riverSet.has(i)) return false;
    }
  }
  for (const i of getIndiciCuscinoErba(anchor, w, h, cols, rows)) {
    if (vietato.has(i) || !cellaSoloErba(i, cols, rows, riverSet)) return false;
  }
  return true;
}

function estendiVietatoConFootprintECuscino(
  anchor: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  vietato: Set<number>
): void {
  for (const i of getIndiciFootprint(anchor, w, h, cols)) vietato.add(i);
  for (const i of getIndiciCuscinoErba(anchor, w, h, cols, rows)) vietato.add(i);
}

/** Primo angolo w×h con cuscino d'erba e rispetto di `vietato`, ordinato per vicinanza a `preferred`. */
function trovaAnchorFootprintLibero(
  w: number,
  h: number,
  preferred: number,
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>
): number | null {
  const pc = preferred % cols;
  const pr = Math.floor(preferred / cols);
  const candidati = Array.from({ length: cols * rows }, (_, i) => i).sort((a, b) => {
    const ar = Math.floor(a / cols);
    const ac = a % cols;
    const br = Math.floor(b / cols);
    const bc = b % cols;
    return Math.abs(ar - pr) + Math.abs(ac - pc) - (Math.abs(br - pr) + Math.abs(bc - pc));
  });
  for (const anchor of candidati) {
    if (puòPiazzareFootprintConCuscino(anchor, w, h, cols, rows, riverSet, vietato)) return anchor;
  }
  return null;
}

/** Singola cella edificio 1×1 con stesso cuscino e `vietato`. */
function trovaCellaSingolaConCuscino(
  preferred: number,
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>
): number | null {
  return trovaAnchorFootprintLibero(1, 1, preferred, cols, rows, riverSet, vietato);
}

/**
 * Angolo in alto a sinistra del blocco ADMIN_FOOTPRINT_W×H, scelto in modo deterministico:
 * tra tutti i rettangoli interamente su terra (non mare), quello col centro più vicino al "centro" mappa.
 * Va riservato ai fiumi prima di `generateRivers` così il 3×2 resta sempre libero.
 */
function scegliAnchorComplessoAmministrativo(cols: number, rows: number): number {
  const idx = getIndiciEdificiIniziali(cols, rows);
  const preferred = idx.CENTRO_COMANDO_INDEX;
  const pc = preferred % cols;
  const pr = Math.floor(preferred / cols);
  const w = ADMIN_FOOTPRINT_W;
  const h = ADMIN_FOOTPRINT_H;
  const minR = 1;
  const maxR = rows - 2 - h;
  const minC = 1;
  const maxC = cols - 2 - w;
  let bestAnchor = preferred;
  let bestD = Infinity;
  const vietatoVuoto = new Set<number>();
  const fiumiVuoti = new Set<number>();
  for (let ar = minR; ar <= maxR; ar++) {
    for (let ac = minC; ac <= maxC; ac++) {
      const anchor = ar * cols + ac;
      if (!puòPiazzareFootprintConCuscino(anchor, w, h, cols, rows, fiumiVuoti, vietatoVuoto)) continue;
      const d = Math.abs(ar - pr) + Math.abs(ac - pc);
      if (d < bestD) {
        bestD = d;
        bestAnchor = anchor;
      }
    }
  }
  return bestAnchor;
}

/** Complesso amministrativo: rettangolo 3×2 (6 celle), `anchor` già riservato ai fiumi. */
function aggiungiComplessoAmministrativo(
  cols: number,
  rows: number,
  out: Record<number, EdificioInCella>,
  anchor: number
): void {
  const w = ADMIN_FOOTPRINT_W;
  const h = ADMIN_FOOTPRINT_H;
  const celle = getIndiciFootprint(anchor, w, h, cols);
  const anchorEd: EdificioInCella = {
    id: 1,
    nome: "Centro di Comando",
    emoji: "🏛️",
    footprint: { w, h }
  };
  out[anchor] = anchorEd;
  for (const i of celle) {
    if (i === anchor) continue;
    out[i] = { id: 1, nome: "Centro di Comando", emoji: "", footprintRef: anchor };
  }
}

function aggiungiDormitorioFootprint(
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>,
  out: Record<number, EdificioInCella>,
  preferred: number
): void {
  const w = DORMITORIO_FOOTPRINT_W;
  const h = DORMITORIO_FOOTPRINT_H;
  const anchor = trovaAnchorFootprintLibero(w, h, preferred, cols, rows, riverSet, vietato);
  if (anchor == null) {
    const cell = trovaCellaSingolaConCuscino(preferred, cols, rows, riverSet, vietato);
    if (cell != null) {
      out[cell] = { ...DORMITORIO };
      estendiVietatoConFootprintECuscino(cell, 1, 1, cols, rows, vietato);
    }
    return;
  }
  const celle = getIndiciFootprint(anchor, w, h, cols);
  out[anchor] = {
    id: DORMITORIO.id,
    nome: DORMITORIO.nome,
    emoji: "",
    footprint: { w, h }
  };
  for (const i of celle) {
    if (i === anchor) continue;
    out[i] = { id: DORMITORIO.id, nome: DORMITORIO.nome, emoji: "", footprintRef: anchor };
  }
  estendiVietatoConFootprintECuscino(anchor, w, h, cols, rows, vietato);
}

function aggiungiBarFootprint(
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>,
  out: Record<number, EdificioInCella>,
  preferred: number
): void {
  const w = BAR_FOOTPRINT_W;
  const h = BAR_FOOTPRINT_H;
  const anchor = trovaAnchorFootprintLibero(w, h, preferred, cols, rows, riverSet, vietato);
  if (anchor == null) {
    const cell = trovaCellaSingolaConCuscino(preferred, cols, rows, riverSet, vietato);
    if (cell != null) {
      out[cell] = { ...BAR_EDIFICIO };
      estendiVietatoConFootprintECuscino(cell, 1, 1, cols, rows, vietato);
    }
    return;
  }
  const celle = getIndiciFootprint(anchor, w, h, cols);
  out[anchor] = {
    id: BAR_EDIFICIO.id,
    nome: BAR_EDIFICIO.nome,
    emoji: "",
    footprint: { w, h }
  };
  for (const i of celle) {
    if (i === anchor) continue;
    out[i] = { id: BAR_EDIFICIO.id, nome: BAR_EDIFICIO.nome, emoji: "", footprintRef: anchor };
  }
  estendiVietatoConFootprintECuscino(anchor, w, h, cols, rows, vietato);
}

function aggiungiTribunaleFootprint(
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>,
  out: Record<number, EdificioInCella>,
  preferred: number
): void {
  const w = TRIBUNALE_FOOTPRINT_W;
  const h = TRIBUNALE_FOOTPRINT_H;
  const anchor = trovaAnchorFootprintLibero(w, h, preferred, cols, rows, riverSet, vietato);
  if (anchor == null) {
    const cell = trovaCellaSingolaConCuscino(preferred, cols, rows, riverSet, vietato);
    if (cell != null) {
      out[cell] = { ...TRIBUNALE_EDIFICIO };
      estendiVietatoConFootprintECuscino(cell, 1, 1, cols, rows, vietato);
    }
    return;
  }
  const celle = getIndiciFootprint(anchor, w, h, cols);
  out[anchor] = {
    id: TRIBUNALE_EDIFICIO.id,
    nome: TRIBUNALE_EDIFICIO.nome,
    emoji: "",
    footprint: { w, h }
  };
  for (const i of celle) {
    if (i === anchor) continue;
    out[i] = {
      id: TRIBUNALE_EDIFICIO.id,
      nome: TRIBUNALE_EDIFICIO.nome,
      emoji: "",
      footprintRef: anchor
    };
  }
  estendiVietatoConFootprintECuscino(anchor, w, h, cols, rows, vietato);
}

function aggiungiSerraFootprint(
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>,
  out: Record<number, EdificioInCella>,
  preferred: number,
  spec: EdificioInCella
): void {
  const w = SERRA_FOOTPRINT_W;
  const h = SERRA_FOOTPRINT_H;
  const anchor = trovaAnchorFootprintLibero(w, h, preferred, cols, rows, riverSet, vietato);
  if (anchor == null) {
    const cell = trovaCellaSingolaConCuscino(preferred, cols, rows, riverSet, vietato);
    if (cell != null) {
      out[cell] = { ...spec };
      estendiVietatoConFootprintECuscino(cell, 1, 1, cols, rows, vietato);
    }
    return;
  }
  const celle = getIndiciFootprint(anchor, w, h, cols);
  out[anchor] = {
    id: spec.id,
    nome: spec.nome,
    emoji: "",
    footprint: { w, h }
  };
  for (const i of celle) {
    if (i === anchor) continue;
    out[i] = {
      id: spec.id,
      nome: spec.nome,
      emoji: "",
      footprintRef: anchor
    };
  }
  estendiVietatoConFootprintECuscino(anchor, w, h, cols, rows, vietato);
}

const SPAZIOPORTO_EDIFICIO: EdificioInCella = { id: 19, nome: "Spazioporto", emoji: "🚀" };

function aggiungiSpazioportoFootprint(
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>,
  out: Record<number, EdificioInCella>,
  preferred: number
): void {
  const w = SPAZIOPORTO_FOOTPRINT_W;
  const h = SPAZIOPORTO_FOOTPRINT_H;
  const anchor = trovaAnchorFootprintLibero(w, h, preferred, cols, rows, riverSet, vietato);
  if (anchor == null) {
    const cell = trovaCellaSingolaConCuscino(preferred, cols, rows, riverSet, vietato);
    if (cell != null) {
      out[cell] = { ...SPAZIOPORTO_EDIFICIO };
      estendiVietatoConFootprintECuscino(cell, 1, 1, cols, rows, vietato);
    }
    return;
  }
  const celle = getIndiciFootprint(anchor, w, h, cols);
  out[anchor] = {
    id: SPAZIOPORTO_EDIFICIO.id,
    nome: SPAZIOPORTO_EDIFICIO.nome,
    emoji: "",
    footprint: { w, h }
  };
  for (const i of celle) {
    if (i === anchor) continue;
    out[i] = {
      id: SPAZIOPORTO_EDIFICIO.id,
      nome: SPAZIOPORTO_EDIFICIO.nome,
      emoji: "",
      footprintRef: anchor
    };
  }
  estendiVietatoConFootprintECuscino(anchor, w, h, cols, rows, vietato);
}

/** Restituisce edifici iniziali fissi, spostati su terra (no fiume, no mare); nessuna cella condivisa. */
function getEdificiIniziali(
  cols: number,
  rows: number,
  riverSet: Set<number>,
  adminAnchor: number
): Record<number, EdificioInCella> {
  const idx = getIndiciEdificiIniziali(cols, rows);
  const out: Record<number, EdificioInCella> = {};
  /** Footprint ∪ cuscino d'erba degli edifici già piazzati. */
  const vietato = new Set<number>();

  aggiungiComplessoAmministrativo(cols, rows, out, adminAnchor);
  estendiVietatoConFootprintECuscino(adminAnchor, ADMIN_FOOTPRINT_W, ADMIN_FOOTPRINT_H, cols, rows, vietato);

  aggiungiSpazioportoFootprint(cols, rows, riverSet, vietato, out, idx.SPAZIOPORTO_INDEX);

  aggiungiSerraFootprint(cols, rows, riverSet, vietato, out, idx.SERRA_INDEX, SERRA_EDIFICIO);
  aggiungiSerraFootprint(cols, rows, riverSet, vietato, out, idx.SERRA_2_INDEX, SERRA_2_EDIFICIO);

  aggiungiDormitorioFootprint(cols, rows, riverSet, vietato, out, idx.DORMITORIO_1_INDEX);
  aggiungiDormitorioFootprint(cols, rows, riverSet, vietato, out, idx.DORMITORIO_2_INDEX);
  aggiungiDormitorioFootprint(cols, rows, riverSet, vietato, out, idx.DORMITORIO_3_INDEX);

  aggiungiTribunaleFootprint(cols, rows, riverSet, vietato, out, idx.TRIBUNALE_INDEX);

  aggiungiBarFootprint(cols, rows, riverSet, vietato, out, idx.BAR_INDEX);

  return out;
}

/** Footprint ∪ cuscino d'erba (8 direzioni) per ogni edificio iniziale ancorato: evita capanne/giacimenti sul verde riservato. */
function vietatoFootprintECuscinoDaEdificiIniziali(
  edifici: Record<number, EdificioInCella>,
  cols: number,
  rows: number
): Set<number> {
  const vietato = new Set<number>();
  for (const idxStr of Object.keys(edifici)) {
    const idx = Number(idxStr);
    const e = edifici[idx];
    if (e.footprintRef != null) continue;
    if (e.footprint) {
      estendiVietatoConFootprintECuscino(idx, e.footprint.w, e.footprint.h, cols, rows, vietato);
    } else {
      estendiVietatoConFootprintECuscino(idx, 1, 1, cols, rows, vietato);
    }
  }
  return vietato;
}

/** Anteprima piazzamento in modalità Costruisci (stessa logica di `handleScegliEdificio`). */
type SelezioneCostruzioneAnteprima =
  | { tipo: "strada" }
  | { tipo: "terreno"; kind: TerrenoCostruzioneKind }
  | { tipo: "edificio"; edificio: Edificio };

/** Strada / Acqua / Spiaggia / Erba: la modalità resta attiva fino a un secondo tap su Costruisci. */
function costruzioneTerrenoPersistente(selezione: SelezioneCostruzioneAnteprima | null): boolean {
  return selezione?.tipo === "strada" || selezione?.tipo === "terreno";
}

/** Anchor 2×2 che contiene `cellIndex` (Acqua / Spiaggia / Erba). */
function calcolaAnchorCostruzione2x2(
  cellIndex: number,
  cols: number,
  rows: number
): { anchor: number | null; w: number; h: number } {
  return calcolaAnchorStrada2x2(cellIndex, cols, rows);
}

function footprintTerreno2x2Valido(
  kind: TerrenoCostruzioneKind,
  anchor: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, EdificioInCella>
): boolean {
  const celle = getIndiciFootprint(anchor, COSTRUZIONE_TERRENO_FOOTPRINT_W, COSTRUZIONE_TERRENO_FOOTPRINT_H, cols);
  for (const i of celle) {
    if (edificiInMappa[i]) return false;
    if (kind === "acqua") {
      if (isAcqua(i, cols, rows)) continue;
      const t = terrenoInMappa[i] ?? "erba";
      if (t === "river") continue;
      if (t === "sabbia" || t === "erba") continue;
      return false;
    }
    if (kind === "spiaggia") {
      if (isTerrenoAcqua(i, terrenoInMappa, cols, rows)) return false;
      continue;
    }
    if (isTerrenoAcqua(i, terrenoInMappa, cols, rows)) return false;
  }
  return true;
}

/** Verifica che l’anchor rispetti le stesse regole usate per costruire (anteprima verde solo se true). */
function edificioRispettaCriteriPiazzamento(
  nomeEdificio: string,
  anchor: number,
  w: number,
  h: number,
  edificiInMappa: Record<number, EdificioInCella>,
  terrenoInMappa: Record<number, TerrenoType>,
  cols: number,
  rows: number
): boolean {
  if (nomeEdificio === "Dissalatore") {
    return footprintDissalatoreMareSabbiaValido(anchor, cols, rows, terrenoInMappa, edificiInMappa);
  }
  const riverSet = riverSetDaTerreno(terrenoInMappa);
  const vietato = vietatoFootprintECuscinoDaEdificiIniziali(edificiInMappa, cols, rows);
  return puòPiazzareFootprintConCuscino(anchor, w, h, cols, rows, riverSet, vietato);
}

/** Stessa ricerca anchor usata in `handleScegliEdificio` per edifici multi-cella. */
function calcolaAnchorEdificioMultiCella(
  cellIndex: number,
  nomeEdificio: string,
  edificiInMappa: Record<number, EdificioInCella>,
  terrenoInMappa: Record<number, TerrenoType>,
  cols: number,
  rows: number
): { anchor: number | null; w: number; h: number } {
  const dim = FOOTPRINT_COSTRUZIONE[nomeEdificio] ?? { w: 1, h: 1 };
  const w = dim.w;
  const h = dim.h;
  if (nomeEdificio === "Dissalatore") {
    const anchor = trovaAnchorDissalatore(cellIndex, edificiInMappa, terrenoInMappa, cols, rows);
    return { anchor, w, h };
  }
  const riverSet = riverSetDaTerreno(terrenoInMappa);
  const vietato = vietatoFootprintECuscinoDaEdificiIniziali(edificiInMappa, cols, rows);
  let anchor: number | null = null;
  if (puòPiazzareFootprintConCuscino(cellIndex, w, h, cols, rows, riverSet, vietato)) {
    anchor = cellIndex;
  } else {
    anchor = trovaAnchorFootprintLibero(w, h, cellIndex, cols, rows, riverSet, vietato);
  }
  return { anchor, w, h };
}

function calcolaPreviewPiazzamento(
  selezione: SelezioneCostruzioneAnteprima,
  hoverCell: number | null,
  edificiInMappa: Record<number, EdificioInCella>,
  terrenoInMappa: Record<number, TerrenoType>,
  cols: number,
  rows: number
): { celle: number[]; valido: boolean } | null {
  if (hoverCell == null) return null;
  if (selezione.tipo === "strada" || selezione.tipo === "terreno") {
    const { anchor, w, h } = calcolaAnchorCostruzione2x2(hoverCell, cols, rows);
    if (anchor == null) {
      return { celle: [hoverCell], valido: false };
    }
    const celle = getIndiciFootprint(anchor, w, h, cols);
    const valido =
      selezione.tipo === "strada"
        ? footprintStrada2x2Valido(anchor, cols, rows, terrenoInMappa, edificiInMappa)
        : footprintTerreno2x2Valido(
            selezione.kind,
            anchor,
            cols,
            rows,
            terrenoInMappa,
            edificiInMappa
          );
    return { celle, valido };
  }
  const e = selezione.edificio;
  const { anchor, w, h } = calcolaAnchorEdificioMultiCella(
    hoverCell,
    e.nome,
    edificiInMappa,
    terrenoInMappa,
    cols,
    rows
  );
  if (anchor == null) {
    const ac = hoverCell % cols;
    const ar = Math.floor(hoverCell / cols);
    if (ac + w > cols || ar + h > rows) {
      return { celle: [hoverCell], valido: false };
    }
    return { celle: getIndiciFootprint(hoverCell, w, h, cols), valido: false };
  }
  const celle = getIndiciFootprint(anchor, w, h, cols);
  const valido = edificioRispettaCriteriPiazzamento(
    e.nome,
    anchor,
    w,
    h,
    edificiInMappa,
    terrenoInMappa,
    cols,
    rows
  );
  return { celle, valido };
}

/** Capanne 2×1 (o 1×1 se non c’è spazio) e giacimenti 1×1 senza sovrapposizioni al buffer d’erba. */
function piazzaCapanneEgiacimentiProcedurali(
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietatoBase: Set<number>,
  shuffled: number[],
  nCapanne: number,
  nGiacimento: number
): { capanne: Record<number, EdificioInCella>; giacimenti: Record<number, EdificioInCella> } {
  const occupato = new Set(vietatoBase);
  const capanne: Record<number, EdificioInCella> = {};
  let placedC = 0;
  const w = CAPANNA_FOOTPRINT_W;
  const h = CAPANNA_FOOTPRINT_H;

  for (const pref of shuffled) {
    if (placedC >= nCapanne) break;
    const anchor = trovaAnchorFootprintLibero(w, h, pref, cols, rows, riverSet, occupato);
    if (anchor != null) {
      const celle = getIndiciFootprint(anchor, w, h, cols);
      capanne[anchor] = {
        id: CAPANNA.id,
        nome: CAPANNA.nome,
        emoji: "",
        footprint: { w, h }
      };
      for (const i of celle) {
        if (i === anchor) continue;
        capanne[i] = {
          id: CAPANNA.id,
          nome: CAPANNA.nome,
          emoji: "",
          footprintRef: anchor
        };
      }
      estendiVietatoConFootprintECuscino(anchor, w, h, cols, rows, occupato);
      placedC++;
      continue;
    }
    const cell = trovaCellaSingolaConCuscino(pref, cols, rows, riverSet, occupato);
    if (cell != null) {
      capanne[cell] = { ...CAPANNA };
      estendiVietatoConFootprintECuscino(cell, 1, 1, cols, rows, occupato);
      placedC++;
    }
  }

  const poolGi: number[] = [];
  const tot = cols * rows;
  for (let i = 0; i < tot; i++) {
    if (isAcqua(i, cols, rows) || riverSet.has(i) || occupato.has(i)) continue;
    poolGi.push(i);
  }
  poolGi.sort(() => Math.random() - 0.5);
  const giacimenti: Record<number, EdificioInCella> = {};
  const nG = Math.min(nGiacimento, poolGi.length);
  for (let k = 0; k < nG; k++) {
    giacimenti[poolGi[k]!] = GIACIMENTO;
  }
  return { capanne, giacimenti };
}

/** Restituisce lo stato iniziale della mappa; esclude sempre acqua e fiumi dalle celle edificabili. */
function getInitialEdificiInMappa(
  cols: number,
  rows: number,
  riverSet: Set<number>,
  adminAnchor: number
): Record<number, EdificioInCella> {
  const edificiIniziali = getEdificiIniziali(cols, rows, riverSet, adminAnchor);
  const totaleCelle = cols * rows;
  const vietatoEdifici = vietatoFootprintECuscinoDaEdificiIniziali(edificiIniziali, cols, rows);
  const erbaLibera: number[] = [];
  for (let i = 0; i < totaleCelle; i++) {
    if (!isAcqua(i, cols, rows) && !riverSet.has(i) && !vietatoEdifici.has(i)) erbaLibera.push(i);
  }
  const shuffled = [...erbaLibera].sort(() => Math.random() - 0.5);
  const nCapanne = 5 + Math.floor(Math.random() * 5);
  const nGiacimento = 2 + Math.floor(Math.random() * 4);
  const { capanne, giacimenti } = piazzaCapanneEgiacimentiProcedurali(
    cols,
    rows,
    riverSet,
    vietatoEdifici,
    shuffled,
    nCapanne,
    nGiacimento
  );
  return { ...edificiIniziali, ...capanne, ...giacimenti };
}

/**
 * Stato iniziale mappa. Ordine: edifici → strade → fiumi/sabbia → confini acqua → decorazioni.
 * Eseguito in fasi async così la UI può mostrare l’avanzamento.
 */
export type { MappaRuntimeState } from "../src/game/mappaTypes";

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

async function buildInitialMappa(
  cols: number,
  rows: number,
  onProgress: (progress: number, label: string) => void
): Promise<MappaRuntimeState> {
  const report = async (progress: number, label: string) => {
    onProgress(progress, label);
    await yieldToUi();
  };

  await report(0, "Preparazione del mondo…");

  const totaleCelle = cols * rows;
  const borderIndices = new Set<number>();
  for (let i = 0; i < totaleCelle; i++) if (isAcqua(i, cols, rows)) borderIndices.add(i);
  const adminAnchor = scegliAnchorComplessoAmministrativo(cols, rows);

  await report(12, "Posizionamento edifici…");
  const edificiInMappa = getInitialEdificiInMappa(cols, rows, new Set(), adminAnchor);
  const terrenoInMappa: Record<number, TerrenoType> = {};

  await report(28, "Costruzione della rete stradale…");
  piazzaStradeInizialiTraEdifici(edificiInMappa, terrenoInMappa, cols, rows);
  assicuraEdificiCollegatiDaStrada(edificiInMappa, terrenoInMappa, cols, rows, STRADA_OPZIONE);

  await report(48, "Generazione fiumi e coste…");
  const vietatoPerFiumi = new Set<number>([...borderIndices, ...Object.keys(edificiInMappa).map(Number)]);
  const { riverIndices, sandIndices } = generateRivers({
    cols,
    rows,
    numSources: 2 + Math.floor(Math.random() * 2),
    maxLength: 60,
    bifurcationProbability: 0.1,
    forbiddenIndices: vietatoPerFiumi
  });
  const riverSet = new Set(riverIndices);

  const giacimentoIndices = new Set(
    Object.keys(edificiInMappa)
      .map(Number)
      .filter((i) => edificiInMappa[i]?.nome === "Giacimento")
  );
  const excludeSand = new Set<number>(giacimentoIndices);
  for (const j of indiciViciniOrtogonaliStrada(edificiInMappa, cols, rows)) {
    excludeSand.add(j);
  }
  Object.assign(terrenoInMappa, buildTerrenoFromRivers(riverIndices, sandIndices, excludeSand));

  await report(68, "Rifinitura terreno e confini…");
  applyTerrenoGrassAndSandContinuity(terrenoInMappa, cols, rows, excludeSand);
  applicaRegoleConfineTerreno(edificiInMappa, terrenoInMappa, cols, rows);

  await report(86, "Distribuzione decorazioni…");
  const celleLibere: number[] = [];
  for (let i = 0; i < totaleCelle; i++) {
    if (isAcqua(i, cols, rows) || riverSet.has(i) || edificiInMappa[i]) continue;
    celleLibere.push(i);
  }
  const shuffled = [...celleLibere].sort(() => Math.random() - 0.5);
  const numDecorazioni = Math.min(shuffled.length, 60 + Math.floor(Math.random() * 80));
  const decorazioniInMappa: Record<number, string> = {};
  for (let k = 0; k < numDecorazioni; k++) {
    const idx = shuffled[k]!;
    decorazioniInMappa[idx] = DECORAZIONI_EMOJI[Math.floor(Math.random() * DECORAZIONI_EMOJI.length)]!;
  }

  await report(100, "Mondo pronto!");
  return { edificiInMappa, terrenoInMappa, decorazioniInMappa, residenzeMappa: {} };
}

/**
 * Cache fuori dal ciclo di vita di React: quando si esce dalla mappa (es. /amministrazione) e si torna
 * con `replace("/")`, il componente si rimonta; senza questo, `useState` rigenererebbe fiumi e decorazioni.
 */

const CIELO_ALPHA_NOTTE_MAX = 0.52;
const CIELO_ALPHA_CALORE_TRAMONTO_MAX = 0.26;

/** Coppie [indiceA, indiceB] per strade iniziali (anchor centro → spazioporto, serra); usa le posizioni effettive degli edifici. */
function getStradeIniziali(edificiInMappa: Record<number, EdificioInCella>): [number, number][] {
  let centro: number | null = null;
  let spazioporto: number | null = null;
  let bar: number | null = null;
  let tribunale: number | null = null;
  const serre: number[] = [];
  for (const [i, e] of Object.entries(edificiInMappa)) {
    const idx = Number(i);
    if (e.nome === "Centro di Comando" && e.footprint && !e.footprintRef) centro = idx;
    if (e.nome === "Spazioporto" && e.footprint && !e.footprintRef) spazioporto = idx;
    if (e.nome === "Serra" && e.footprint && !e.footprintRef) serre.push(idx);
    if (e.nome === "Bar" && e.footprint && !e.footprintRef) bar = idx;
    if (e.nome === "Tribunale" && e.footprint && !e.footprintRef) tribunale = idx;
  }
  const out: [number, number][] = [];
  if (centro != null && spazioporto != null) out.push([centro, spazioporto]);
  if (centro != null) {
    for (const sa of serre) out.push([centro, sa]);
  }
  if (centro != null && tribunale != null) out.push([centro, tribunale]);
  if (centro != null && bar != null) out.push([centro, bar]);
  return out;
}

function rimuoviAbitanteDaTuttiBar(
  prev: Record<number, number[]>,
  abitanteId: number
): Record<number, number[]> {
  const next: Record<number, number[]> = {};
  for (const [k, ids] of Object.entries(prev)) {
    const filt = ids.filter((id) => id !== abitanteId);
    if (filt.length > 0) next[Number(k)] = filt;
  }
  return next;
}

function aggiungiAbitanteAlBarEdificio(
  prev: Record<number, number[]>,
  barEdificioId: number,
  abitanteId: number
): Record<number, number[]> {
  const cleaned = rimuoviAbitanteDaTuttiBar(prev, abitanteId);
  const cur = cleaned[barEdificioId] ?? [];
  if (cur.includes(abitanteId)) return cleaned;
  return { ...cleaned, [barEdificioId]: [...cur, abitanteId] };
}

/** Angolo in alto a sinistra della cella in px (per overlay edifici multi-cella). */
function getCellTopLeft(cellIndex: number, cellW: number, cellH: number, cols: number): { left: number; top: number } {
  const col = cellIndex % cols;
  const row = Math.floor(cellIndex / cols);
  return { left: col * (cellW + GAP), top: row * (cellH + GAP) };
}

type CommutePurpose = "work" | "bar" | "home" | "mensa" | "culto" | "negozio" | "rapina" | "cerca_lavoro";

type CommuteInfo = {
  path: number[];
  token: number;
  purpose: CommutePurpose;
  barEdificioId?: number;
  mensaEdificioId?: number;
  cultoEdificioId?: number;
  negozioEdificioId?: number;
  lavoroCercaEdificioId?: number;
  rapinaTarget?: RapinaTarget;
};

type FootprintVariant =
  | "amministrazione"
  | "dormitorio"
  | "bar"
  | "tribunale"
  | "ufficio_immigrazione"
  | "ufficio_edile"
  | "mercato"
  | "negozio"
  | "mensa"
  | "dissalatore"
  | "spazioporto"
  | "serra"
  | "capanna"
  | "luogo_culto_sole"
  | "luogo_culto_alieni"
  | "carcere"
  | "campo_lavoro"
  | "campo_sterminio"
  | "caserma"
  | "centrale_polizia"
  | "cantiere";

function EdificioFootprintGfx({
  anchor,
  footprint,
  variant,
  cols,
  cellW,
  cellH,
  progressoCostruzione
}: {
  anchor: number;
  footprint: { w: number; h: number };
  variant: FootprintVariant;
  cols: number;
  cellW: number;
  cellH: number;
  progressoCostruzione?: number;
}) {
  const { left, top } = getCellTopLeft(anchor, cellW, cellH, cols);
  const { w, h } = footprint;
  const width = w * cellW + (w - 1) * GAP;
  const height = h * cellH + (h - 1) * GAP;
  const porticoH = Math.max(6, Math.floor(cellH * 0.22));

  if (variant === "cantiere") {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintCantiere width={width} height={height} progresso={progressoCostruzione} />
      </View>
    );
  }

  if (variant === "dormitorio" && w === DORMITORIO_FOOTPRINT_W && h === DORMITORIO_FOOTPRINT_H) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintDorm2x2 width={width} height={height} />
      </View>
    );
  }

  if (variant === "bar" && w === BAR_FOOTPRINT_W && h === BAR_FOOTPRINT_H) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintBar2x2 width={width} height={height} />
      </View>
    );
  }

  if (variant === "tribunale" && w === TRIBUNALE_FOOTPRINT_W && h === TRIBUNALE_FOOTPRINT_H) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintTribunale2x2 width={width} height={height} />
      </View>
    );
  }

  if (variant === "luogo_culto_sole" && w === 2 && h === 2) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintLuogoCultoSole2x2 width={width} height={height} />
      </View>
    );
  }

  if (variant === "luogo_culto_alieni" && w === 2 && h === 2) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintLuogoCultoAlieni2x2 width={width} height={height} />
      </View>
    );
  }

  if (variant === "carcere" && w === 2 && h === 2) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintCarcere2x2 width={width} height={height} />
      </View>
    );
  }

  if (variant === "campo_lavoro" && w === 2 && h === 2) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintCampoLavoro2x2 width={width} height={height} />
      </View>
    );
  }

  if (variant === "campo_sterminio" && w === 2 && h === 2) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintCampoSterminio2x2 width={width} height={height} />
      </View>
    );
  }

  if (variant === "caserma" && w === 2 && h === 2) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintCaserma2x2 width={width} height={height} />
      </View>
    );
  }

  if (variant === "centrale_polizia" && w === 2 && h === 2) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintCentralePolizia2x2 width={width} height={height} />
      </View>
    );
  }

  if (variant === "ufficio_immigrazione" && w === UFFICIO_IMMIGRAZIONE_FOOTPRINT_W && h === UFFICIO_IMMIGRAZIONE_FOOTPRINT_H) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintUfficioImmigrazione2x2 width={width} height={height} />
      </View>
    );
  }

  if (variant === "ufficio_edile" && w === UFFICIO_EDILE_FOOTPRINT_W && h === UFFICIO_EDILE_FOOTPRINT_H) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintUfficioEdile2x2 width={width} height={height} />
      </View>
    );
  }

  if (variant === "mercato" && w === MERCATO_FOOTPRINT_W && h === MERCATO_FOOTPRINT_H) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintMercato2x2 width={width} height={height} />
      </View>
    );
  }

  if (variant === "negozio" && w === NEGOZIO_FOOTPRINT_W && h === NEGOZIO_FOOTPRINT_H) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintNegozio2x2 width={width} height={height} />
      </View>
    );
  }

  if (variant === "mensa" && w === MERCATO_FOOTPRINT_W && h === MERCATO_FOOTPRINT_H) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintMercato2x2 width={width} height={height} />
      </View>
    );
  }

  if (variant === "dissalatore" && w === DISSALATORE_FOOTPRINT_W && h === DISSALATORE_FOOTPRINT_H) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintDissalatore2x2 width={width} height={height} />
      </View>
    );
  }

  if (variant === "spazioporto" && w === SPAZIOPORTO_FOOTPRINT_W && h === SPAZIOPORTO_FOOTPRINT_H) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintSpazioporto4x3 width={width} height={height} />
      </View>
    );
  }

  if (variant === "serra" && w === SERRA_FOOTPRINT_W && h === SERRA_FOOTPRINT_H) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintSerra2x1 width={width} height={height} />
      </View>
    );
  }

  if (variant === "capanna" && w === CAPANNA_FOOTPRINT_W && h === CAPANNA_FOOTPRINT_H) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintCapanna2x1 width={width} height={height} />
      </View>
    );
  }

  if (w === ADMIN_FOOTPRINT_W && h === ADMIN_FOOTPRINT_H) {
    return (
      <View style={[styles.footprintAbsolute, { left, top, width, height }]} pointerEvents="none">
        <RpgFootprintAdmin3x2 width={width} height={height} />
      </View>
    );
  }

  return (
    <View style={[styles.footprintBlock, { left, top, width, height }]} pointerEvents="none">
      {Array.from({ length: h }, (_, row) => (
        <View key={`r-${row}`} style={styles.footprintRow}>
          {Array.from({ length: w }, (_, col) => (
            <View
              key={`c-${row}-${col}`}
              style={[styles.footprintTile, { backgroundColor: row === 0 ? "#52525b" : "#a68462" }]}
            />
          ))}
        </View>
      ))}
      <View style={[styles.footprintPortico, { height: porticoH }]} pointerEvents="none" />
    </View>
  );
}

/**
 * Tra due celle sulla stessa riga o colonna, restituisce solo coppie adiacenti (un passo ortogonale per segmento).
 * Non restituisce mai un singolo segmento che "salta" più celle.
 */
function expandAxisToUnitSteps(from: number, to: number, cols: number): [number, number][] {
  const c1 = from % cols;
  const r1 = Math.floor(from / cols);
  const c2 = to % cols;
  const r2 = Math.floor(to / cols);
  if (r1 !== r2 && c1 !== c2) return [];
  const out: [number, number][] = [];
  if (r1 === r2) {
    if (c1 === c2) return [];
    const step = c2 > c1 ? 1 : -1;
    for (let c = c1; c !== c2; c += step) {
      const i = r1 * cols + c;
      out.push([i, i + step]);
    }
  } else {
    const step = r2 > r1 ? cols : -cols;
    for (let i = from; i !== to; i += step) {
      out.push([i, i + step]);
    }
  }
  return out;
}

/** Percorso a L in soli passi ortogonali adiacenti (ogni segmento collega due celle vicine). */
function getManhattanPathSegments(from: number, to: number, cols: number): [number, number][] {
  const c1 = from % cols;
  const r1 = Math.floor(from / cols);
  const c2 = to % cols;
  const r2 = Math.floor(to / cols);
  if (c1 === c2 && r1 === r2) return [];
  if (c1 === c2) return expandAxisToUnitSteps(from, to, cols);
  if (r1 === r2) return expandAxisToUnitSteps(from, to, cols);
  const mid = r1 * cols + c2;
  return [...expandAxisToUnitSteps(from, mid, cols), ...expandAxisToUnitSteps(mid, to, cols)];
}

/**
 * Lastrica con celle "Strada" i percorsi Manhattan tra edifici chiave (centro ↔ spazioporto/serra).
 * Il collegamento non dipende più dal layer vettoriale grigio sopra la griglia.
 */
function piazzaStradeInizialiTraEdifici(
  edificiInMappa: Record<number, EdificioInCella>,
  terrenoInMappa: Record<number, TerrenoType>,
  cols: number,
  rows: number
): void {
  for (const [from, to] of getStradeIniziali(edificiInMappa)) {
    const segs = getManhattanPathSegments(from, to, cols);
    const touch = new Set<number>();
    for (const [a, b] of segs) {
      touch.add(a);
      touch.add(b);
    }
    for (const i of touch) {
      piazzaStrada2x2CheContiene(i, cols, rows, terrenoInMappa, edificiInMappa, STRADA_OPZIONE);
    }
  }
}

function getResourceEmoji(r: Risorsa): string {
  const n = r.nome.toLowerCase();
  if (n.includes("cibo")) return "🍱";
  if (n.includes("energia")) return "⚡";
  if (n.includes("acqua")) return "💧";
  if (n.includes("materiale edile")) return "🧱";
  if (n.includes("medicine")) return "💊";
  if (n.includes("combustibile")) return "⛽";
  if (n.includes("rifiuti")) return "🗑️";
  return "⛏️";
}

function getResourceRoute(r: Risorsa): string | null {
  const n = r.nome.toLowerCase();
  if (n.includes("cibo")) return "/cibo";
  if (n.includes("energia")) return "/energia";
  if (n.includes("acqua")) return "/acqua";
  if (n.includes("rifiuti")) return "/rifiuti";
  return null;
}

function normalizeMappaSessione(state: MappaRuntimeState): MappaRuntimeState {
  if (state.residenzeMappa) return state;
  return { ...state, residenzeMappa: {} };
}

export function MappaScreen() {
  const [boot, setBoot] = useState<
    | { status: "loading"; progress: number; label: string }
    | { status: "ready"; state: MappaRuntimeState }
  >(() => {
    const session = getMappaSessione();
    if (session) {
      return { status: "ready", state: normalizeMappaSessione(session) };
    }
    return { status: "loading", progress: 0, label: "Avvio…" };
  });

  useEffect(() => {
    if (boot.status === "ready") return;
    let cancelled = false;
    void (async () => {
      try {
        const state = await buildInitialMappa(FIXED_MAP_COLS, FIXED_MAP_ROWS, (progress, label) => {
          if (!cancelled) setBoot({ status: "loading", progress, label });
        });
        if (cancelled) return;
        setMappaSessione(state);
        setBoot({ status: "ready", state });
      } catch (err) {
        console.error("Generazione mappa fallita:", err);
        if (!cancelled) {
          setBoot({ status: "loading", progress: 0, label: "Errore durante la creazione. Ricarica la pagina." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boot.status]);

  if (boot.status === "loading") {
    return <MondoLoadingScreen progress={boot.progress} label={boot.label} />;
  }

  return <MappaScreenInner initialMappaState={boot.state} />;
}

function MappaScreenInner({ initialMappaState }: { initialMappaState: MappaRuntimeState }) {
  const router = useRouter();
  const {
    risorse,
    abitanti,
    inventarioGiocatore,
    moneteGiocatore,
    edifici,
    mese,
    anno,
    isLoading,
    avanzaMese,
    calcolaProduzioneConsumo,
    calcolaDeltaOrdiniMercato,
    calcolaDeltaTesoroMercato,
    calcolaFelicitàModificata,
    etaMinimaLavoro,
    assegnaAbitanteAEdificio,
    rimuoviAbitanteDaEdificio,
    aggiungiEdificioDaTemplate,
    rimuoviEdificioPerId,
    serviPastoMensaAbitante,
    aggiornaAbitanteById,
    accreditaMoneteGiocatore,
    assumiCittadinoDisoccupatoAEdificio,
    appendDiarioRiga,
    setInventarioMensaEdificio,
    inventarioMensaByEdificioId,
    luoghiCultoPendentiMappa,
    setLuoghiCultoPendentiMappa,
    richiesteInAttesa,
    accettaRichiestaInAttesa,
    rifiutaRichiestaInAttesa,
    eventiInCorso,
    eventiCatalogo,
    punteggioSanzioni,
    divietoEspatrioAttivo,
    soddisfazioneFazioni,
    politicaNascite,
    tipologieFamigliaAccettate,
    pendingAssimilazione,
    pendingRichiestaLuogoCulto,
    luoghiCultoRifiutati,
    capoReligiosoSole,
    capoReligiosoAlieni,
    coprifuocoAttivo,
    coprifuocoInizioMinuti,
    coprifuocoFineMinuti
  } = useGameContext();
  const variazioni = calcolaProduzioneConsumo();
  const deltaOrdini = calcolaDeltaOrdiniMercato();
  const deltaTesoroMercato = calcolaDeltaTesoroMercato();

  const abitantiConFelicità = abitanti.filter((a) => a.razza !== "Golem");
  const nConFelicità = abitantiConFelicità.length;
  const felicitàMedia = nConFelicità ? Math.round(abitantiConFelicità.reduce((s, a) => s + calcolaFelicitàModificata(a), 0) / nConFelicità) : 0;
  const nConLealtàPaura = abitantiConFelicità.length;
  const lealtàMedia = nConLealtàPaura ? Math.round(abitantiConFelicità.reduce((s, a) => s + a.lealtà, 0) / nConLealtàPaura) : 0;
  const pauraMedia = nConLealtàPaura ? Math.round(abitantiConFelicità.reduce((s, a) => s + a.paura, 0) / nConLealtàPaura) : 0;
  const nDisoccupati = abitantiConFelicità.filter((a) => a.lavoro === "Disoccupato").length;
  const disoccupazionePercent = nConFelicità ? Math.round((nDisoccupati / nConFelicità) * 100) : 0;

  /** Una voce per nome (es. una sola "Serra") con id template del catalogo. */
  const edificiCatalogoModal = useMemo(() => {
    const seen = new Set<string>();
    const out: Edificio[] = [];
    for (const row of edificiData) {
      if (row.nome === "Centro di Comando") continue;
      /** Una sola Baracca è supportata dalla sync globale Senzatetto → edificio. */
      if (row.nome === "Baracca") continue;
      if (seen.has(row.nome)) continue;
      seen.add(row.nome);
      out.push(row);
    }
    return out;
  }, []);

  const edificiCostruzionePerSezione = useMemo(() => {
    const byNome = new Map(edificiCatalogoModal.map((e) => [e.nome, e]));
    const used = new Set<string>();
    const sections = SEZIONI_COSTRUZIONE.map((s) => ({
      titolo: s.titolo,
      edifici: s.nomi
        .map((nome) => {
          used.add(nome);
          return byNome.get(nome);
        })
        .filter((e): e is Edificio => e != null)
    }));
    const altri = edificiCatalogoModal.filter((e) => !used.has(e.nome));
    return { sections, altri };
  }, [edificiCatalogoModal]);

  const costruisciLayout = useMemo(() => {
    const { width } = Dimensions.get("window");
    const paddingX = 32;
    const gap = 10;
    const columns =
      width >= 1200 ? 6 : width >= 960 ? 5 : width >= 720 ? 4 : width >= 480 ? 3 : 2;
    const tileWidth = Math.floor((width - paddingX - gap * (columns - 1)) / columns);
    return { columns, tileWidth, gap };
  }, []);

  const [mappaState, setMappaState] = useState<MappaRuntimeState>(() => {
    const session = getMappaSessione() ?? initialMappaState;
    setMappaSessione(session);
    return session;
  });

  const setMappaStatePersistente = useCallback((action: React.SetStateAction<MappaRuntimeState>) => {
    setMappaState((prev) => {
      const next = typeof action === "function" ? (action as (p: MappaRuntimeState) => MappaRuntimeState)(prev) : action;
      return next;
    });
  }, []);

  useEffect(() => {
    setMappaSessione(mappaState);
  }, [mappaState]);

  const mappaStateRef = useRef(mappaState);
  mappaStateRef.current = mappaState;

  /** Ripara edifici culto costruiti ma non ancora visibili sulla mappa (es. accettati da Richieste). */
  useEffect(() => {
    const mancanti = trovaLuoghiCultoDaPiazzareSuMappa(edifici, mappaStateRef.current);
    if (mancanti.length === 0) return;
    setLuoghiCultoPendentiMappa((prev) => {
      const next = [...prev];
      for (const m of mancanti) {
        if (!next.some((p) => p.edificioGlobaleId === m.edificioGlobaleId)) next.push(m);
      }
      return next.length === prev.length ? prev : next;
    });
  }, [edifici, setLuoghiCultoPendentiMappa]);

  useEffect(() => {
    if (luoghiCultoPendentiMappa.length === 0) return;
    const ancoraPendenti: typeof luoghiCultoPendentiMappa = [];
    let piazzatoAlmenoUno = false;
    for (const pending of luoghiCultoPendentiMappa) {
      const ok = piazzaLuogoCultoSuMappa(pending.religione, pending.edificioGlobaleId, mappaStateRef.current);
      if (ok) piazzatoAlmenoUno = true;
      else ancoraPendenti.push(pending);
    }
    if (piazzatoAlmenoUno) {
      const session = getMappaSessione();
      if (session) setMappaStatePersistente(session);
    }
    if (ancoraPendenti.length !== luoghiCultoPendentiMappa.length) {
      setLuoghiCultoPendentiMappa(ancoraPendenti);
    }
  }, [luoghiCultoPendentiMappa, setLuoghiCultoPendentiMappa, setMappaStatePersistente]);
  const edificiInMappa = mappaState.edificiInMappa;
  const terrenoInMappa = mappaState.terrenoInMappa;
  const decorazioniInMappa = mappaState.decorazioniInMappa;
  const residenzeMappa = mappaState.residenzeMappa;
  /** Una tantum: distribuisce i residenti della Capanna globale sulle capanne procedurali. */
  const residenzeCapanneInizialiRef = useRef(false);

  useEffect(() => {
    if (Object.keys(residenzeMappa).length > 0) {
      residenzeCapanneInizialiRef.current = true;
      return;
    }
    if (residenzeCapanneInizialiRef.current) return;
    const capannaGlob = edifici.find((x) => x.id === 20);
    const ids = [...(capannaGlob?.abitantiAssegnati ?? [])].sort((a, b) => a - b);
    if (ids.length === 0) return;
    const anchors = elencoAnchorCelleCapanne(edificiInMappa);
    if (anchors.length === 0) return;
    const next = distribuisciAbitantiSuAnchorCapanne(ids, anchors, POSTI_PER_CASA_MAPPA);
    residenzeCapanneInizialiRef.current = true;
    setMappaStatePersistente((s) => ({ ...s, residenzeMappa: next }));
  }, [edifici, edificiInMappa, residenzeMappa, setMappaStatePersistente]);

  /** Modal elenco edifici (pulsante Costruisci). */
  const [mostraModalCostruisci, setMostraModalCostruisci] = useState(false);
  /** Modal richieste rimandate (pulsante Richieste). */
  const [mostraModalRichieste, setMostraModalRichieste] = useState(false);
  /** Modal catalogo eventi (pulsante Eventi). */
  const [mostraModalEventi, setMostraModalEventi] = useState(false);

  const eventiUIInput = useMemo(
    () => ({
      abitanti,
      edifici,
      risorse,
      eventiInCorso,
      eventiCatalogo,
      punteggioSanzioni,
      divietoEspatrioAttivo,
      calcolaFelicitàModificata,
      soddisfazioneFazioni,
      politicaNascite,
      tipologieFamigliaAccettate,
      pendingAssimilazione,
      pendingRichiestaLuogoCulto,
      richiesteInAttesa,
      luoghiCultoRifiutati,
      capoReligiosoSole,
      capoReligiosoAlieni
    }),
    [
      abitanti,
      edifici,
      risorse,
      eventiInCorso,
      eventiCatalogo,
      punteggioSanzioni,
      divietoEspatrioAttivo,
      calcolaFelicitàModificata,
      soddisfazioneFazioni,
      politicaNascite,
      tipologieFamigliaAccettate,
      pendingAssimilazione,
      pendingRichiestaLuogoCulto,
      richiesteInAttesa,
      luoghiCultoRifiutati,
      capoReligiosoSole,
      capoReligiosoAlieni
    ]
  );

  const eventiAttiviCount = useMemo(() => {
    const { inCorso, disponibili } = calcolaEventiUI(eventiUIInput);
    return inCorso.length + disponibili.length;
  }, [eventiUIInput]);
  /** Tap sulla mappa per rimuovere edifici costruiti dal giocatore. */
  const [modalitaDemolisci, setModalitaDemolisci] = useState(false);
  /** Conferma demolizione dopo tap su edificio in modalità Demolisci. */
  const [confermaDemolizionePending, setConfermaDemolizionePending] = useState<{
    anchor: number;
    w: number;
    h: number;
    cap: EdificioInCella;
    globalId: number | undefined;
  } | null>(null);
  /** Edifico scelto: anteprima sulla mappa e tap per piazzare. */
  const [costruzioneSelezione, setCostruzioneSelezione] = useState<SelezioneCostruzioneAnteprima | null>(null);
  const celleProtetteIniziali = useMemo(
    () => indiciFootprintProtettiIniziali(initialMappaState.edificiInMappa, FIXED_MAP_COLS),
    [initialMappaState]
  );
  /** Cella sotto il puntatore (web hover / press mobile) per l’anteprima footprint. */
  const [previewCellHover, setPreviewCellHover] = useState<number | null>(null);
  const [selectedCellForTransformDialog, setSelectedCellForTransformDialog] = useState<number | null>(null);
  /** Cella anchor della residenza aperta dal doppio tocco (Baracca, Capanna, Dormitorio). */
  const [selectedResidenzaAnchor, setSelectedResidenzaAnchor] = useState<number | null>(null);

  /** Apertura residenza richiesta dal profilo abitante (Capanna / Baracca / Dormitorio specifici). */
  useEffect(() => {
    const pending = getAperturaResidenzaPending();
    if (!pending) return;

    let residenzeEff = residenzeMappa;
    const prepared = preparaResidenzeMappaPerLookup(edifici, edificiInMappa, residenzeMappa);
    if (prepared !== residenzeMappa) {
      setMappaStatePersistente((s) => ({ ...s, residenzeMappa: prepared }));
      residenzeEff = prepared;
    }

    const anchor: number | null =
      pending.tipo === "anchor"
        ? pending.anchor
        : risolviAnchorCasaAbitante(pending.abitanteId, edifici, edificiInMappa, residenzeEff);

    if (anchor != null && edificiInMappa[anchor] && èResidenzaMappa(edificiInMappa[anchor].nome)) {
      azzeraAperturaResidenzaPending();
      setSelectedResidenzaAnchor(anchor);
    }
  }, [edifici, edificiInMappa, residenzeMappa, setMappaStatePersistente]);

  /** Cella anchor del Luogo di Culto aperto dal doppio tocco. */
  const [selectedLuogoCultoAnchor, setSelectedLuogoCultoAnchor] = useState<number | null>(null);
  /** Scheda abitante aperta dal doppio tocco su un passeggiatore sulla mappa. */
  const [schedaWandererAbitante, setSchedaWandererAbitante] = useState<Abitante | null>(null);
  /** Selezione mappa: sintesi in barra inferiore al posto dei pulsanti risorse. */
  const [sintesiMappaAbitanteId, setSintesiMappaAbitanteId] = useState<number | null>(null);
  /** Bordi tra le celle: di default nascosti; il toggle nella barra risorse li attiva. */
  const [mostraGrigliaMappa, setMostraGrigliaMappa] = useState(false);
  const lastTapCell = useRef<number | null>(null);
  const lastTapTime = useRef<number>(0);
  /** True se l’ultimo gesto sulla mappa è stato un trascinamento (pan): non chiudere la sintesi. */
  const mapDraggedRef = useRef(false);
  const panStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const { minuti: orologioMinuti, inPausa: orologioInPausa, togglePausa: toggleOrologioPausa } =
    useOrologioGioco();

  /** Dimensioni viewport mappa (per culling celle visibili durante pan/zoom). */
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [mapTransform, setMapTransform] = useState<MapTransformState>({
    positionX: 0,
    positionY: 0,
    scale: 1
  });
  const transformRafRef = useRef<number | null>(null);
  const pendingTransformRef = useRef<MapTransformState | null>(null);

  const scheduleMapTransformUpdate = useCallback((state: MapTransformState) => {
    pendingTransformRef.current = state;
    if (transformRafRef.current != null) return;
    transformRafRef.current = requestAnimationFrame(() => {
      transformRafRef.current = null;
      if (pendingTransformRef.current) setMapTransform(pendingTransformRef.current);
    });
  }, []);

  useEffect(
    () => () => {
      if (transformRafRef.current != null) cancelAnimationFrame(transformRafRef.current);
    },
    []
  );

  /** Ordine stabile per overlay: ogni abitante ha un personaggio che cammina sulla mappa. */
  const abitantiPerOverlayMappa = useMemo(
    () => [...abitanti].sort((a, b) => a.id - b.id),
    [abitanti]
  );

  const getAbitanteNome = useCallback(
    (id: number) => abitanti.find((a) => a.id === id)?.nome ?? `ID ${id}`,
    [abitanti]
  );

  const sintesiMappaAbitante = useMemo(() => {
    if (sintesiMappaAbitanteId == null) return null;
    return abitanti.find((a) => a.id === sintesiMappaAbitanteId) ?? null;
  }, [abitanti, sintesiMappaAbitanteId]);

  useEffect(() => {
    if (sintesiMappaAbitanteId != null && sintesiMappaAbitante == null) {
      setSintesiMappaAbitanteId(null);
    }
  }, [sintesiMappaAbitanteId, sintesiMappaAbitante]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const meta = document.querySelector('meta[name="viewport"]');
    const previousContent = meta?.getAttribute("content") ?? "";
    if (meta) {
      meta.setAttribute(
        "content",
        "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
      );
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      if (meta) meta.setAttribute("content", previousContent || "width=device-width, initial-scale=1, viewport-fit=cover");
    };
  }, []);

  const statoCielo = useMemo(() => computeStatoCielo(orologioMinuti), [orologioMinuti]);
  /** Allineato al buio del cielo: con buio > 0.5 i personaggi con casa si posizionano sulla residenza. */
  const èNottePersonaggiInCasa = statoCielo.buio > 0.5;

  const cols = FIXED_MAP_COLS;
  const rows = FIXED_MAP_ROWS;
  const cellW = CELL_SIZE_PX;
  const cellH = CELL_SIZE_PX;
  const contentWidth = cols * CELL_SIZE_PX + (cols - 1) * GAP;
  const contentHeight = rows * CELL_SIZE_PX + (rows - 1) * GAP;

  const uscitaCostruzione = useCallback(() => {
    setCostruzioneSelezione(null);
    setPreviewCellHover(null);
  }, []);

  const uscitaDemolizione = useCallback(() => {
    setModalitaDemolisci(false);
    setConfermaDemolizionePending(null);
  }, []);

  const onDemolisciPress = useCallback(() => {
    if (modalitaDemolisci) {
      uscitaDemolizione();
      return;
    }
    uscitaCostruzione();
    setMostraModalCostruisci(false);
    setModalitaDemolisci(true);
    setMostraGrigliaMappa(true);
  }, [modalitaDemolisci, uscitaDemolizione, uscitaCostruzione]);

  const onCostruisciPress = useCallback(() => {
    setModalitaDemolisci(false);
    if (costruzioneTerrenoPersistente(costruzioneSelezione)) {
      uscitaCostruzione();
      return;
    }
    setMostraModalCostruisci(true);
  }, [costruzioneSelezione, uscitaCostruzione]);

  const previewPiazzamento = useMemo(
    () =>
      costruzioneSelezione
        ? calcolaPreviewPiazzamento(
            costruzioneSelezione,
            previewCellHover,
            edificiInMappa,
            terrenoInMappa,
            cols,
            rows
          )
        : null,
    [costruzioneSelezione, previewCellHover, edificiInMappa, terrenoInMappa, cols, rows]
  );

  useEffect(() => {
    if (typeof document === "undefined" || (!costruzioneSelezione && !modalitaDemolisci)) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        uscitaCostruzione();
        uscitaDemolizione();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [costruzioneSelezione, modalitaDemolisci, uscitaCostruzione, uscitaDemolizione]);

  /**
   * Web + zoom (CSS transform): i bordi per-cella (hairline) si allineano male ai pixel dello schermo e
   * compaiono/scompaiono spostando o ridimensionando. Un unico layer con gradienti ripetuti scala col
   * contenuto e resta stabile.
   */
  const grigliaOverlayWebStyle = useMemo((): ViewStyle => {
    const line = "rgba(0,0,0,0.15)";
    return {
      position: "absolute",
      left: 0,
      top: 0,
      width: contentWidth,
      height: contentHeight,
      zIndex: 1,
      pointerEvents: "none",
      backfaceVisibility: "hidden",
      backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
      backgroundSize: `${CELL_SIZE_PX}px ${CELL_SIZE_PX}px`,
      backgroundRepeat: "repeat"
    } as ViewStyle;
  }, [contentWidth, contentHeight]);

  const gridContainerStyle = useMemo(() => {
    const base = {
      width: contentWidth,
      height: contentHeight,
      position: "relative" as const
    };
    if (Platform.OS === "web") {
      return {
        ...base,
        overflow: "hidden" as const,
        backfaceVisibility: "hidden" as const
      };
    }
    return {
      ...base,
      display: "grid" as const,
      gridTemplateColumns: `repeat(${cols}, ${CELL_SIZE_PX}px)`,
      gridTemplateRows: `repeat(${rows}, ${CELL_SIZE_PX}px)`
    };
  }, [cols, rows, contentWidth, contentHeight]);

  const stradaAssetAt = useMemo(
    () => buildStradaAssetLookup(cols, rows, terrenoInMappa, edificiInMappa),
    [cols, rows, terrenoInMappa, edificiInMappa]
  );

  const erbaAssetAt = useMemo(
    () => buildErbaAssetLookup(cols, rows, terrenoInMappa, edificiInMappa, stradaAssetAt),
    [cols, rows, terrenoInMappa, edificiInMappa, stradaAssetAt]
  );

  const { erbaSpiaggiaAssetAt, spiaggiaAssetAt } = useMemo(
    () => buildCoastalAssetLookups(cols, rows, terrenoInMappa, edificiInMappa),
    [cols, rows, terrenoInMappa, edificiInMappa]
  );

  const visibleCellRange = useMemo(
    () =>
      computeVisibleCellRange(
        viewportSize.width,
        viewportSize.height,
        mapTransform,
        cols,
        rows,
        CELL_SIZE_PX
      ),
    [viewportSize.width, viewportSize.height, mapTransform, cols, rows]
  );

  const { visibleTerrainIndices, visibleWaterIndices } = useMemo(() => {
    const terrain: number[] = [];
    const water: number[] = [];
    for (const i of buildVisibleCellIndices(visibleCellRange, cols)) {
      if (isTerrenoAcqua(i, terrenoInMappa, cols, rows)) water.push(i);
      else terrain.push(i);
    }
    return { visibleTerrainIndices: terrain, visibleWaterIndices: water };
  }, [visibleCellRange, cols, terrenoInMappa, rows]);

  const costruzioneDissalatore = Boolean(
    costruzioneSelezione?.tipo === "edificio" &&
      costruzioneSelezione.edificio.nome === "Dissalatore"
  );

  const overlayEmojiAt = useCallback(
    (cellIndex: number): string | null => {
      const edificio = edificiInMappa[cellIndex];
      const èStrada = edificio?.nome === "Strada";
      const edificioMulticella =
        !!edificio && !èStrada && (edificio.footprintRef != null || edificio.footprint != null);
      if (edificio && !èStrada && !edificioMulticella) return edificio.emoji;
      return decorazioniInMappa[cellIndex] ?? null;
    },
    [edificiInMappa, decorazioniInMappa]
  );

  const isWalkableCell = useCallback(
    (i: number) => {
      if (isAcqua(i, cols, rows)) return false;
      if ((terrenoInMappa[i] ?? "erba") === "river") return false;
      if (decorazioniInMappa[i]) return false;
      const e = edificiInMappa[i];
      if (!e) return true;
      if (e.nome === "Strada") return true;
      return false;
    },
    [terrenoInMappa, edificiInMappa, decorazioniInMappa, cols, rows]
  );

  const isRoadCell = useCallback(
    (i: number) => edificiInMappa[i]?.nome === "Strada",
    [edificiInMappa]
  );

  const cellaCasaPerAbitanteId = useMemo(() => {
    const m = new Map<number, number | null>();
    for (const a of abitanti) {
      m.set(a.id, trovaCellaAnchorCasaSuMappa(a.id, edifici, edificiInMappa, residenzeMappa));
    }
    return m;
  }, [abitanti, edifici, edificiInMappa, residenzeMappa]);

  const ultimaCellaAbitanteRef = useRef<Map<number, number>>(new Map());
  /** Minuti assoluti (giorno*1440 + ora) dell’ultimo tentativo di rapina per abitante. */
  const ultimoTentativoRapinaAbsRef = useRef<Map<number, number>>(new Map());
  /** Esito testo scheda dopo una rapina risolta. */
  const [esitoRapinaByAbitanteId, setEsitoRapinaByAbitanteId] = useState<Record<number, string>>({});
  /** Cella → abitante che la occupa (solo mentre è visibile in strada; non in casa di notte). */
  const cellaOccupataDaAbitanteRef = useRef<Map<number, number>>(new Map());
  const abitanteSuCellaRef = useRef<Map<number, number>>(new Map());
  const prevBuioNotteTransitRef = useRef<boolean | undefined>(undefined);
  const orologioPrevTickRef = useRef(orologioMinuti);

  const isCellFreeForAbitante = useCallback((abitanteId: number, cell: number) => {
    const occupant = cellaOccupataDaAbitanteRef.current.get(cell);
    return occupant == null || occupant === abitanteId;
  }, []);

  const tryClaimCellAbitante = useCallback((abitanteId: number, cell: number) => {
    const occupant = cellaOccupataDaAbitanteRef.current.get(cell);
    if (occupant != null && occupant !== abitanteId) return false;
    const prev = abitanteSuCellaRef.current.get(abitanteId);
    if (prev != null && prev !== cell && cellaOccupataDaAbitanteRef.current.get(prev) === abitanteId) {
      cellaOccupataDaAbitanteRef.current.delete(prev);
    }
    cellaOccupataDaAbitanteRef.current.set(cell, abitanteId);
    abitanteSuCellaRef.current.set(abitanteId, cell);
    return true;
  }, []);

  const releaseCellAbitante = useCallback((abitanteId: number) => {
    const cell = abitanteSuCellaRef.current.get(abitanteId);
    if (cell == null) return;
    if (cellaOccupataDaAbitanteRef.current.get(cell) === abitanteId) {
      cellaOccupataDaAbitanteRef.current.delete(cell);
    }
    abitanteSuCellaRef.current.delete(abitanteId);
  }, []);

  const [dormonoACasaIds, setDormonoACasaIds] = useState<Set<number>>(() => new Set());
  const [lavoroArrivatiIds, setLavoroArrivatiIds] = useState<Set<number>>(() => new Set());
  /** id edificio Bar (globale) → abitanti considerati “dentro” quel locale sulla mappa. */
  const [barArrivatiByEdificio, setBarArrivatiByEdificio] = useState<Record<number, number[]>>({});
  /** id edificio Luogo di Culto (globale) → fedeli considerati “dentro” quel tempio. */
  const [cultoArrivatiByEdificio, setCultoArrivatiByEdificio] = useState<Record<number, number[]>>({});
  const [commuteByAbitanteId, setCommuteByAbitanteId] = useState<Record<number, CommuteInfo>>({});

  const minutiAbsGioco = useCallback(
    () => getGiornoGiocoSnapshot() * 1440 + orologioMinuti,
    [orologioMinuti]
  );

  const findEdificioCellRapina = useCallback(
    (edificioId: number) => trovaAnchorEdificioGlobaleSuMappa(edificioId, edificiInMappa),
    [edificiInMappa]
  );

  const idsNascostiPerRapina = useCallback((): Set<number> => {
    const s = new Set<number>();
    for (const id of lavoroArrivatiIds) s.add(id);
    for (const ids of Object.values(barArrivatiByEdificio)) {
      for (const id of ids) s.add(id);
    }
    for (const ids of Object.values(cultoArrivatiByEdificio)) {
      for (const id of ids) s.add(id);
    }
    return s;
  }, [lavoroArrivatiIds, barArrivatiByEdificio, cultoArrivatiByEdificio]);

  /** Se eleggibile, costruisce una commute purpose rapina verso persona o edificio. */
  const provaCommuteRapina = useCallback(
    (ab: Abitante, from: number): CommuteInfo | null => {
      const oraAbs = minutiAbsGioco();
      if (
        !abitantePuòTentareRapina(ab, {
          edifici,
          inventarioMensaByEdificioId,
          ultimoTentativoAbsMinuti: ultimoTentativoRapinaAbsRef.current.get(ab.id) ?? null,
          oraAbsMinuti: oraAbs
        })
      ) {
        return null;
      }

      const celleNote = new Map(ultimaCellaAbitanteRef.current);
      if (!celleNote.has(ab.id)) celleNote.set(ab.id, from);
      for (const [id, home] of cellaCasaPerAbitanteId) {
        if (!celleNote.has(id) && home != null) celleNote.set(id, home);
      }

      const target = scegliBersaglioRapina(ab, abitanti, celleNote, edifici, inventarioMensaByEdificioId, {
        cols,
        dormonoACasaIds,
        nascostiIds: idsNascostiPerRapina(),
        findEdificioCell: findEdificioCellRapina
      });
      if (!target) return null;

      let dest: number | null = null;
      if (target.tipo === "abitante") {
        dest = celleNote.get(target.id) ?? null;
      } else {
        dest = findEdificioCellRapina(target.id);
      }
      if (dest == null) return null;

      const path = calcolaPercorsoVersoAnchorEdificio(
        from,
        dest,
        cols,
        rows,
        isWalkableCell,
        target.tipo === "edificio" ? edificiInMappa : undefined
      );
      if (!path || path.length < 2) return null;

      ultimoTentativoRapinaAbsRef.current.set(ab.id, oraAbs);
      return { path, token: Date.now(), purpose: "rapina", rapinaTarget: target };
    },
    [
      minutiAbsGioco,
      edifici,
      inventarioMensaByEdificioId,
      abitanti,
      cols,
      rows,
      isWalkableCell,
      cellaCasaPerAbitanteId,
      dormonoACasaIds,
      idsNascostiPerRapina,
      findEdificioCellRapina
    ]
  );

  useEffect(() => {
    const m = new Map<number, Set<number>>();
    for (const [k, ids] of Object.entries(barArrivatiByEdificio)) {
      m.set(Number(k), new Set(ids));
    }
    setBarArrivatiMappaSnapshot(m);
  }, [barArrivatiByEdificio]);

  /** 8:00 → Bar / casa → lavoro; 17:00 → lavoro → Bar. */
  useEffect(() => {
    const prev = orologioPrevTickRef.current;
    const cur = orologioMinuti;
    orologioPrevTickRef.current = cur;
    if (prev === cur) return;
    if (statoCielo.buio > 0.5) return;

    const LAVORO_INIZIO = 8 * 60;
    const LAVORO_FINE = 17 * 60;
    const PREGHIERA_INIZIO = 10 * 60;
    const PREGHIERA_FINE = 11 * 60;

    if (prev < PREGHIERA_INIZIO && cur >= PREGHIERA_INIZIO) {
      setCommuteByAbitanteId((prevComm) => {
        const out = { ...prevComm };
        for (const a of abitanti) {
          if (!abitanteDeveAndareAlCultoOra(a, cur, statoCielo.buio, edifici)) continue;
          if (out[a.id]) continue;
          const religione = a.religione as ReligioneConCulto;
          const nomeCulto = nomeEdificioLuogoCulto(religione);
          const homeCell = cellaCasaPerAbitanteId.get(a.id) ?? null;
          const from =
            ultimaCellaAbitanteRef.current.get(a.id) ?? (homeCell != null ? homeCell : null);
          if (from == null) continue;
          const cultoId = scegliLuogoCultoEdificioIdPiuVicino(
            nomeCulto,
            from,
            edifici,
            edificiInMappa,
            cols,
            rows,
            isWalkableCell
          );
          if (cultoId == null) continue;
          const path = pianificaCommuteVersoEdificioGlobaleDaCella(
            from,
            cultoId,
            edificiInMappa,
            cols,
            rows,
            isWalkableCell
          );
          if (path && path.length >= 2) {
            out[a.id] = { path, token: Date.now(), purpose: "culto", cultoEdificioId: cultoId };
          }
        }
        return out;
      });
      setBarArrivatiByEdificio((prev0) => {
        let acc = prev0;
        for (const a of abitanti) {
          if (!abitanteDeveAndareAlCultoOra(a, cur, statoCielo.buio, edifici)) continue;
          acc = rimuoviAbitanteDaTuttiBar(acc, a.id);
        }
        return acc;
      });
    }

    if (prev < PREGHIERA_FINE && cur >= PREGHIERA_FINE) {
      setCultoArrivatiByEdificio({});
    }

    if (prev < LAVORO_INIZIO && cur >= LAVORO_INIZIO) {
      setCommuteByAbitanteId((prevComm) => {
        const out = { ...prevComm };
        for (const a of abitanti) {
          if (a.razza === "Golem") continue;
          if (out[a.id]) continue;
          const lav = primoEdificioLavoroOrarioPerAbitante(a.id, edifici);
          if (!lav) continue;
          const fascia = fasciaPerEdificio(lav);
          if (!fascia || !minutiInFascia(cur, fascia)) continue;
          const homeCell = cellaCasaPerAbitanteId.get(a.id) ?? null;
          const from =
            ultimaCellaAbitanteRef.current.get(a.id) ?? (homeCell != null ? homeCell : null);
          if (from == null) continue;
          const path = pianificaCommuteVersoEdificioGlobaleDaCella(
            from,
            lav.id,
            edificiInMappa,
            cols,
            rows,
            isWalkableCell
          );
          if (path && path.length >= 2) {
            out[a.id] = { path, token: Date.now(), purpose: "work" };
          }
        }
        return out;
      });
      setBarArrivatiByEdificio((prev0) => {
        let acc = prev0;
        for (const a of abitanti) {
          if (a.razza === "Golem") continue;
          const lav = primoEdificioLavoroOrarioPerAbitante(a.id, edifici);
          if (!lav) continue;
          const fascia = fasciaPerEdificio(lav);
          if (!fascia || !minutiInFascia(cur, fascia)) continue;
          acc = rimuoviAbitanteDaTuttiBar(acc, a.id);
        }
        return acc;
      });
    }

    if (prev < LAVORO_FINE && cur >= LAVORO_FINE && lavoroArrivatiIds.size > 0) {
      const toPath = [...lavoroArrivatiIds];
      const nuove: Record<number, CommuteInfo> = {};
      for (const id of toPath) {
        const ab = abitanti.find((a) => a.id === id);
        const homeCell = cellaCasaPerAbitanteId.get(id) ?? null;
        const from =
          ultimaCellaAbitanteRef.current.get(id) ?? (homeCell != null ? homeCell : null);
        if (from == null || !ab) continue;

        const cfgCoprifuoco = {
          attivo: coprifuocoAttivo,
          inizioMinuti: coprifuocoInizioMinuti,
          fineMinuti: coprifuocoFineMinuti
        };
        if (abitanteSoggettoACoprifuoco(ab, edifici, cfgCoprifuoco, cur)) {
          if (homeCell != null && from !== homeCell) {
            const pathHome = pianificaCommuteSeraACasa(homeCell, from, cols, rows, isWalkableCell, edificiInMappa);
            if (pathHome && pathHome.length >= 2) {
              nuove[id] = { path: pathHome, token: Date.now(), purpose: "home" };
            }
          }
          continue;
        }

        const snack = tentaSnackDaInventario(ab);
        if (snack) {
          aggiornaAbitanteById(id, () => snack);
          continue;
        }

        const puòRapinare = abitantePuòTentareRapina(ab, {
          edifici,
          inventarioMensaByEdificioId,
          ultimoTentativoAbsMinuti: ultimoTentativoRapinaAbsRef.current.get(id) ?? null,
          oraAbsMinuti: minutiAbsGioco()
        });
        const azione = scegliAzioneTempoLibero(ab, {
          puòUsareMensa: abitanteHaBisognoMensa(ab, edifici),
          puòUsareNegozio: abitanteVuoleNegozio(ab, edifici),
          puòRapinare,
          haCasa: homeCell != null
        });

        if (azione === "mensa") {
          const mensaId = scegliMensaEdificioIdPiuVicino(
            from,
            edifici,
            edificiInMappa,
            cols,
            rows,
            isWalkableCell
          );
          if (mensaId != null) {
            const pathMensa = pianificaCommuteVersoEdificioGlobaleDaCella(
              from,
              mensaId,
              edificiInMappa,
              cols,
              rows,
              isWalkableCell
            );
            if (pathMensa && pathMensa.length >= 2) {
              nuove[id] = { path: pathMensa, token: Date.now(), purpose: "mensa", mensaEdificioId: mensaId };
              continue;
            }
          }
        }

        if (azione === "negozio") {
          const negozioId = scegliEdificioIdPiuVicinoPerNome(
            "Negozio",
            from,
            edifici,
            edificiInMappa,
            cols,
            rows,
            isWalkableCell
          );
          if (negozioId != null) {
            const pathNegozio = pianificaCommuteVersoEdificioGlobaleDaCella(
              from,
              negozioId,
              edificiInMappa,
              cols,
              rows,
              isWalkableCell
            );
            if (pathNegozio && pathNegozio.length >= 2) {
              nuove[id] = {
                path: pathNegozio,
                token: Date.now(),
                purpose: "negozio",
                negozioEdificioId: negozioId
              };
              continue;
            }
          }
        }

        if (azione === "rapina") {
          const rapina = provaCommuteRapina(ab, from);
          if (rapina) {
            nuove[id] = rapina;
            continue;
          }
        }

        if (azione === "bar") {
          const barId = scegliBarEdificioIdPiuVicino(from, edifici, edificiInMappa, cols, rows, isWalkableCell);
          if (barId != null) {
            const path = pianificaCommuteVersoBarDaCella(from, barId, edificiInMappa, cols, rows, isWalkableCell);
            if (path && path.length >= 2) {
              nuove[id] = { path, token: Date.now(), purpose: "bar", barEdificioId: barId };
              continue;
            }
          }
        }

        if (azione === "home" && homeCell != null) {
          const pathHome = pianificaCommuteSeraACasa(homeCell, from, cols, rows, isWalkableCell, edificiInMappa);
          if (pathHome && pathHome.length >= 2) {
            nuove[id] = { path: pathHome, token: Date.now(), purpose: "home" };
          }
        }
      }
      if (Object.keys(nuove).length > 0) {
        setCommuteByAbitanteId((prevComm) => ({ ...prevComm, ...nuove }));
      }
      setLavoroArrivatiIds(new Set());
    }
  }, [
    orologioMinuti,
    statoCielo.buio,
    abitanti,
    edifici,
    edificiInMappa,
    cols,
    rows,
    isWalkableCell,
    lavoroArrivatiIds,
    cellaCasaPerAbitanteId,
    aggiornaAbitanteById,
    coprifuocoAttivo,
    coprifuocoInizioMinuti,
    coprifuocoFineMinuti,
    inventarioMensaByEdificioId,
    minutiAbsGioco,
    provaCommuteRapina
  ]);

  const handleCommuteFinita = useCallback(
    (
      abitanteId: number,
      purpose: CommutePurpose,
      barEdificioId?: number,
      mensaEdificioId?: number,
      cultoEdificioId?: number,
      negozioEdificioId?: number,
      rapinaTarget?: RapinaTarget,
      lavoroCercaEdificioId?: number
    ) => {
      const pathCorrente = commuteByAbitanteId[abitanteId]?.path;
      const cellaArrivo =
        pathCorrente && pathCorrente.length > 0
          ? pathCorrente[pathCorrente.length - 1]!
          : (ultimaCellaAbitanteRef.current.get(abitanteId) ?? null);
      if (cellaArrivo != null) {
        ultimaCellaAbitanteRef.current.set(abitanteId, cellaArrivo);
      }

      setCommuteByAbitanteId((prev) => {
        const { [abitanteId]: _removed, ...rest } = prev;
        return rest;
      });
      if (purpose === "home") {
        setDormonoACasaIds((s) => new Set(s).add(abitanteId));
        aggiornaAbitanteById(abitanteId, (a) =>
          applicaRecuperoEnergiaSonno(a, {
            nomeResidenza: getEdificioAbitazione(a.id, edifici)?.nome ?? null
          })
        );
      } else if (purpose === "work") {
        setLavoroArrivatiIds((s) => new Set(s).add(abitanteId));
        setBarArrivatiByEdificio((p) => rimuoviAbitanteDaTuttiBar(p, abitanteId));
        setCultoArrivatiByEdificio((p) => rimuoviAbitanteDaTuttiCulti(p, abitanteId));
      } else if (purpose === "cerca_lavoro" && lavoroCercaEdificioId != null) {
        assumiCittadinoDisoccupatoAEdificio(abitanteId, lavoroCercaEdificioId);
        setLavoroArrivatiIds((s) => new Set(s).add(abitanteId));
        setBarArrivatiByEdificio((p) => rimuoviAbitanteDaTuttiBar(p, abitanteId));
        setCultoArrivatiByEdificio((p) => rimuoviAbitanteDaTuttiCulti(p, abitanteId));
      } else if (purpose === "bar" && barEdificioId != null) {
        const altriGiaNelBar = (barArrivatiByEdificio[barEdificioId] ?? []).filter(
          (id) => id !== abitanteId
        ).length;
        setBarArrivatiByEdificio((p) => aggiungiAbitanteAlBarEdificio(p, barEdificioId, abitanteId));
        setCultoArrivatiByEdificio((p) => rimuoviAbitanteDaTuttiCulti(p, abitanteId));
        let spesaBar = 0;
        aggiornaAbitanteById(abitanteId, (a) => {
          const pagato = provaSpendiMoneteInventarioAbitante(a, COSTO_BAR_MONETE);
          if (pagato) {
            spesaBar = COSTO_BAR_MONETE;
            return applicaRecuperoBar(pagato, altriGiaNelBar);
          }
          return patchBisogni(a, {
            divertimento: 8,
            socialita: 5 + Math.min(10, altriGiaNelBar * 2)
          });
        });
        if (spesaBar > 0) accreditaMoneteGiocatore(spesaBar);
      } else if (purpose === "mensa" && mensaEdificioId != null) {
        serviPastoMensaAbitante(abitanteId, mensaEdificioId);
        setBarArrivatiByEdificio((p) => rimuoviAbitanteDaTuttiBar(p, abitanteId));
        setCultoArrivatiByEdificio((p) => rimuoviAbitanteDaTuttiCulti(p, abitanteId));
      } else if (purpose === "negozio" && negozioEdificioId != null) {
        let spesaNegozio = 0;
        aggiornaAbitanteById(abitanteId, (a) => {
          const prima = getMoneteInventarioAbitante(a.inventario);
          const dopo = compraEMangiaAlNegozio(a);
          if (!dopo) return a;
          spesaNegozio = Math.max(0, prima - getMoneteInventarioAbitante(dopo.inventario));
          return dopo;
        });
        if (spesaNegozio > 0) accreditaMoneteGiocatore(spesaNegozio);
        setBarArrivatiByEdificio((p) => rimuoviAbitanteDaTuttiBar(p, abitanteId));
        setCultoArrivatiByEdificio((p) => rimuoviAbitanteDaTuttiCulti(p, abitanteId));
      } else if (purpose === "culto" && cultoEdificioId != null) {
        setCultoArrivatiByEdificio((p) => aggiungiAbitanteAlCultoEdificio(p, cultoEdificioId, abitanteId));
        setBarArrivatiByEdificio((p) => rimuoviAbitanteDaTuttiBar(p, abitanteId));
        aggiornaAbitanteById(abitanteId, applicaRecuperoCulto);
      } else if (purpose === "rapina" && rapinaTarget != null) {
        const ladro = abitanti.find((a) => a.id === abitanteId);
        if (ladro) {
          const esito = resolveRapina(ladro, rapinaTarget, {
            abitanti,
            edifici,
            inventarioMensaByEdificioId,
            minutiDaMezzanotte: orologioMinuti,
            èNotte: statoCielo.buio > 0.5,
            suStrada: cellaArrivo != null ? isRoadCell(cellaArrivo) : false
          });
          aggiornaAbitanteById(abitanteId, () => esito.nextLadro);
          if (esito.nextVittima) {
            aggiornaAbitanteById(esito.nextVittima.id, () => esito.nextVittima!);
          }
          if (esito.nextInventarioMensa) {
            setInventarioMensaEdificio(
              esito.nextInventarioMensa.edificioId,
              esito.nextInventarioMensa.inventario
            );
          }
          setEsitoRapinaByAbitanteId((prev) => ({
            ...prev,
            [abitanteId]: esito.testoAzione
          }));
          if (esito.scoperto && esito.messaggioScoperta) {
            appendDiarioRiga(esito.messaggioScoperta);
            Alert.alert("Furto scoperto", esito.messaggioScoperta);
          }
        }
        setBarArrivatiByEdificio((p) => rimuoviAbitanteDaTuttiBar(p, abitanteId));
        setCultoArrivatiByEdificio((p) => rimuoviAbitanteDaTuttiCulti(p, abitanteId));
      }
    },
    [
      serviPastoMensaAbitante,
      aggiornaAbitanteById,
      accreditaMoneteGiocatore,
      assumiCittadinoDisoccupatoAEdificio,
      edifici,
      barArrivatiByEdificio,
      abitanti,
      inventarioMensaByEdificioId,
      orologioMinuti,
      statoCielo.buio,
      isRoadCell,
      setInventarioMensaEdificio,
      appendDiarioRiga,
      commuteByAbitanteId
    ]
  );

  /**
   * Commute bloccata da occupancy: ripianifica evitando celle occupate da altri.
   * Se fallisce e purpose è home → completa comunque (entra in casa).
   */
  const handleCommuteBloccata = useCallback(
    (
      abitanteId: number,
      info: {
        fromCell: number;
        blockedCell: number;
        purpose: CommutePurpose;
      }
    ) => {
      const meta = commuteByAbitanteId[abitanteId];
      const from = info.fromCell;
      ultimaCellaAbitanteRef.current.set(abitanteId, from);

      const goalLiberi = new Set<number>();
      const registraGoalsDaAnchor = (anchor: number | null) => {
        if (anchor == null) return;
        const porta = trovaCellaPortaEdificio(anchor, edificiInMappa, cols, rows, isWalkableCell);
        if (porta != null) goalLiberi.add(porta);
      };

      let anchorDest: number | null = null;
      if (info.purpose === "home") {
        anchorDest = cellaCasaPerAbitanteId.get(abitanteId) ?? null;
      } else if (info.purpose === "work") {
        const lav = primoEdificioLavoroOrarioPerAbitante(abitanteId, edifici);
        anchorDest = lav ? trovaAnchorEdificioGlobaleSuMappa(lav.id, edificiInMappa) : null;
      } else if (info.purpose === "cerca_lavoro" && meta?.lavoroCercaEdificioId != null) {
        anchorDest = trovaAnchorEdificioGlobaleSuMappa(meta.lavoroCercaEdificioId, edificiInMappa);
      } else if (info.purpose === "bar" && meta?.barEdificioId != null) {
        anchorDest = trovaAnchorEdificioGlobaleSuMappa(meta.barEdificioId, edificiInMappa);
      } else if (info.purpose === "mensa" && meta?.mensaEdificioId != null) {
        anchorDest = trovaAnchorEdificioGlobaleSuMappa(meta.mensaEdificioId, edificiInMappa);
      } else if (info.purpose === "negozio" && meta?.negozioEdificioId != null) {
        anchorDest = trovaAnchorEdificioGlobaleSuMappa(meta.negozioEdificioId, edificiInMappa);
      } else if (info.purpose === "culto" && meta?.cultoEdificioId != null) {
        anchorDest = trovaAnchorEdificioGlobaleSuMappa(meta.cultoEdificioId, edificiInMappa);
      }
      registraGoalsDaAnchor(anchorDest);

      const isWalkableEvitandoAltri = (i: number) => {
        if (!isWalkableCell(i)) return false;
        if (goalLiberi.has(i)) return true;
        const occ = cellaOccupataDaAbitanteRef.current.get(i);
        if (occ != null && occ !== abitanteId) return false;
        return true;
      };

      let path: number[] | null = null;
      if (anchorDest != null) {
        path = calcolaPercorsoVersoAnchorEdificio(
          from,
          anchorDest,
          cols,
          rows,
          isWalkableEvitandoAltri,
          edificiInMappa
        );
        if (!path || path.length < 2) {
          path = calcolaPercorsoVersoAnchorEdificio(from, anchorDest, cols, rows, isWalkableCell, edificiInMappa);
        }
      }

      if (path && path.length >= 2) {
        const idxFrom = path.indexOf(from);
        const pathNorm =
          idxFrom >= 0 ? path.slice(idxFrom) : path[0] === from ? path : [from, ...path];
        if (pathNorm.length >= 2) {
          setCommuteByAbitanteId((prev) => ({
            ...prev,
            [abitanteId]: {
              path: pathNorm,
              token: Date.now(),
              purpose: info.purpose,
              barEdificioId: meta?.barEdificioId,
              mensaEdificioId: meta?.mensaEdificioId,
              cultoEdificioId: meta?.cultoEdificioId,
              negozioEdificioId: meta?.negozioEdificioId,
              lavoroCercaEdificioId: meta?.lavoroCercaEdificioId,
              rapinaTarget: meta?.rapinaTarget
            }
          }));
          return;
        }
      }

      if (info.purpose === "home") {
        handleCommuteFinita(abitanteId, "home");
      }
    },
    [
      commuteByAbitanteId,
      cellaCasaPerAbitanteId,
      cols,
      rows,
      isWalkableCell,
      edifici,
      edificiInMappa,
      handleCommuteFinita
    ]
  );

  /** Tempo libero: bisogni spingono snack / mensa / negozio / bar / casa (se non già in commute o al lavoro). */
  useEffect(() => {
    if (statoCielo.buio > 0.5) return;

    const cfgCoprifuoco = {
      attivo: coprifuocoAttivo,
      inizioMinuti: coprifuocoInizioMinuti,
      fineMinuti: coprifuocoFineMinuti
    };
    const nuoveCommuteById: Record<number, CommuteInfo> = {};

    for (const a of abitanti) {
      if (a.razza === "Golem") continue;
      if (commuteByAbitanteId[a.id]) continue;
      if (abitanteInOrarioLavoroEdificio(a.id, orologioMinuti, edifici) && lavoroArrivatiIds.has(a.id)) {
        continue;
      }
      if (Object.values(barArrivatiByEdificio).some((ids) => ids.includes(a.id))) continue;

      const homeCell = cellaCasaPerAbitanteId.get(a.id) ?? null;
      const from =
        ultimaCellaAbitanteRef.current.get(a.id) ?? (homeCell != null ? homeCell : null);
      if (from == null) continue;

      // Coprifuoco: solo rientro a casa (esenti Centrale).
      if (abitanteSoggettoACoprifuoco(a, edifici, cfgCoprifuoco, orologioMinuti)) {
        if (homeCell != null && from !== homeCell) {
          const path = pianificaCommuteSeraACasa(homeCell, from, cols, rows, isWalkableCell, edificiInMappa);
          if (path && path.length >= 2) {
            nuoveCommuteById[a.id] = { path, token: Date.now(), purpose: "home" };
          }
        }
        continue;
      }

      const snack = tentaSnackDaInventario(a);
      if (snack) {
        aggiornaAbitanteById(a.id, () => snack);
        continue;
      }

      const puòRapinare = abitantePuòTentareRapina(a, {
        edifici,
        inventarioMensaByEdificioId,
        ultimoTentativoAbsMinuti: ultimoTentativoRapinaAbsRef.current.get(a.id) ?? null,
        oraAbsMinuti: minutiAbsGioco()
      });
      const azione = scegliAzioneTempoLibero(a, {
        puòUsareMensa: abitanteHaBisognoMensa(a, edifici),
        puòUsareNegozio: abitanteVuoleNegozio(a, edifici),
        puòRapinare,
        haCasa: homeCell != null
      });

      const puòCercareLavoro =
        getCastaAbitante(a) === "Cittadino" && abitanteVuolePrendereLavoro(a);

      if (azione === "mensa") {
        const mensaId = scegliMensaEdificioIdPiuVicino(
          from,
          edifici,
          edificiInMappa,
          cols,
          rows,
          isWalkableCell
        );
        if (mensaId == null) {
          /* fall through */
        } else {
          const path = pianificaCommuteVersoEdificioGlobaleDaCella(
            from,
            mensaId,
            edificiInMappa,
            cols,
            rows,
            isWalkableCell
          );
          if (path && path.length >= 2) {
            nuoveCommuteById[a.id] = {
              path,
              token: Date.now(),
              purpose: "mensa",
              mensaEdificioId: mensaId
            };
            continue;
          }
        }
      }

      if (azione === "negozio") {
        const negozioId = scegliEdificioIdPiuVicinoPerNome(
          "Negozio",
          from,
          edifici,
          edificiInMappa,
          cols,
          rows,
          isWalkableCell
        );
        if (negozioId != null) {
          const path = pianificaCommuteVersoEdificioGlobaleDaCella(
            from,
            negozioId,
            edificiInMappa,
            cols,
            rows,
            isWalkableCell
          );
          if (path && path.length >= 2) {
            nuoveCommuteById[a.id] = {
              path,
              token: Date.now(),
              purpose: "negozio",
              negozioEdificioId: negozioId
            };
            continue;
          }
        }
      }

      if (azione === "rapina") {
        const rapina = provaCommuteRapina(a, from);
        if (rapina) nuoveCommuteById[a.id] = rapina;
        continue;
      }

      if (puòCercareLavoro) {
        const posti = elencoEdificiConPostoPerDisoccupato(a, edifici);
        let bestId: number | null = null;
        let bestPath: number[] | null = null;
        let bestLen = Infinity;
        for (const e of posti) {
          const path = pianificaCommuteVersoEdificioGlobaleDaCella(
            from,
            e.id,
            edificiInMappa,
            cols,
            rows,
            isWalkableCell
          );
          if (!path || path.length < 2) continue;
          if (path.length < bestLen) {
            bestLen = path.length;
            bestId = e.id;
            bestPath = path;
          }
        }
        if (bestId != null && bestPath != null) {
          nuoveCommuteById[a.id] = {
            path: bestPath,
            token: Date.now(),
            purpose: "cerca_lavoro",
            lavoroCercaEdificioId: bestId
          };
          continue;
        }
      }

      if (azione === "nessuna") continue;

      if (azione === "bar") {
        const barId = scegliBarEdificioIdPiuVicino(from, edifici, edificiInMappa, cols, rows, isWalkableCell);
        if (barId == null) continue;
        const path = pianificaCommuteVersoBarDaCella(from, barId, edificiInMappa, cols, rows, isWalkableCell);
        if (!path || path.length < 2) continue;
        nuoveCommuteById[a.id] = {
          path,
          token: Date.now(),
          purpose: "bar",
          barEdificioId: barId
        };
        continue;
      }

      if (azione === "home" && homeCell != null) {
        const path = pianificaCommuteSeraACasa(homeCell, from, cols, rows, isWalkableCell, edificiInMappa);
        if (!path || path.length < 2) continue;
        nuoveCommuteById[a.id] = { path, token: Date.now(), purpose: "home" };
      }
    }

    const ids = Object.keys(nuoveCommuteById).map(Number);
    if (ids.length === 0) return;

    setCommuteByAbitanteId((prevComm) => ({ ...prevComm, ...nuoveCommuteById }));
    setBarArrivatiByEdificio((prevBar) => {
      let acc = prevBar;
      for (const id of ids) acc = rimuoviAbitanteDaTuttiBar(acc, id);
      return acc;
    });
  }, [
    abitanti,
    edifici,
    edificiInMappa,
    statoCielo.buio,
    orologioMinuti,
    lavoroArrivatiIds,
    barArrivatiByEdificio,
    cols,
    rows,
    isWalkableCell,
    cellaCasaPerAbitanteId,
    commuteByAbitanteId,
    aggiornaAbitanteById,
    coprifuocoAttivo,
    coprifuocoInizioMinuti,
    coprifuocoFineMinuti,
    inventarioMensaByEdificioId,
    minutiAbsGioco,
    provaCommuteRapina
  ]);

  /** Chi è al bar ma non ha più bisogno di Divertimento/Socialità esce. */
  useEffect(() => {
    if (statoCielo.buio > 0.5) return;
    setBarArrivatiByEdificio((prev) => {
      let changed = false;
      let next = prev;
      for (const [k, ids] of Object.entries(prev)) {
        const kept = ids.filter((id) => {
          const a = abitanti.find((x) => x.id === id);
          if (!a) {
            changed = true;
            return false;
          }
          if (!abitanteAlBarRoutineOra(a, orologioMinuti, statoCielo.buio, edifici)) {
            changed = true;
            return false;
          }
          return true;
        });
        if (kept.length !== ids.length) {
          next = { ...next, [Number(k)]: kept };
        }
      }
      return changed ? next : prev;
    });
  }, [abitanti, orologioMinuti, statoCielo.buio, edifici]);

  const handleCellAbitante = useCallback((abitanteId: number, cell: number) => {
    ultimaCellaAbitanteRef.current.set(abitanteId, cell);
  }, []);

  const passTouchesToMapOnCellPerWanderer = useCallback(
    (cell: number) => {
      if (modalitaDemolisci || costruzioneSelezione != null) return true;
      return cellaÈNelFootprintResidenzaMappa(cell, edificiInMappa, cols);
    },
    [modalitaDemolisci, costruzioneSelezione, edificiInMappa, cols]
  );

  useEffect(() => {
    const notte = statoCielo.buio > 0.5;
    if (prevBuioNotteTransitRef.current === undefined) {
      prevBuioNotteTransitRef.current = notte;
      if (notte) {
        const s = new Set<number>();
        for (const a of abitanti) {
          if (cellaCasaPerAbitanteId.get(a.id) != null) s.add(a.id);
        }
        setDormonoACasaIds(s);
      }
      return;
    }
    if (prevBuioNotteTransitRef.current === notte) return;
    const eraNotte = prevBuioNotteTransitRef.current;
    prevBuioNotteTransitRef.current = notte;

    if (eraNotte && !notte) {
      setDormonoACasaIds(new Set());
      setLavoroArrivatiIds(new Set());
      const next: Record<number, CommuteInfo> = {};
      for (const a of abitanti) {
        if (a.razza === "Golem") continue;
        const home = cellaCasaPerAbitanteId.get(a.id) ?? null;
        const ult = ultimaCellaAbitanteRef.current.get(a.id) ?? null;
        const fromBase = ult ?? home;
        const puòRapinare =
          fromBase != null &&
          abitantePuòTentareRapina(a, {
            edifici,
            inventarioMensaByEdificioId,
            ultimoTentativoAbsMinuti: ultimoTentativoRapinaAbsRef.current.get(a.id) ?? null,
            oraAbsMinuti: minutiAbsGioco()
          });
        const mattina = pianificaCommuteMattina(
          a,
          home,
          ult,
          edifici,
          edificiInMappa,
          cols,
          rows,
          isWalkableCell,
          orologioMinuti,
          { puòRapinare }
        );

        if (mattina.purpose === "rapina" && fromBase != null) {
          const rapina = provaCommuteRapina(a, fromBase);
          if (rapina) {
            next[a.id] = rapina;
            continue;
          }
        }

        const path = mattina.path;
        if (!path || path.length < 2) continue;
        const purpose: CommutePurpose =
          mattina.purpose && mattina.purpose !== "rapina"
            ? mattina.purpose
            : mattina.mensaEdificioId
              ? "mensa"
              : mattina.negozioEdificioId
                ? "negozio"
                : mattina.barEdificioId
                  ? "bar"
                  : mattina.lavoroCercaEdificioId
                    ? "cerca_lavoro"
                    : "work";
        next[a.id] = {
          path,
          token: Date.now(),
          purpose,
          barEdificioId: purpose === "bar" ? mattina.barEdificioId : undefined,
          mensaEdificioId: purpose === "mensa" ? mattina.mensaEdificioId : undefined,
          negozioEdificioId: purpose === "negozio" ? mattina.negozioEdificioId : undefined,
          lavoroCercaEdificioId:
            purpose === "cerca_lavoro" ? mattina.lavoroCercaEdificioId : undefined
        };
      }
      setCommuteByAbitanteId(next);
      setLavoroArrivatiIds((prev) => {
        const s = new Set(prev);
        for (const a of abitanti) {
          if (a.razza === "Golem") continue;
          if (next[a.id]?.purpose === "rapina") continue;
          // Fame critica eleggibile a rapina: non teletrasportare al lavoro.
          if (
            abitantePuòTentareRapina(a, {
              edifici,
              inventarioMensaByEdificioId,
              ultimoTentativoAbsMinuti: ultimoTentativoRapinaAbsRef.current.get(a.id) ?? null,
              oraAbsMinuti: minutiAbsGioco()
            })
          ) {
            continue;
          }
          const lav = primoEdificioLavoroOrarioPerAbitante(a.id, edifici);
          if (lav && !next[a.id]) {
            const fascia = fasciaPerEdificio(lav);
            if (fascia && minutiInFascia(orologioMinuti, fascia)) s.add(a.id);
          }
        }
        return s;
      });
      // Arrivi al bar solo a fine commute (niente teletrasporto).
      setBarArrivatiByEdificio({});
      setCultoArrivatiByEdificio({});
    }

    if (!eraNotte && notte) {
      setLavoroArrivatiIds(new Set());
      setBarArrivatiByEdificio({});
      setCultoArrivatiByEdificio({});
      const next: Record<number, { path: number[]; token: number; purpose: "home" }> = {};
      const dormiSenzaPercorso: number[] = [];
      for (const a of abitanti) {
        const home = cellaCasaPerAbitanteId.get(a.id);
        if (home == null) continue;
        const from = ultimaCellaAbitanteRef.current.get(a.id) ?? home;
        const path = pianificaCommuteSeraACasa(home, from, cols, rows, isWalkableCell, edificiInMappa);
        if (path && path.length >= 2) {
          next[a.id] = { path, token: Date.now(), purpose: "home" };
        } else {
          dormiSenzaPercorso.push(a.id);
        }
      }
      setCommuteByAbitanteId(next);
      if (dormiSenzaPercorso.length > 0) {
        setDormonoACasaIds((prev) => {
          const s = new Set(prev);
          for (const id of dormiSenzaPercorso) s.add(id);
          return s;
        });
      }
    }
  }, [
    statoCielo.buio,
    abitanti,
    cellaCasaPerAbitanteId,
    edifici,
    edificiInMappa,
    cols,
    rows,
    isWalkableCell,
    orologioMinuti,
    inventarioMensaByEdificioId,
    minutiAbsGioco,
    provaCommuteRapina
  ]);

  const edificiFootprintOverlay = useMemo(() => {
    const list: {
      anchor: number;
      fp: { w: number; h: number };
      variant: FootprintVariant;
      progressoCostruzione?: number;
    }[] = [];
    for (const [i, e] of Object.entries(edificiInMappa)) {
      if (e.footprint && !e.footprintRef) {
        const globaleId = e.edificioGlobaleId ?? e.id;
        const edificioGlobale = edifici.find((x) => x.id === globaleId);
        const inCostruzione = edificioGlobale?.stato === "In costruzione";

        const variantFinale: FootprintVariant =
          e.nome === "Dormitorio"
            ? "dormitorio"
            : e.nome === "Bar"
              ? "bar"
              : e.nome === "Tribunale"
                ? "tribunale"
                : e.nome === "Ufficio Immigrazione"
                  ? "ufficio_immigrazione"
                  : e.nome === "Ufficio Edile"
                    ? "ufficio_edile"
                    : e.nome === "Mercato"
                      ? "mercato"
                      : e.nome === "Negozio"
                        ? "negozio"
                        : e.nome === "Mensa Pubblica"
                          ? "mensa"
                          : e.nome === "Dissalatore"
                            ? "dissalatore"
                            : e.nome === "Spazioporto"
                              ? "spazioporto"
                              : e.nome === "Serra"
                                ? "serra"
                                : e.nome === "Capanna"
                                  ? "capanna"
                                  : e.nome === "Luogo di Culto del Sole"
                                    ? "luogo_culto_sole"
                                    : e.nome === "Luogo di Culto degli Alieni"
                                      ? "luogo_culto_alieni"
                                      : e.nome === "Carcere"
                                        ? "carcere"
                                        : e.nome === "Campo di Lavoro"
                                          ? "campo_lavoro"
                                          : e.nome === "Campo di Sterminio"
                                            ? "campo_sterminio"
                                            : e.nome === "Caserma"
                                              ? "caserma"
                                              : e.nome === "Centrale"
                                                ? "centrale_polizia"
                                                : "amministrazione";
        list.push({
          anchor: Number(i),
          fp: e.footprint,
          variant: inCostruzione ? "cantiere" : variantFinale,
          progressoCostruzione: inCostruzione ? (edificioGlobale?.progressoCostruzione ?? 0) : undefined
        });
      }
    }
    return list;
  }, [edificiInMappa, edifici]);

  const visibleFootprintOverlay = useMemo(
    () =>
      edificiFootprintOverlay.filter(({ anchor, fp }) =>
        footprintIntersectsRange(anchor, fp, cols, visibleCellRange)
      ),
    [edificiFootprintOverlay, cols, visibleCellRange]
  );

  const openRouteForEdificio = useCallback(
    (nome: string, edificioId?: number) => {
      const route = EDIFICIO_TO_ROUTE[nome];
      if (!route) return;
      if (nome === "Serra" && edificioId != null) {
        router.push(`/serra/${edificioId}`);
        return;
      }
      if (nome === "Bar" && edificioId != null) {
        router.push(`/bar/${edificioId}`);
        return;
      }
      if (nome === "Mensa Pubblica" && edificioId != null) {
        router.push(`/mensa/${edificioId}`);
        return;
      }
      router.push(route);
    },
    [router]
  );

  const edificioResidenzaAperta = useMemo(() => {
    if (selectedResidenzaAnchor === null) return null;
    return edificiInMappa[selectedResidenzaAnchor] ?? null;
  }, [selectedResidenzaAnchor, edificiInMappa]);

  const occupantiCasaMappaIds = useMemo(() => {
    if (selectedResidenzaAnchor === null) return [];
    return residenzeMappa[selectedResidenzaAnchor] ?? [];
  }, [selectedResidenzaAnchor, residenzeMappa]);

  const luogoCultoModalCtx = useMemo(() => {
    if (selectedLuogoCultoAnchor === null) return null;
    const e = edificiInMappa[selectedLuogoCultoAnchor];
    if (!e || !èNomeLuogoCulto(e.nome)) return null;
    const religione = religioneDaNomeEdificioLuogoCulto(e.nome);
    if (!religione) return null;
    const edificioGlobaleId = e.edificioGlobaleId ?? e.id;
    const capoId = religione === "Culto del Sole" ? capoReligiosoSole : capoReligiosoAlieni;
    return {
      anchor: selectedLuogoCultoAnchor,
      nome: e.nome,
      religione,
      edificioGlobaleId,
      capoId
    };
  }, [selectedLuogoCultoAnchor, edificiInMappa, capoReligiosoSole, capoReligiosoAlieni]);

  const handleApriResidenzaMappa = useCallback(
    (anchor: number) => {
      const prepared = preparaResidenzeMappaPerLookup(edifici, edificiInMappa, residenzeMappa);
      if (prepared !== residenzeMappa) {
        setMappaStatePersistente((s) => ({ ...s, residenzeMappa: prepared }));
      }
      setSelectedResidenzaAnchor(anchor);
    },
    [edifici, edificiInMappa, residenzeMappa, setMappaStatePersistente]
  );

  const altreCaseMappaTengonoId = useCallback(
    (abitanteId: number, anchorEscluso: number) => {
      for (const [k, ids] of Object.entries(residenzeMappa)) {
        if (Number(k) === anchorEscluso) continue;
        if (ids.includes(abitanteId)) return true;
      }
      return false;
    },
    [residenzeMappa]
  );

  const candidatiPerCasaMappa = useMemo(() => {
    if (selectedResidenzaAnchor === null || !edificioResidenzaAperta) return [];
    const nome = edificioResidenzaAperta.nome;
    const anchor = selectedResidenzaAnchor;
    const out: Abitante[] = [];
    for (const a of abitanti) {
      if (altreCaseMappaTengonoId(a.id, anchor)) continue;
      if ((residenzeMappa[anchor] ?? []).includes(a.id)) continue;
      const dove = residenzaGlobaleDi(a.id, edifici);
      if (nome === "Capanna") {
        if (dove && dove.nome !== "Capanna") continue;
      } else if (nome === "Dormitorio") {
        if (a.fazioni?.includes("Senzatetto")) continue;
        if (dove && dove.nome !== "Dormitorio") continue;
      } else if (nome === "Baracca") {
        if (!a.fazioni?.includes("Senzatetto")) continue;
      } else continue;
      out.push(a);
    }
    return out;
  }, [
    selectedResidenzaAnchor,
    edificioResidenzaAperta,
    abitanti,
    edifici,
    residenzeMappa,
    altreCaseMappaTengonoId
  ]);

  const postiLiberiCasaMappa = Math.max(0, POSTI_PER_CASA_MAPPA - occupantiCasaMappaIds.length);

  const handleRimuoviDaCasaMappa = useCallback(
    (abitanteId: number) => {
      if (selectedResidenzaAnchor === null || !edificioResidenzaAperta) return;
      setMappaStatePersistente((s) => {
        const cur = s.residenzeMappa[selectedResidenzaAnchor] ?? [];
        if (!cur.includes(abitanteId)) return s;
        const nextList = cur.filter((id) => id !== abitanteId);
        return {
          ...s,
          residenzeMappa: {
            ...s.residenzeMappa,
            [selectedResidenzaAnchor]: nextList
          }
        };
      });
    },
    [selectedResidenzaAnchor, setMappaStatePersistente]
  );

  const handleAggiungiACasaMappa = useCallback(
    (abitanteId: number) => {
      if (selectedResidenzaAnchor === null || !edificioResidenzaAperta || postiLiberiCasaMappa <= 0) return;
      const nome = edificioResidenzaAperta.nome;
      const anchor = selectedResidenzaAnchor;
      const globId = idGlobalePerResidenzaInCella(edificioResidenzaAperta, nome);
      if (!abitanti.some((x) => x.id === abitanteId)) return;

      if (nome === "Capanna" || nome === "Dormitorio") {
        if (globId == null) return;
        const giàNelTipo =
          nome === "Capanna"
            ? residenzaGlobaleDi(abitanteId, edifici)?.nome === "Capanna"
            : residenzaGlobaleDi(abitanteId, edifici)?.nome === "Dormitorio";
        if (!giàNelTipo) {
          for (const e of edifici) {
            if (e.tipo === "Residenza" && (e.abitantiAssegnati ?? []).includes(abitanteId)) {
              rimuoviAbitanteDaEdificio(abitanteId, e.id);
            }
          }
          assegnaAbitanteAEdificio(abitanteId, globId);
        }
      }

      setMappaStatePersistente((s) => {
        const next: Record<number, number[]> = {};
        for (const [k, ids] of Object.entries(s.residenzeMappa)) {
          next[Number(k)] = ids.filter((id) => id !== abitanteId);
        }
        const cur = next[anchor] ?? [];
        if (cur.length >= POSTI_PER_CASA_MAPPA || cur.includes(abitanteId)) return s;
        next[anchor] = [...cur, abitanteId];
        return { ...s, residenzeMappa: next };
      });
    },
    [
      selectedResidenzaAnchor,
      edificioResidenzaAperta,
      postiLiberiCasaMappa,
      abitanti,
      edifici,
      rimuoviAbitanteDaEdificio,
      assegnaAbitanteAEdificio,
      setMappaStatePersistente
    ]
  );

  const handleScegliEdificio = useCallback(
    (cellIndex: number, e: Edificio) => {
      if (e.nome === "Strada") {
        const cur = mappaStateRef.current;
        const { anchor } = calcolaAnchorStrada2x2(cellIndex, FIXED_MAP_COLS, FIXED_MAP_ROWS);
        if (
          anchor == null ||
          !footprintStrada2x2Valido(anchor, FIXED_MAP_COLS, FIXED_MAP_ROWS, cur.terrenoInMappa, cur.edificiInMappa)
        ) {
          Alert.alert(
            "Non qui",
            "La strada richiede un'area 2×2 su erba, lontana da acqua, fiumi e spiaggia, senza edifici."
          );
          return;
        }
        setMappaStatePersistente((s) => {
          const nextEdifici = { ...s.edificiInMappa };
          applicaStradaFootprint2x2(anchor, FIXED_MAP_COLS, nextEdifici, STRADA_OPZIONE);
          applicaRegoleConfineTerreno(nextEdifici, s.terrenoInMappa, FIXED_MAP_COLS, FIXED_MAP_ROWS, {
            collegaEdificiAllaStrada: false
          });
          return { ...s, edificiInMappa: nextEdifici };
        });
        return;
      }

      const s = mappaStateRef.current;
      const { anchor, w, h } = calcolaAnchorEdificioMultiCella(
        cellIndex,
        e.nome,
        s.edificiInMappa,
        s.terrenoInMappa,
        FIXED_MAP_COLS,
        FIXED_MAP_ROWS
      );
      if (anchor == null) {
        Alert.alert(
          "Spazio insufficiente",
          e.nome === "Dissalatore"
            ? "Il Dissalatore richiede un’area 2×2 con esattamente 2 celle sulla sabbia e 2 sul mare (bordo acqua)."
            : "Non c'è spazio adatto (terreno, cuscino d'erba o distanza dagli altri edifici)."
        );
        return;
      }

      if (
        !edificioRispettaCriteriPiazzamento(
          e.nome,
          anchor,
          w,
          h,
          s.edificiInMappa,
          s.terrenoInMappa,
          FIXED_MAP_COLS,
          FIXED_MAP_ROWS
        )
      ) {
        Alert.alert(
          "Spazio insufficiente",
          e.nome === "Dissalatore"
            ? "Il Dissalatore richiede un’area 2×2 con esattamente 2 celle sulla sabbia e 2 sul mare (bordo acqua)."
            : "Non c'è spazio adatto (terreno, cuscino d'erba o distanza dagli altri edifici)."
        );
        return;
      }

      const costoMateriale = costoMaterialeEdilePerFootprint(e.nome, w, h);
      if (!haMaterialeEdileSufficiente(risorse, costoMateriale)) {
        Alert.alert(
          "Materiale insufficiente",
          `Servono ${costoMateriale} tonnellate di Materiale Edile (disponibili: ${quantitaMaterialeEdile(risorse)}).`
        );
        return;
      }

      const newId = aggiungiEdificioDaTemplate(e.id, { costoMateriale });
      if (newId == null) {
        Alert.alert("Errore", "Impossibile creare questo tipo di edificio.");
        return;
      }

      setMappaStatePersistente((prev) => {
        const nextEdifici = { ...prev.edificiInMappa };
        applicaEdificioFootprintCostruzione(nextEdifici, anchor!, w, h, FIXED_MAP_COLS, {
          id: newId,
          nome: e.nome,
          emoji: e.emoji,
          edificioGlobaleId: newId
        });
        applicaRegoleConfineTerreno(nextEdifici, prev.terrenoInMappa, FIXED_MAP_COLS, FIXED_MAP_ROWS, {
          collegaEdificiAllaStrada: false
        });
        let nextResidenze = prev.residenzeMappa;
        if (èResidenzaMappa(e.nome)) {
          nextResidenze = { ...prev.residenzeMappa, [anchor!]: prev.residenzeMappa[anchor!] ?? [] };
        }
        return { ...prev, edificiInMappa: nextEdifici, residenzeMappa: nextResidenze };
      });
      uscitaCostruzione();
    },
    [setMappaStatePersistente, aggiungiEdificioDaTemplate, uscitaCostruzione, risorse]
  );

  const eseguiDemolizione = useCallback(
    (
      anchor: number,
      w: number,
      h: number,
      cap: EdificioInCella,
      globalId: number | undefined
    ) => {
      setMappaStatePersistente((s) => {
        const nextEdifici = { ...s.edificiInMappa };
        rimuoviFootprintEdificioDaMappa(nextEdifici, anchor, w, h, cols);
        applicaRegoleConfineTerreno(nextEdifici, s.terrenoInMappa, cols, rows, {
          collegaEdificiAllaStrada: false
        });
        let nextResidenze = s.residenzeMappa;
        if (èResidenzaMappa(cap.nome)) {
          nextResidenze = { ...s.residenzeMappa };
          delete nextResidenze[anchor];
        }
        return { ...s, edificiInMappa: nextEdifici, residenzeMappa: nextResidenze };
      });
      if (globalId != null) rimuoviEdificioPerId(globalId);
    },
    [cols, rows, setMappaStatePersistente, rimuoviEdificioPerId]
  );

  const handleDemolisci = useCallback(
    (cellIndex: number) => {
      const e = edificiInMappa[cellIndex];
      if (!e) {
        Alert.alert("Niente da demolire", "Non c'è un edificio su questa cella.");
        return;
      }
      let anchor: number;
      let w: number;
      let h: number;
      if (e.nome === "Strada") {
        const r = calcolaAnchorStrada2x2(cellIndex, cols, rows);
        if (r.anchor == null) return;
        anchor = r.anchor;
        w = r.w;
        h = r.h;
      } else {
        anchor = getAnchorCellPerEdificio(cellIndex, edificiInMappa);
        ({ w, h } = dimensioniFootprintEdificioInMappa(anchor, edificiInMappa));
      }
      const celle = getIndiciFootprint(anchor, w, h, cols);
      if (celle.some((i) => celleProtetteIniziali.has(i))) {
        Alert.alert(
          "Non demolibile",
          "Questo edificio fa parte della colonia iniziale e non può essere rimosso."
        );
        return;
      }
      const cap = edificiInMappa[anchor];
      if (!cap?.nome) return;
      const globalId =
        cap.edificioGlobaleId ?? (edifici.some((x) => x.id === cap.id) ? cap.id : undefined);

      setConfermaDemolizionePending({ anchor, w, h, cap, globalId });
    },
    [edificiInMappa, cols, rows, celleProtetteIniziali, edifici]
  );

  const handlePiazzaTerreno = useCallback(
    (cellIndex: number, kind: TerrenoCostruzioneKind) => {
      const cur = mappaStateRef.current;
      const { anchor } = calcolaAnchorCostruzione2x2(cellIndex, FIXED_MAP_COLS, FIXED_MAP_ROWS);
      if (
        anchor == null ||
        !footprintTerreno2x2Valido(
          kind,
          anchor,
          FIXED_MAP_COLS,
          FIXED_MAP_ROWS,
          cur.terrenoInMappa,
          cur.edificiInMappa
        )
      ) {
        const msg =
          kind === "acqua"
            ? "L'acqua richiede un'area 2×2 libera da edifici (terra o sabbia convertibile in fiume)."
            : kind === "spiaggia"
              ? "La spiaggia richiede un'area 2×2 su terraferma, lontana da mare e fiumi, senza edifici."
              : "L'erba richiede un'area 2×2 su terraferma, lontana da acqua, senza edifici.";
        Alert.alert("Non qui", msg);
        return;
      }
      const celle = getIndiciFootprint(anchor, COSTRUZIONE_TERRENO_FOOTPRINT_W, COSTRUZIONE_TERRENO_FOOTPRINT_H, FIXED_MAP_COLS);
      setMappaStatePersistente((s) => {
        const nextTerreno = { ...s.terrenoInMappa };
        for (const i of celle) {
          if (kind === "acqua") {
            if (!isAcqua(i, FIXED_MAP_COLS, FIXED_MAP_ROWS)) nextTerreno[i] = "river";
          } else if (kind === "spiaggia") {
            nextTerreno[i] = "sabbia";
          } else {
            delete nextTerreno[i];
          }
        }
        applicaRegoleConfineTerreno(s.edificiInMappa, nextTerreno, FIXED_MAP_COLS, FIXED_MAP_ROWS, {
          collegaEdificiAllaStrada: false
        });
        return { ...s, terrenoInMappa: nextTerreno };
      });
    },
    [setMappaStatePersistente]
  );

  const onCellPress = useCallback(
    (cellIndex: number) => {
      // Dopo un pan/trascinamento la libreria può comunque emettere onPress: ignoralo.
      if (mapDraggedRef.current) {
        mapDraggedRef.current = false;
        return;
      }
      setSintesiMappaAbitanteId(null);
      if (modalitaDemolisci) {
        handleDemolisci(cellIndex);
        return;
      }
      if (costruzioneSelezione) {
        const edificio = edificiInMappa[cellIndex];
        const terreno = terrenoInMappa[cellIndex] ?? "erba";
        if (edificio) return;
        const èDissalatore =
          costruzioneSelezione.tipo === "edificio" && costruzioneSelezione.edificio.nome === "Dissalatore";
        const èAcqua =
          costruzioneSelezione.tipo === "terreno" && costruzioneSelezione.kind === "acqua";
        if (èDissalatore) {
          if (terreno === "river") return;
        } else if (!èAcqua && (terreno === "river" || isAcqua(cellIndex, cols, rows))) {
          return;
        }
        if (costruzioneSelezione.tipo === "strada") {
          handleScegliEdificio(cellIndex, STRADA_OPZIONE as unknown as Edificio);
        } else if (costruzioneSelezione.tipo === "terreno") {
          handlePiazzaTerreno(cellIndex, costruzioneSelezione.kind);
        } else {
          handleScegliEdificio(cellIndex, costruzioneSelezione.edificio);
        }
        return;
      }
      const edificio = edificiInMappa[cellIndex];
      const terreno = terrenoInMappa[cellIndex] ?? "erba";
      /** Capanna: un tap apre subito la scheda a tutto schermo (presenze dentro/fuori). */
      if (edificio?.nome === "Capanna") {
        setSelectedResidenzaAnchor(getAnchorCellPerEdificio(cellIndex, edificiInMappa));
        lastTapCell.current = null;
        return;
      }
      /** Serra: apre subito la pagina produzione / assegnazioni. */
      if (edificio?.nome === "Serra") {
        openRouteForEdificio(edificio.nome, edificio.id);
        lastTapCell.current = null;
        return;
      }
      const now = Date.now();
      const isDoubleTap = lastTapCell.current === cellIndex && now - lastTapTime.current < DOPPIO_TAP_MS;
      if (isDoubleTap) {
        lastTapCell.current = null;
        if (edificio) {
          if (edificio.nome === "Giacimento") {
            setSelectedCellForTransformDialog(cellIndex);
          } else if (èResidenzaMappa(edificio.nome)) {
            setSelectedResidenzaAnchor(getAnchorCellPerEdificio(cellIndex, edificiInMappa));
          } else if (èNomeLuogoCulto(edificio.nome)) {
            setSelectedLuogoCultoAnchor(getAnchorCellPerEdificio(cellIndex, edificiInMappa));
          } else {
            openRouteForEdificio(edificio.nome, edificio.id);
          }
        }
        return;
      }
      lastTapCell.current = cellIndex;
      lastTapTime.current = now;
    },
    [
      modalitaDemolisci,
      handleDemolisci,
      costruzioneSelezione,
      edificiInMappa,
      terrenoInMappa,
      openRouteForEdificio,
      cols,
      rows,
      handleScegliEdificio,
      handlePiazzaTerreno
    ]
  );

  const phaserInteraction = useMemo<PhaserMapInteraction>(() => {
    if (costruzioneSelezione) {
      return {
        mode: "build",
        hoverCell: previewCellHover,
        affectedCells: previewPiazzamento?.celle ?? (previewCellHover == null ? [] : [previewCellHover]),
        valid: previewPiazzamento?.valido ?? false
      };
    }
    if (modalitaDemolisci && previewCellHover != null) {
      const target = edificiInMappa[previewCellHover];
      if (!target) {
        return { mode: "demolish", hoverCell: previewCellHover, affectedCells: [previewCellHover], valid: false };
      }
      let anchor: number;
      let w: number;
      let h: number;
      if (target.nome === "Strada") {
        const road = calcolaAnchorStrada2x2(previewCellHover, cols, rows);
        anchor = road.anchor ?? previewCellHover;
        w = road.w;
        h = road.h;
      } else {
        anchor = getAnchorCellPerEdificio(previewCellHover, edificiInMappa);
        ({ w, h } = dimensioniFootprintEdificioInMappa(anchor, edificiInMappa));
      }
      const affectedCells = getIndiciFootprint(anchor, w, h, cols);
      return {
        mode: "demolish",
        hoverCell: previewCellHover,
        affectedCells,
        valid: !affectedCells.some((cell) => celleProtetteIniziali.has(cell))
      };
    }
    return {
      mode: "select",
      hoverCell: previewCellHover,
      affectedCells: previewCellHover == null ? [] : [previewCellHover],
      valid: previewCellHover != null
    };
  }, [
    costruzioneSelezione,
    previewCellHover,
    previewPiazzamento,
    modalitaDemolisci,
    edificiInMappa,
    cols,
    rows,
    celleProtetteIniziali
  ]);

  const phaserCharacters = useMemo<PhaserMapCharacter[]>(() =>
    abitantiPerOverlayMappa.map((abitante, order) => {
      const commute = commuteByAbitanteId[abitante.id];
      const home = cellaCasaPerAbitanteId.get(abitante.id) ?? null;
      const fallback = (6 + Math.floor(order / 10) * 2) * cols + 3 + (order % 10) * 3;
      const cell = ultimaCellaAbitanteRef.current.get(abitante.id) ?? home ?? fallback;
      return {
        id: abitante.id,
        name: abitante.nome,
        cell,
        path: commute?.path,
        pathToken: commute?.token ?? 0,
        appearance: abitante.razza === "Golem" ? "golem" : "human",
        markerEmoji: abitante.razza === "Golem" ? getEmojiAbitante(abitante) : undefined
      };
    }),
  [abitantiPerOverlayMappa, commuteByAbitanteId, cellaCasaPerAbitanteId, cols]);

  const phaserRevisionRef = useRef(0);
  const phaserBaseSnapshot = useMemo(
    () => buildPhaserMapSnapshot(
      mappaState,
      cols,
      rows,
      CELL_SIZE_PX,
      ++phaserRevisionRef.current
    ),
    [mappaState, cols, rows]
  );
  const phaserSnapshot = useMemo(
    () => ({
      ...phaserBaseSnapshot,
      characters: phaserCharacters,
      interaction: phaserInteraction,
      showGrid: mostraGrigliaMappa
    }),
    [phaserBaseSnapshot, phaserCharacters, phaserInteraction, mostraGrigliaMappa]
  );

  const handlePhaserCharacterPathComplete = useCallback((abitanteId: number, token: number) => {
    const meta = commuteByAbitanteId[abitanteId];
    if (!meta || meta.token !== token) return;
    handleCommuteFinita(
      abitanteId,
      meta.purpose,
      meta.barEdificioId,
      meta.mensaEdificioId,
      meta.cultoEdificioId,
      meta.negozioEdificioId,
      meta.rapinaTarget,
      meta.lavoroCercaEdificioId
    );
  }, [commuteByAbitanteId, handleCommuteFinita]);

  const handlePhaserCharacterPress = useCallback((abitanteId: number) => {
    setSintesiMappaAbitanteId(abitanteId);
  }, []);

  const handlePhaserCharacterDoublePress = useCallback((abitanteId: number) => {
    const abitante = abitanti.find((item) => item.id === abitanteId);
    if (!abitante) return;
    setSintesiMappaAbitanteId(abitanteId);
    setSchedaWandererAbitante(abitante);
  }, [abitanti]);

  const handlePhaserDragStateChange = useCallback((dragging: boolean) => {
    mapDraggedRef.current = dragging;
  }, []);

  const handleTrasformaGiacimento = useCallback((cellIndex: number) => {
    setMappaStatePersistente((s) => {
      const nextEdifici = { ...s.edificiInMappa, [cellIndex]: RAFFINERIA_MINERARIA };
      applicaRegoleConfineTerreno(nextEdifici, s.terrenoInMappa, FIXED_MAP_COLS, FIXED_MAP_ROWS, {
        collegaEdificiAllaStrada: false
      });
      return { ...s, edificiInMappa: nextEdifici };
    });
    setSelectedCellForTransformDialog(null);
  }, [setMappaStatePersistente]);

  const azioneSintesiMappa = useMemo(() => {
    if (!sintesiMappaAbitante) return null;
    return descriviAzioneCorrenteAbitante(sintesiMappaAbitante, {
      edifici,
      buioCielo: statoCielo.buio,
      orologioMinuti,
      dormonoACasaIds,
      lavoroArrivatiIds,
      barArrivatiByEdificio,
      cultoArrivatiByEdificio,
      commuteInfo: commuteByAbitanteId[sintesiMappaAbitante.id],
      haCasa: (cellaCasaPerAbitanteId.get(sintesiMappaAbitante.id) ?? null) != null,
      coprifuoco: {
        attivo: coprifuocoAttivo,
        inizioMinuti: coprifuocoInizioMinuti,
        fineMinuti: coprifuocoFineMinuti
      },
      esitoRapinaRecente: esitoRapinaByAbitanteId[sintesiMappaAbitante.id] ?? null
    });
  }, [
    sintesiMappaAbitante,
    edifici,
    statoCielo.buio,
    orologioMinuti,
    dormonoACasaIds,
    lavoroArrivatiIds,
    barArrivatiByEdificio,
    cultoArrivatiByEdificio,
    commuteByAbitanteId,
    cellaCasaPerAbitanteId,
    coprifuocoAttivo,
    coprifuocoInizioMinuti,
    coprifuocoFineMinuti,
    esitoRapinaByAbitanteId
  ]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Banner in alto: MyKingdom, Mese/Anno, Diario, Skip Mese, Felicità, Lealtà, Paura, Menu */}
      <View style={styles.topBanner}>
        <View style={styles.topBannerInner}>
          <View style={styles.bannerTitleBlock}>
            <Text style={styles.bannerTitleEmoji}>🏰</Text>
            <View>
              <Text style={styles.bannerTitle}>MyKingdom</Text>
              <Text style={styles.bannerSubtitle}>Gestisci la tua colonia</Text>
            </View>
          </View>
          <View style={styles.badge}>
            <View style={styles.badgeDateColumn}>
              <View style={styles.badgeDateRow}>
                <Text style={styles.badgeText}>📅 Mese {mese}</Text>
                <Text style={styles.badgeText}>· Anno {anno}</Text>
              </View>
              <View style={styles.badgeClockRow}>
                <Text style={styles.badgeClock}>
                  🕐 {formatOrologioGioco(orologioMinuti)}
                  {orologioInPausa ? " · in pausa" : ""}
                </Text>
                <Pressable
                  style={[styles.orologioPausaBtn, orologioInPausa && styles.orologioPausaBtnAttivo]}
                  onPress={toggleOrologioPausa}
                  accessibilityLabel={orologioInPausa ? "Riprendi il tempo" : "Metti in pausa il tempo"}
                >
                  <Text style={styles.orologioPausaBtnText}>{orologioInPausa ? "▶️" : "⏸️"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
          <Pressable style={styles.diarioBtn} onPress={() => router.push("/diario")}>
            <Text style={styles.diarioBtnEmoji}>📖</Text>
            <Text style={styles.diarioBtnLabel}>Diario</Text>
          </Pressable>
          <Pressable
            style={[styles.skipBtn, isLoading && styles.skipBtnDisabled]}
            onPress={avanzaMese}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.skipBtnText}>Caricamento...</Text>
              </>
            ) : (
              <>
                <Text style={styles.skipBtnEmoji}>⏭️</Text>
                <Text style={styles.skipBtnText}>Skip Mese</Text>
              </>
            )}
          </Pressable>
          <Pressable style={styles.indCard} onPress={() => router.push("/felicita")}>
            <Text style={styles.indEmoji}>😊</Text>
            <Text style={styles.indLabel}>Felicità</Text>
            <Text style={styles.indValue}>{felicitàMedia}%</Text>
          </Pressable>
          <Pressable style={styles.indCard} onPress={() => router.push("/lealta")}>
            <Text style={styles.indEmoji}>❤️</Text>
            <Text style={styles.indLabel}>Lealtà</Text>
            <Text style={styles.indValue}>{lealtàMedia}%</Text>
          </Pressable>
          <Pressable style={styles.indCard} onPress={() => router.push("/paura")}>
            <Text style={styles.indEmoji}>😨</Text>
            <Text style={styles.indLabel}>Paura</Text>
            <Text style={styles.indValue}>{pauraMedia}%</Text>
          </Pressable>
          <Pressable style={styles.indCard}>
            <Text style={styles.indEmoji}>📋</Text>
            <Text style={styles.indLabel}>Disoccupazione</Text>
            <Text style={styles.indValue}>{disoccupazionePercent}%</Text>
          </Pressable>
          <Pressable style={styles.indCard} onPress={() => router.push("/abitanti")}>
            <Text style={styles.indEmoji}>👥</Text>
            <Text style={styles.indLabel}>Abitanti</Text>
            <Text style={styles.indValue}>{abitanti.length}</Text>
          </Pressable>
          <Pressable style={styles.menuBtn} onPress={() => router.push("/menu")}>
            <Text style={styles.menuBtnText}>Menu</Text>
          </Pressable>
        </View>
      </View>

      {modalitaDemolisci ? (
        <View style={[styles.costruzioneBanner, styles.demolizioneBanner]}>
          <Text style={styles.costruzioneBannerText} numberOfLines={2}>
            🧨 Demolisci — tocca un edificio o una strada costruita da te. Riclicca Demolisci per uscire.
          </Text>
          <Pressable style={styles.costruzioneBannerBtn} onPress={uscitaDemolizione} accessibilityRole="button">
            <Text style={styles.costruzioneBannerBtnText}>Annulla</Text>
          </Pressable>
        </View>
      ) : costruzioneSelezione != null ? (
        <View style={styles.costruzioneBanner}>
          <Text style={styles.costruzioneBannerText} numberOfLines={2}>
            {costruzioneSelezione.tipo === "strada"
              ? "🛤️ Strada — area 2×2 su erba; tocca per piazzare. Riclicca Costruisci per uscire."
              : costruzioneSelezione.tipo === "terreno"
                ? costruzioneSelezione.kind === "acqua"
                  ? "🌊 Acqua — area 2×2; tocca per piazzare. Riclicca Costruisci per uscire."
                  : costruzioneSelezione.kind === "spiaggia"
                    ? "🏖️ Spiaggia — area 2×2; tocca per piazzare. Riclicca Costruisci per uscire."
                    : "🌿 Erba — area 2×2; tocca per piazzare. Riclicca Costruisci per uscire."
                : costruzioneSelezione.edificio.nome === "Dissalatore"
                ? `🔨 ${costruzioneSelezione.edificio.emoji} Dissalatore — serve un 2×2 con 2 celle sabbia e 2 sul mare; tocca sabbia o acqua.`
                : `🔨 ${costruzioneSelezione.edificio.emoji} ${costruzioneSelezione.edificio.nome} — l’anteprima segue il puntatore; tocca per confermare.`}
          </Text>
          <Pressable style={styles.costruzioneBannerBtn} onPress={uscitaCostruzione} accessibilityRole="button">
            <Text style={styles.costruzioneBannerBtnText}>Annulla</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Contenitore mappa: viewport sfondo nero, griglia gestita da react-zoom-pan-pinch */}
      <View style={styles.mapContainer}>
        {Platform.OS === "web" ? (
          <View style={styles.phaserMainSurface}>
            <PhaserMapSurface
              snapshot={phaserSnapshot}
              onCellPress={onCellPress}
              onCellHover={setPreviewCellHover}
              onCharacterPress={handlePhaserCharacterPress}
              onCharacterDoublePress={handlePhaserCharacterDoublePress}
              onCharacterPathComplete={handlePhaserCharacterPathComplete}
              onDragStateChange={handlePhaserDragStateChange}
            />
          </View>
        ) : (
        <View
          style={styles.viewport}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setViewportSize((prev) =>
              prev.width === width && prev.height === height ? prev : { width, height }
            );
          }}
        >
          <View style={styles.viewportCenterWrap} pointerEvents="box-none">
            <TransformWrapper
              limitToBounds={false}
              centerOnInit
              initialScale={1}
              minScale={0.5}
              maxScale={3}
              doubleClick={{ disabled: true }}
              onInit={(ref) => {
                scheduleMapTransformUpdate({
                  positionX: ref.state.positionX,
                  positionY: ref.state.positionY,
                  scale: ref.state.scale
                });
              }}
              onPanningStart={(ref) => {
                panStartPosRef.current = {
                  x: ref.state.positionX,
                  y: ref.state.positionY
                };
                mapDraggedRef.current = false;
              }}
              onPanning={(ref) => {
                const start = panStartPosRef.current;
                if (!start || mapDraggedRef.current) return;
                const dx = ref.state.positionX - start.x;
                const dy = ref.state.positionY - start.y;
                // ~5px in spazio trasformato (stessa soglia tipica della libreria).
                if (dx * dx + dy * dy > 25) mapDraggedRef.current = true;
              }}
              onPanningStop={() => {
                panStartPosRef.current = null;
                // Se non arriva un onPress “fantasma”, sblocca i tap successivi.
                if (mapDraggedRef.current) {
                  setTimeout(() => {
                    mapDraggedRef.current = false;
                  }, 320);
                }
              }}
              onTransformed={(_ref, state) => {
                scheduleMapTransformUpdate(state);
              }}
            >
              <TransformComponent
                wrapperStyle={{
                  width: "100%",
                  height: "100%",
                  overflow: "hidden"
                }}
                contentStyle={{
                  width: contentWidth,
                  height: contentHeight,
                  minWidth: contentWidth,
                  minHeight: contentHeight,
                  flex: "none"
                }}
              >
                <View style={[styles.gridWrap, { width: contentWidth, height: contentHeight }]} pointerEvents="box-none">
                  <View style={[styles.gridTerrain, gridContainerStyle as ViewStyle]}>
                    {visibleTerrainIndices.map((i) => {
                      const terreno = terrenoInMappa[i] ?? "erba";
                      const edificio = edificiInMappa[i];
                      const èStrada = edificio?.nome === "Strada";
                      const erbaSpiaggiaAsset =
                        terreno === "erba" && !èStrada ? erbaSpiaggiaAssetAt(i) : undefined;
                      const erbaAsset =
                        terreno === "erba" && !èStrada ? erbaAssetAt(i) : undefined;
                      const edificioBloccaErbaDecor =
                        !!edificio && edificio.nome !== "Strada";
                      const erbaDecor =
                        terreno === "erba" &&
                        !èStrada &&
                        !edificioBloccaErbaDecor &&
                        erbaSpiaggiaAsset == null
                          ? erbaExtraDecorCasuale(i, cols)
                          : null;

                      return (
                        <MapTerrainCell
                          key={i}
                          cellIndex={i}
                          cols={cols}
                          cellSizePx={CELL_SIZE_PX}
                          terreno={terreno}
                          edificio={edificio}
                          overlayEmoji={overlayEmojiAt(i)}
                          erbaAsset={erbaAsset}
                          erbaSpiaggiaAsset={erbaSpiaggiaAsset}
                          stradaAsset={èStrada ? stradaAssetAt(i) : undefined}
                          sandWaterMask={
                            terreno === "sabbia"
                              ? sandWaterEdgeMaskAt(i, cols, rows, terrenoInMappa)
                              : undefined
                          }
                          erbaDecor={erbaDecor}
                          mostraGrigliaMappa={mostraGrigliaMappa}
                          costruzioneActive={costruzioneSelezione != null || modalitaDemolisci}
                          onCellPress={onCellPress}
                          setPreviewCellHover={setPreviewCellHover}
                        />
                      );
                    })}
                    <MapWaterCellsLayer
                      indices={visibleWaterIndices}
                      cols={cols}
                      cellSizePx={CELL_SIZE_PX}
                      isBorderSea={(index) => isAcqua(index, cols, rows)}
                      costruzioneDissalatore={costruzioneDissalatore}
                      costruzioneActive={costruzioneSelezione != null || modalitaDemolisci}
                      onCellPress={onCellPress}
                      setPreviewCellHover={setPreviewCellHover}
                    />
                  </View>
                  {costruzioneSelezione != null && previewPiazzamento != null ? (
                    <View
                      style={[styles.previewFootprintLayer, { width: contentWidth, height: contentHeight }]}
                      pointerEvents="none"
                    >
                      {previewPiazzamento.celle.map((idx: number) => (
                        <View
                          key={`pv-${idx}`}
                          style={[
                            styles.previewCell,
                            previewPiazzamento.valido ? styles.previewCellValid : styles.previewCellInvalid,
                            {
                              width: CELL_SIZE_PX,
                              height: CELL_SIZE_PX,
                              left: (idx % cols) * CELL_SIZE_PX,
                              top: Math.floor(idx / cols) * CELL_SIZE_PX
                            }
                          ]}
                        />
                      ))}
                    </View>
                  ) : null}
                  {mostraGrigliaMappa && (
                    <View style={grigliaOverlayWebStyle} pointerEvents="none" />
                  )}
                  <View
                    style={[styles.footprintsLayer, { width: contentWidth, height: contentHeight }]}
                    pointerEvents="none"
                  >
                    {visibleFootprintOverlay.map(({ anchor, fp, variant, progressoCostruzione }) => (
                      <EdificioFootprintGfx
                        key={`footprint-${anchor}`}
                        anchor={anchor}
                        footprint={fp}
                        variant={variant}
                        cols={cols}
                        cellW={cellW}
                        cellH={cellH}
                        progressoCostruzione={progressoCostruzione}
                      />
                    ))}
                  </View>
                  {abitantiPerOverlayMappa.map((abitante: Abitante) => {
                    const infoCommute = commuteByAbitanteId[abitante.id];
                    const inCommute = infoCommute != null;

                    const nascostoLavoro =
                      abitanteInOrarioLavoroEdificio(abitante.id, orologioMinuti, edifici) &&
                      lavoroArrivatiIds.has(abitante.id) &&
                      !inCommute;

                    const nascostoBar =
                      abitanteAlBarRoutineOra(abitante, orologioMinuti, statoCielo.buio, edifici) &&
                      Object.values(barArrivatiByEdificio).some((ids) => ids.includes(abitante.id)) &&
                      !inCommute;

                    const nascostoCulto =
                      abitanteNascostoNelCultoOra(
                        abitante,
                        orologioMinuti,
                        statoCielo.buio,
                        cultoArrivatiByEdificio
                      ) && !inCommute;

                    if (nascostoLavoro) return null;
                    if (nascostoBar) return null;
                    if (nascostoCulto) return null;

                    const homeCell = cellaCasaPerAbitanteId.get(abitante.id) ?? null;
                    const fixedCellNotte =
                      !inCommute &&
                      èNottePersonaggiInCasa &&
                      homeCell !== null &&
                      dormonoACasaIds.has(abitante.id)
                        ? homeCell
                        : null;

                    return (
                      <MapWandererCharacter
                        key={`wanderer-${abitante.id}`}
                        cols={cols}
                        rows={rows}
                        cellSizePx={CELL_SIZE_PX}
                        isWalkable={isWalkableCell}
                        isRoadCell={isRoadCell}
                        instanceId={abitante.id}
                        fixedCell={fixedCellNotte}
                        preferredSpawnCell={
                          ultimaCellaAbitanteRef.current.get(abitante.id) ?? homeCell ?? null
                        }
                        commutePath={infoCommute?.path ?? null}
                        commuteToken={infoCommute?.token ?? 0}
                        commutePurpose={infoCommute?.purpose ?? null}
                        onCommuteComplete={(purpose) => {
                          const meta = commuteByAbitanteId[abitante.id];
                          handleCommuteFinita(
                            abitante.id,
                            purpose,
                            meta?.barEdificioId,
                            meta?.mensaEdificioId,
                            meta?.cultoEdificioId,
                            meta?.negozioEdificioId,
                            meta?.rapinaTarget,
                            meta?.lavoroCercaEdificioId
                          );
                        }}
                        onCommuteBlocked={(info) => handleCommuteBloccata(abitante.id, info)}
                        onCellSettled={(cell) => handleCellAbitante(abitante.id, cell)}
                        onPress={() => {
                          setSintesiMappaAbitanteId(abitante.id);
                        }}
                        onDoublePress={() => {
                          const a = abitanti.find((x) => x.id === abitante.id);
                          if (a) {
                            setSintesiMappaAbitanteId(a.id);
                            setSchedaWandererAbitante(a);
                          }
                        }}
                        passTouchesToMapOnCell={passTouchesToMapOnCellPerWanderer}
                        disableIdleRoam={
                          abitanteSoggettoACoprifuoco(
                            abitante,
                            edifici,
                            {
                              attivo: coprifuocoAttivo,
                              inizioMinuti: coprifuocoInizioMinuti,
                              fineMinuti: coprifuocoFineMinuti
                            },
                            orologioMinuti
                          ) ||
                          (abitante.razza !== "Golem" &&
                            (inCommute ||
                              abitanteInOrarioLavoroEdificio(abitante.id, orologioMinuti, edifici) ||
                              abitanteAlBarRoutineOra(
                                abitante,
                                orologioMinuti,
                                statoCielo.buio,
                                edifici
                              )))
                        }
                        markerEmoji={abitante.razza === "Golem" ? getEmojiAbitante(abitante) : null}
                        pressAccessibilityLabel={`Seleziona ${getAbitanteNome(abitante.id)}`}
                        doubleTapAccessibilityLabel={`Apri scheda ${getAbitanteNome(abitante.id)}`}
                        isCellFreeForMe={(cell) => isCellFreeForAbitante(abitante.id, cell)}
                        tryClaimCell={(cell) => tryClaimCellAbitante(abitante.id, cell)}
                        releaseMyCell={() => releaseCellAbitante(abitante.id)}
                      />
                    );
                  })}
                </View>
              </TransformComponent>
            </TransformWrapper>
          </View>
        </View>
        )}
        {/* Overlay giorno/notte solo sulla mappa (non sui menu top/bottom). */}
        {(statoCielo.buio > 0.004 || statoCielo.caloreTramonto > 0.004) && (
          <>
            {statoCielo.buio > 0.004 ? (
              <View
                style={[
                  styles.overlayCielo,
                  {
                    backgroundColor: `rgba(2,6,24,${CIELO_ALPHA_NOTTE_MAX * statoCielo.buio})`
                  }
                ]}
                pointerEvents="none"
              />
            ) : null}
            {statoCielo.caloreTramonto > 0.004 ? (
              <View
                style={[
                  styles.overlayCielo,
                  {
                    backgroundColor: `rgba(255,88,42,${CIELO_ALPHA_CALORE_TRAMONTO_MAX * statoCielo.caloreTramonto})`
                  }
                ]}
                pointerEvents="none"
              />
            ) : null}
          </>
        )}
      </View>

      {/* Menu fisso in basso: risorse/pulsanti, oppure sintesi abitante selezionato */}
      <View style={styles.bottomBar} pointerEvents="box-none">
        <View style={styles.bottomBarInner}>
          {sintesiMappaAbitante ? (
            <View style={styles.sintesiAbitanteRow}>
              <Text style={styles.sintesiEmoji}>{getEmojiAbitante(sintesiMappaAbitante)}</Text>
              <View style={styles.sintesiMain}>
                <Text style={styles.sintesiNome} numberOfLines={1}>
                  {sintesiMappaAbitante.nome}
                  <Text style={styles.sintesiAzioneInline}>
                    {" · "}
                    {azioneSintesiMappa ?? "—"}
                  </Text>
                </Text>
                <Text style={styles.sintesiAnagrafica} numberOfLines={1}>
                  {sintesiMappaAbitante.eta} anni · {sintesiMappaAbitante.razza ?? "Umano"}
                  {sintesiMappaAbitante.sesso ? ` · ${sintesiMappaAbitante.sesso}` : ""} ·{" "}
                  {getEmojiCasta(getCastaAbitante(sintesiMappaAbitante))}{" "}
                  {getCastaAbitante(sintesiMappaAbitante)} · {sintesiMappaAbitante.lavoro}
                </Text>
                {abitanteUsaBisogniUmani(sintesiMappaAbitante) ? (
                  <Text style={styles.sintesiBisogni} numberOfLines={1}>
                    {(() => {
                      const b = getBisogniAbitante(sintesiMappaAbitante);
                      return `🍽️${b.fame}  ⚡${b.energia}  🎉${b.divertimento}  💬${b.socialita}  🧼${b.igiene}`;
                    })()}
                  </Text>
                ) : (
                  <Text style={styles.sintesiBisogni} numberOfLines={1}>
                    🔋 Energia {getBisogniAbitante(sintesiMappaAbitante).energia}
                  </Text>
                )}
              </View>
              <Pressable
                style={styles.sintesiSchedaBtn}
                onPress={() => setSchedaWandererAbitante(sintesiMappaAbitante)}
                accessibilityRole="button"
                accessibilityLabel="Apri scheda completa"
              >
                <Text style={styles.sintesiSchedaBtnText}>Scheda</Text>
              </Pressable>
            </View>
          ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bottomBarScroll}
            contentContainerStyle={styles.risorseRow}
          >
            <Pressable
              style={[styles.risorseCard, styles.risorseCardClickable]}
              onPress={() => router.push("/crediti")}
              accessibilityRole="button"
              accessibilityLabel="Apri bilancio Tesoro"
            >
              <Text style={styles.risorseEmoji}>💰</Text>
              <Text style={styles.risorseName} numberOfLines={1}>Tesoro</Text>
              <View style={styles.risorseValueRow}>
                <Text style={styles.risorseValue}>{moneteGiocatore}</Text>
                <Text style={styles.risorseUnit}> monete</Text>
              </View>
              {deltaTesoroMercato !== 0 && (
                <Text
                  style={[
                    styles.risorseDelta,
                    deltaTesoroMercato > 0 ? styles.risorseDeltaPos : styles.risorseDeltaNeg
                  ]}
                >
                  {deltaTesoroMercato > 0 ? "+" : ""}
                  {deltaTesoroMercato}
                </Text>
              )}
            </Pressable>
            {risorse
              .filter((r: Risorsa) => r.nome !== "Crediti")
              .map((r: Risorsa) => {
              const isCibo = r.nome.toLowerCase().includes("cibo");
              const delta = isCibo ? 0 : (variazioni[r.nome] || 0) + (deltaOrdini[r.nome] ?? 0);
              const route = getResourceRoute(r);
              const displayQty = isCibo
                ? getTotaleOggettiInventarioGiocatore(inventarioGiocatore)
                : r.quantità;
              const displayUnit = isCibo ? "oggetti" : r.unità;
              return (
                <React.Fragment key={r.id}>
                  <Pressable
                    style={[styles.risorseCard, route && styles.risorseCardClickable]}
                    onPress={route ? () => router.push(route) : undefined}
                    disabled={!route}
                  >
                    <Text style={styles.risorseEmoji}>{getResourceEmoji(r)}</Text>
                    <Text style={styles.risorseName} numberOfLines={1}>{r.nome}</Text>
                    <View style={styles.risorseValueRow}>
                      <Text style={styles.risorseValue}>{displayQty}</Text>
                      <Text style={styles.risorseUnit}> {displayUnit}</Text>
                    </View>
                    {delta !== 0 && (
                      <Text style={[styles.risorseDelta, delta > 0 ? styles.risorseDeltaPos : styles.risorseDeltaNeg]}>
                        {delta > 0 ? "+" : ""}{delta}
                      </Text>
                    )}
                  </Pressable>
                  {r.nome === "Rifiuti" && (
                    <>
                      <Pressable
                        style={[styles.grigliaMapToggle, mostraGrigliaMappa && styles.grigliaMapToggleOn]}
                        onPress={() => setMostraGrigliaMappa((v) => !v)}
                        accessibilityRole="button"
                        accessibilityLabel={mostraGrigliaMappa ? "Nascondi griglia sulla mappa" : "Mostra griglia sulla mappa"}
                      >
                        <Text style={styles.grigliaMapToggleEmoji}>#</Text>
                        <Text style={styles.grigliaMapToggleLabel} numberOfLines={1}>
                          Griglia
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.grigliaMapToggle, costruzioneSelezione != null && styles.grigliaMapToggleOn]}
                        onPress={onCostruisciPress}
                        accessibilityRole="button"
                        accessibilityLabel="Apri costruzione edifici"
                      >
                        <Text style={styles.grigliaMapToggleEmoji}>🔨</Text>
                        <Text style={styles.grigliaMapToggleLabel} numberOfLines={1}>
                          Costruisci
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.grigliaMapToggle, modalitaDemolisci && styles.grigliaMapToggleDemolisciOn]}
                        onPress={onDemolisciPress}
                        accessibilityRole="button"
                        accessibilityLabel={modalitaDemolisci ? "Esci dalla modalità demolizione" : "Demolisci edifici sulla mappa"}
                      >
                        <Text style={styles.grigliaMapToggleEmoji}>🧨</Text>
                        <Text style={styles.grigliaMapToggleLabel} numberOfLines={1}>
                          Demolisci
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.grigliaMapToggle,
                          richiesteInAttesa.length > 0 && styles.grigliaMapToggleRichiesteOn
                        ]}
                        onPress={() => setMostraModalRichieste(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Apri richieste in sospeso"
                      >
                        <Text style={styles.grigliaMapToggleEmoji}>📋</Text>
                        <Text style={styles.grigliaMapToggleLabel} numberOfLines={1}>
                          Richieste{richiesteInAttesa.length > 0 ? ` (${richiesteInAttesa.length})` : ""}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.grigliaMapToggle,
                          eventiAttiviCount > 0 && styles.grigliaMapToggleEventiOn
                        ]}
                        onPress={() => setMostraModalEventi(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Apri elenco eventi disponibili"
                      >
                        <Text style={styles.grigliaMapToggleEmoji}>📌</Text>
                        <Text style={styles.grigliaMapToggleLabel} numberOfLines={1}>
                          Eventi{eventiAttiviCount > 0 ? ` (${eventiAttiviCount})` : ""}
                        </Text>
                      </Pressable>
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </ScrollView>
          )}
        </View>
      </View>

      <RichiesteModal
        visible={mostraModalRichieste}
        richieste={richiesteInAttesa}
        onClose={() => setMostraModalRichieste(false)}
        onAccetta={accettaRichiestaInAttesa}
        onRifiuta={rifiutaRichiestaInAttesa}
      />

      <EventiModal
        visible={mostraModalEventi}
        input={eventiUIInput}
        onClose={() => setMostraModalEventi(false)}
      />

      <Modal
        visible={mostraModalCostruisci}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setMostraModalCostruisci(false)}
      >
        <SafeAreaView style={styles.modalCostruisciRoot}>
          <View style={styles.modalCostruisciBody}>
            <Text style={styles.modalTitle}>Cosa vuoi costruire?</Text>
            <Text style={styles.modalSubtitle}>
              Scegli un tipo, poi sposta il puntatore sulla mappa: l’anteprima colorata mostra dove andrà l’edificio. Tocca per
              confermare.
            </Text>
            <ScrollView
              style={styles.modalCostruisciList}
              contentContainerStyle={styles.modalCostruisciListContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.modalOptionGrid, { gap: costruisciLayout.gap }]}>
                <Pressable
                  style={[styles.modalOptionCostruisci, { width: costruisciLayout.tileWidth }]}
                  onPress={() => {
                    setCostruzioneSelezione({ tipo: "strada" });
                    setMostraModalCostruisci(false);
                    setMostraGrigliaMappa(true);
                  }}
                >
                  <Text style={styles.modalOptionCostruisciEmoji}>{STRADA_OPZIONE.emoji}</Text>
                  <Text style={styles.modalOptionCostruisciNome} numberOfLines={2}>
                    {STRADA_OPZIONE.nome}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.modalSectionTitle}>{SEZIONE_AMBIENTE.titolo}</Text>
              <View style={[styles.modalOptionGrid, { gap: costruisciLayout.gap }]}>
                {SEZIONE_AMBIENTE.opzioni.map((opzione) => (
                  <Pressable
                    key={opzione.kind}
                    style={[styles.modalOptionCostruisci, { width: costruisciLayout.tileWidth }]}
                    onPress={() => {
                      setCostruzioneSelezione({ tipo: "terreno", kind: opzione.kind });
                      setMostraModalCostruisci(false);
                      setMostraGrigliaMappa(true);
                    }}
                  >
                    <Text style={styles.modalOptionCostruisciEmoji}>{opzione.emoji}</Text>
                    <Text style={styles.modalOptionCostruisciNome} numberOfLines={2}>
                      {opzione.nome}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {edificiCostruzionePerSezione.sections.map((sezione) => (
                <View key={sezione.titolo}>
                  <Text style={styles.modalSectionTitle}>{sezione.titolo}</Text>
                  <View style={[styles.modalOptionGrid, { gap: costruisciLayout.gap }]}>
                    {sezione.edifici.map((e) => (
                      <Pressable
                        key={e.id}
                        style={[styles.modalOptionCostruisci, { width: costruisciLayout.tileWidth }]}
                        onPress={() => {
                          setCostruzioneSelezione({ tipo: "edificio", edificio: e });
                          setMostraModalCostruisci(false);
                          setMostraGrigliaMappa(true);
                        }}
                      >
                        <Text style={styles.modalOptionCostruisciEmoji}>{e.emoji}</Text>
                        <Text style={styles.modalOptionCostruisciNome} numberOfLines={2}>
                          {e.nome}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
              {edificiCostruzionePerSezione.altri.length > 0 ? (
                <Text style={styles.modalSectionTitle}>Altro</Text>
              ) : null}
              {edificiCostruzionePerSezione.altri.length > 0 ? (
                <View style={[styles.modalOptionGrid, { gap: costruisciLayout.gap }]}>
                  {edificiCostruzionePerSezione.altri.map((e) => (
                    <Pressable
                      key={e.id}
                      style={[styles.modalOptionCostruisci, { width: costruisciLayout.tileWidth }]}
                      onPress={() => {
                        setCostruzioneSelezione({ tipo: "edificio", edificio: e });
                        setMostraModalCostruisci(false);
                        setMostraGrigliaMappa(true);
                      }}
                    >
                      <Text style={styles.modalOptionCostruisciEmoji}>{e.emoji}</Text>
                      <Text style={styles.modalOptionCostruisciNome} numberOfLines={2}>
                        {e.nome}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </ScrollView>
            <Pressable style={styles.modalCancel} onPress={() => setMostraModalCostruisci(false)}>
              <Text style={styles.modalCancelText}>Chiudi</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={selectedCellForTransformDialog !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCellForTransformDialog(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedCellForTransformDialog(null)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Trasformare in Raffineria Mineraria?</Text>
            <Text style={styles.modalSubtitle}>
              Vuoi trasformare questo Giacimento ⛰️ nell'edificio Raffineria Mineraria ⚙️?
            </Text>
            <View style={styles.modalButtonsRow}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setSelectedCellForTransformDialog(null)}
              >
                <Text style={styles.modalButtonText}>Annulla</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={() =>
                  selectedCellForTransformDialog !== null &&
                  handleTrasformaGiacimento(selectedCellForTransformDialog)
                }
              >
                <Text style={styles.modalButtonText}>Conferma</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={confermaDemolizionePending !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfermaDemolizionePending(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setConfermaDemolizionePending(null)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Vuoi demolire questo edificio?</Text>
            <View style={styles.modalButtonsRow}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setConfermaDemolizionePending(null)}
              >
                <Text style={styles.modalButtonText}>Annulla</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={() => {
                  const p = confermaDemolizionePending;
                  if (!p) return;
                  eseguiDemolizione(p.anchor, p.w, p.h, p.cap, p.globalId);
                  setConfermaDemolizionePending(null);
                }}
              >
                <Text style={styles.modalButtonText}>Sì</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <AbitanteInfoModal
        visible={schedaWandererAbitante !== null}
        abitante={schedaWandererAbitante}
        edifici={edifici}
        onClose={() => setSchedaWandererAbitante(null)}
        getAbitanteNome={getAbitanteNome}
        calcolaFelicitàModificata={calcolaFelicitàModificata}
        etaMinimaLavoro={etaMinimaLavoro}
        onApriResidenzaMappa={handleApriResidenzaMappa}
        azioneCorrente={
          schedaWandererAbitante
            ? descriviAzioneCorrenteAbitante(schedaWandererAbitante, {
                edifici,
                buioCielo: statoCielo.buio,
                orologioMinuti,
                dormonoACasaIds,
                lavoroArrivatiIds,
                barArrivatiByEdificio,
                cultoArrivatiByEdificio,
                commuteInfo: commuteByAbitanteId[schedaWandererAbitante.id],
                haCasa: (cellaCasaPerAbitanteId.get(schedaWandererAbitante.id) ?? null) != null,
                coprifuoco: {
                  attivo: coprifuocoAttivo,
                  inizioMinuti: coprifuocoInizioMinuti,
                  fineMinuti: coprifuocoFineMinuti
                },
                esitoRapinaRecente: esitoRapinaByAbitanteId[schedaWandererAbitante.id] ?? null
              })
            : null
        }
      />

      {luogoCultoModalCtx != null ? (
        <LuogoCultoFullscreenModal
          visible
          onClose={() => setSelectedLuogoCultoAnchor(null)}
          nomeEdificio={luogoCultoModalCtx.nome}
          religione={luogoCultoModalCtx.religione}
          edificioGlobaleId={luogoCultoModalCtx.edificioGlobaleId}
          anchor={luogoCultoModalCtx.anchor}
          capoReligiosoId={luogoCultoModalCtx.capoId}
          abitanti={abitanti}
          edifici={edifici}
          cellaCasaPerAbitanteId={cellaCasaPerAbitanteId}
          orologioMinuti={orologioMinuti}
          buioCielo={statoCielo.buio}
          dormonoACasaIds={dormonoACasaIds}
          lavoroArrivatiIds={lavoroArrivatiIds}
          commuteByAbitanteId={commuteByAbitanteId}
          barArrivatiByEdificio={barArrivatiByEdificio}
          cultoArrivatiByEdificio={cultoArrivatiByEdificio}
          onApriGestioneCulto={() => {
            const route =
              luogoCultoModalCtx.religione === "Culto del Sole" ? "/culto-sole" : "/culto-alieni";
            setSelectedLuogoCultoAnchor(null);
            router.push(route);
          }}
        />
      ) : null}

      {edificioResidenzaAperta?.nome === "Capanna" && selectedResidenzaAnchor !== null ? (
        <CapannaFullscreenModal
          visible
          onClose={() => setSelectedResidenzaAnchor(null)}
          anchor={selectedResidenzaAnchor}
          occupantiIds={occupantiCasaMappaIds}
          abitanti={abitanti}
          edifici={edifici}
          cellaCasaPerAbitanteId={cellaCasaPerAbitanteId}
          orologioMinuti={orologioMinuti}
          buioCielo={statoCielo.buio}
          dormonoACasaIds={dormonoACasaIds}
          lavoroArrivatiIds={lavoroArrivatiIds}
          commuteByAbitanteId={commuteByAbitanteId}
          barArrivatiByEdificio={barArrivatiByEdificio}
          postiPerCasa={POSTI_PER_CASA_MAPPA}
        />
      ) : (
        <Modal
          visible={selectedResidenzaAnchor !== null && edificioResidenzaAperta !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedResidenzaAnchor(null)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedResidenzaAnchor(null)}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>
                {edificioResidenzaAperta?.emoji ?? "🏠"} {edificioResidenzaAperta?.nome ?? "Casa"}
              </Text>
              <Text style={styles.modalSubtitle}>
                Posti sulla mappa: {occupantiCasaMappaIds.length}/{POSTI_PER_CASA_MAPPA} · Cella #{selectedResidenzaAnchor}
                {edificioResidenzaAperta?.nome === "Dormitorio"
                  ? "\nPuoi assegnare chi è già nel Dormitorio coloniale o far entrare chi non ha ancora residenza (non i Senzatetto)."
                  : "\nI Senzatetto sono tutti in Baracca a livello colonia: qui scegli chi associare a questa baracca (max 6)."}
              </Text>
              <Text style={styles.casaPostiTitolo}>Posti</Text>
              <ScrollView style={styles.modalList} nestedScrollEnabled>
                {Array.from({ length: POSTI_PER_CASA_MAPPA }, (_, slot) => {
                  const id = occupantiCasaMappaIds[slot];
                  const occ = id != null ? abitanti.find((x) => x.id === id) : null;
                  return (
                    <View key={`slot-${slot}`} style={styles.capannaAbitanteRow}>
                      <Text style={styles.casaSlotLabel}>{slot + 1}</Text>
                      {occ ? (
                        <>
                          <Text style={styles.capannaAbitanteEmoji}>{getEmojiAbitante(occ)}</Text>
                          <Text style={styles.capannaAbitanteNome} numberOfLines={1}>
                            {occ.nome}
                          </Text>
                          <Pressable
                            style={styles.casaRimuoviBtn}
                            onPress={() => handleRimuoviDaCasaMappa(occ.id)}
                          >
                            <Text style={styles.casaRimuoviBtnText}>Esci</Text>
                          </Pressable>
                        </>
                      ) : (
                        <Text style={styles.casaSlotVuoto}>Libero</Text>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
              <Text style={styles.casaPostiTitolo}>
                Può entrare {postiLiberiCasaMappa === 0 ? "(pieno)" : `(${postiLiberiCasaMappa} liberi)`}
              </Text>
              <ScrollView style={[styles.modalList, styles.modalListCompact]} nestedScrollEnabled>
                {candidatiPerCasaMappa.length === 0 ? (
                  <Text style={styles.capannaEmpty}>
                    Nessun abitante disponibile (nessuno può entrare qui con le regole attuali o sono già assegnati altrove).
                  </Text>
                ) : (
                  candidatiPerCasaMappa.map((a) => (
                    <Pressable
                      key={a.id}
                      style={styles.modalOption}
                      onPress={() => handleAggiungiACasaMappa(a.id)}
                      disabled={postiLiberiCasaMappa === 0}
                    >
                      <Text style={styles.modalOptionEmoji}>{getEmojiAbitante(a)}</Text>
                      <Text style={styles.modalOptionNome} numberOfLines={1}>
                        {a.nome}
                      </Text>
                      <Text style={styles.casaAggiungiHint}>Aggiungi</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
              <View style={styles.modalButtonsRow}>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setSelectedResidenzaAnchor(null)}
                >
                  <Text style={styles.modalButtonText}>Chiudi</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={() => {
                    setSelectedResidenzaAnchor(null);
                    router.push("/residenze");
                  }}
                >
                  <Text style={styles.modalButtonText}>Schermata Residenze (prezzi)</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    position: "relative",
    backgroundColor: "#000000",
    userSelect: "none",
    overflow: "hidden"
  },
  /** Overlay alba/tramonto/notte (in-game); i tocchi passano ai controlli sotto. */
  overlayCielo: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none"
  },
  topBanner: {
    zIndex: 999,
    paddingHorizontal: 0,
    paddingVertical: 8,
    width: "100%",
    backgroundColor: "#050816"
  },
  topBannerInner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 12
  },
  bannerTitleBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  bannerTitleEmoji: {
    fontSize: 28,
    textShadowColor: "rgba(251,191,36,0.3)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
    letterSpacing: 0.3
  },
  bannerSubtitle: {
    fontSize: 11,
    color: "rgba(248,250,252,0.65)",
    marginTop: 1
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30,41,59,0.8)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: 4
  },
  badgeDateColumn: {
    flexDirection: "column",
    gap: 2,
    justifyContent: "center",
    alignItems: "flex-start"
  },
  badgeDateRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4
  },
  badgeText: {
    fontSize: 11,
    color: "rgba(248,250,252,0.85)",
    fontWeight: "600"
  },
  badgeClockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2
  },
  badgeClock: {
    fontSize: 10,
    color: "rgba(248,250,252,0.72)",
    fontWeight: "500"
  },
  orologioPausaBtn: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: "rgba(30,41,59,0.5)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)"
  },
  orologioPausaBtnAttivo: {
    backgroundColor: "rgba(37,99,235,0.35)",
    borderColor: "rgba(96,165,250,0.45)"
  },
  orologioPausaBtnText: {
    fontSize: 11
  },
  diarioBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(51,65,85,0.6)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    gap: 6
  },
  diarioBtnEmoji: { fontSize: 14 },
  diarioBtnLabel: { fontSize: 12, fontWeight: "600", color: "#e2e8f0" },
  skipBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.5)"
  },
  skipBtnDisabled: {
    backgroundColor: "rgba(37,99,235,0.5)",
    opacity: 0.9
  },
  skipBtnEmoji: { fontSize: 18 },
  skipBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  mapContainer: {
    flex: 1,
    minHeight: 120,
    overflow: "hidden",
    width: "100%",
    backgroundColor: "#000000",
    position: "relative"
  },
  phaserMainSurface: {
    flex: 1,
    minHeight: 120,
    width: "100%",
    position: "relative",
    overflow: "hidden"
  },
  indCard: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.85)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)"
  },
  indEmoji: { fontSize: 22, marginBottom: 4 },
  indLabel: { fontSize: 10, color: "rgba(248,250,252,0.8)", marginBottom: 2 },
  indValue: { fontSize: 14, fontWeight: "800", color: "#f8fafc" },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    width: "100%",
    paddingVertical: 0,
    paddingHorizontal: 0
  },
  bottomBarInner: {
    width: "100%",
    height: 78,
    minHeight: 78,
    maxHeight: 78,
    overflow: "hidden",
    justifyContent: "center",
    backgroundColor: "rgba(5,8,22,0.92)",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(148,163,184,0.25)",
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  bottomBarScroll: {
    flexGrow: 0,
    height: 66
  },
  sintesiAbitanteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 66
  },
  sintesiEmoji: {
    fontSize: 22,
    width: 28,
    textAlign: "center"
  },
  sintesiMain: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 0
  },
  sintesiNome: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "800"
  },
  sintesiAzioneInline: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600"
  },
  sintesiAnagrafica: {
    color: "rgba(203,213,245,0.85)",
    fontSize: 9
  },
  sintesiBisogni: {
    color: "rgba(226,232,240,0.9)",
    fontSize: 9,
    fontVariant: ["tabular-nums"]
  },
  sintesiSchedaBtn: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "center"
  },
  sintesiSchedaBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700"
  },
  risorseRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 0,
    height: 66
  },
  risorseCard: {
    minWidth: 72,
    height: 62,
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.8)",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)"
  },
  risorseCardClickable: {
    borderColor: "rgba(59,130,246,0.3)"
  },
  risorseEmoji: { fontSize: 18, marginBottom: 2 },
  risorseName: { fontSize: 9, color: "rgba(248,250,252,0.85)", marginBottom: 1 },
  risorseValueRow: { flexDirection: "row", alignItems: "baseline" },
  risorseValue: { fontSize: 13, fontWeight: "800", color: "#f8fafc" },
  risorseUnit: { fontSize: 9, color: "rgba(148,163,184,0.8)", marginLeft: 1 },
  risorseDelta: { fontSize: 9, fontWeight: "700", marginTop: 1 },
  risorseDeltaPos: { color: "#4ade80" },
  risorseDeltaNeg: { color: "#f87171" },
  grigliaMapToggle: {
    minWidth: 64,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
    alignItems: "center",
    justifyContent: "center"
  },
  grigliaMapToggleOn: {
    borderColor: "rgba(59,130,246,0.45)",
    backgroundColor: "rgba(30,58,138,0.35)"
  },
  grigliaMapToggleDemolisciOn: {
    borderColor: "rgba(248,113,113,0.55)",
    backgroundColor: "rgba(127,29,29,0.4)"
  },
  grigliaMapToggleRichiesteOn: {
    borderColor: "rgba(59,130,246,0.55)",
    backgroundColor: "rgba(30,58,138,0.4)"
  },
  grigliaMapToggleEventiOn: {
    borderColor: "rgba(245,158,11,0.55)",
    backgroundColor: "rgba(120,53,15,0.35)"
  },
  demolizioneBanner: {
    backgroundColor: "rgba(127,29,29,0.45)"
  },
  grigliaMapToggleEmoji: {
    fontSize: 16,
    marginBottom: 2,
    color: "rgba(248,250,252,0.9)",
    fontWeight: "700"
  },
  grigliaMapToggleLabel: {
    fontSize: 9,
    color: "rgba(248,250,252,0.85)",
    fontWeight: "600"
  },
  costruzioneBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(30,58,138,0.5)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.35)",
    zIndex: 50
  },
  costruzioneBannerText: {
    flex: 1,
    fontSize: 11,
    color: "#e2e8f0",
    marginRight: 8
  },
  costruzioneBannerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(239,68,68,0.3)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.55)"
  },
  costruzioneBannerBtnText: {
    color: "#fecaca",
    fontSize: 11,
    fontWeight: "600"
  },
  menuBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(59,130,246,0.4)",
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.5)"
  },
  menuBtnText: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600"
  },
  viewport: {
    flex: 1,
    minHeight: 120,
    width: "100%",
    backgroundColor: "#000000",
    overflow: "hidden",
    position: "relative"
  },
  viewportCenterWrap: {
    flex: 1,
    width: "100%",
    height: "100%",
    minHeight: 120,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden"
  },
  gridWrap: {
    position: "relative",
    width: "100%",
    height: "100%"
  },
  gridTerrain: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 0
  },
  gridFill: {
    flex: 1,
    width: "100%",
    height: "100%"
  },
  gridFillFixed: {
    flex: 0
  },
  gridRow: {
    flexDirection: "row",
    flex: 1,
    minHeight: 0
  },
  gridRowFixed: {
    flexDirection: "row",
    flex: 0
  },
  cellaFixed: {
    width: CELL_SIZE_PX,
    height: CELL_SIZE_PX,
    minWidth: CELL_SIZE_PX,
    maxWidth: CELL_SIZE_PX,
    minHeight: CELL_SIZE_PX,
    maxHeight: CELL_SIZE_PX,
  },
  cellaStretch: {
    flex: 1,
    minWidth: 0,
    minHeight: 0
  },
  contentWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start",
    position: "relative"
  },
  grigliaTerreno: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 0
  },
  footprintsLayer: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 3
  },
  previewFootprintLayer: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 2
  },
  previewCell: {
    position: "absolute",
    borderWidth: 2
  },
  /** Puoi costruire qui (stessa condizione del piazzamento effettivo). */
  previewCellValid: {
    backgroundColor: "rgba(22,163,74,0.48)",
    borderColor: "#15803d"
  },
  /** Non puoi costruire qui. */
  previewCellInvalid: {
    backgroundColor: "rgba(220,38,38,0.5)",
    borderColor: "#b91c1c"
  },
  footprintAbsolute: {
    position: "absolute"
  },
  footprintBlock: {
    position: "absolute",
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#3d3426",
    overflow: "hidden",
    backgroundColor: "#1a1814"
  },
  footprintRow: {
    flex: 1,
    flexDirection: "row",
    minHeight: 0
  },
  footprintTile: {
    flex: 1,
    margin: 0.5
  },
  footprintPortico: {
    position: "absolute",
    bottom: 0,
    left: "22%",
    width: "56%",
    backgroundColor: "rgba(12,10,8,0.65)",
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)"
  },
  grigliaEmoji: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 2,
    flex: 1,
    width: "100%",
    height: "100%"
  },
  griglia: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start"
  },
  cella: {
    justifyContent: "center",
    alignItems: "center"
  },
  cellaGrigliaOn: {
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.15)"
  },
  /** Terreno: PNG 1×1 (erba, strada, spiaggia) o acqua animata dallo spritesheet. */
  cellaTextureTerreno: {
    backgroundColor: "transparent",
    overflow: "hidden",
    position: "relative"
  },
  cellaEdificio: {},
  edificioEmoji: {
    fontSize: 18
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  modalContent: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
    maxWidth: 400,
    width: "100%",
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)"
  },
  modalTitle: {
    color: "#e5e7eb",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center"
  },
  modalSubtitle: {
    color: "rgba(203,213,245,0.9)",
    fontSize: 13,
    marginBottom: 16,
    textAlign: "center"
  },
  modalSectionTitle: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 4
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center"
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center"
  },
  modalButtonCancel: {
    backgroundColor: "rgba(148,163,184,0.3)"
  },
  modalButtonConfirm: {
    backgroundColor: "#3b82f6"
  },
  modalButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600"
  },
  modalList: {
    maxHeight: 320
  },
  modalCostruisciRoot: {
    flex: 1,
    backgroundColor: "#050816"
  },
  modalCostruisciBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  modalCostruisciList: {
    flex: 1
  },
  modalCostruisciListContent: {
    paddingBottom: 12
  },
  modalListCompact: {
    maxHeight: 200
  },
  casaPostiTitolo: {
    color: "rgba(203,213,245,0.95)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4
  },
  casaSlotLabel: {
    color: "rgba(148,163,184,0.95)",
    fontSize: 12,
    width: 22,
    fontWeight: "700"
  },
  casaSlotVuoto: {
    color: "rgba(148,163,184,0.7)",
    fontSize: 13,
    fontStyle: "italic",
    flex: 1
  },
  casaRimuoviBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(239,68,68,0.35)"
  },
  casaRimuoviBtnText: {
    color: "#fecaca",
    fontSize: 12,
    fontWeight: "600"
  },
  casaAggiungiHint: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600"
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  modalOptionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 4
  },
  modalOptionCostruisci: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 88,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)"
  },
  modalOptionCostruisciEmoji: {
    fontSize: 28,
    marginBottom: 6
  },
  modalOptionCostruisciNome: {
    color: "#e5e7eb",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 14
  },
  modalOptionEmoji: {
    fontSize: 22,
    marginRight: 10
  },
  modalOptionNome: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "600",
    flex: 1
  },
  modalCancel: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: "center"
  },
  modalCancelText: {
    color: "#93c5fd",
    fontSize: 14
  },
  capannaEmpty: {
    color: "rgba(203,213,245,0.9)",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12
  },
  capannaAbitanteRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)"
  },
  capannaAbitanteEmoji: {
    fontSize: 20,
    marginRight: 10
  },
  capannaAbitanteNome: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "600",
    flex: 1
  },
  capannaAbitanteLavoro: {
    color: "rgba(203,213,245,0.8)",
    fontSize: 12
  }
});

/** Route /mappa reindirizza alla root: la Mappa è la schermata principale. */
export default function MappaRoute() {
  return <Redirect href="/" />;
}
