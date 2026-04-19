import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  generateRivers,
  type TerrenoType
} from "../src/game/riverGeneration";
import type { Abitante, Edificio, Risorsa } from "../src/types";
import { AbitanteInfoModal } from "../src/ui/AbitanteInfoModal";
import { CapannaFullscreenModal } from "../src/ui/CapannaFullscreenModal";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import {
  RpgFootprintAdmin3x2,
  RpgFootprintCapanna2x1,
  RpgFootprintDorm2x2,
  RpgFootprintBar2x2,
  RpgFootprintTribunale2x2,
  RpgFootprintDissalatore2x2,
  RpgFootprintSerra2x1,
  RpgFootprintSpazioporto4x3
} from "../src/components/RpgFootprintBuilding";
import { MapWandererCharacter } from "../src/components/MapWandererCharacter";
import { GrassDecorOverlay } from "../src/components/GrassDecorOverlay";
import { StradaTile1x1 } from "../src/components/StradaTile1x1";
import { TerrainSheetSprite } from "../src/components/TerrainSheetSprite";
import {
  assicuraEdificiCollegatiDaStrada,
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
  pianificaCommuteMattina,
  pianificaCommuteSeraACasa,
  pianificaCommuteVersoBarDaCella,
  pianificaCommuteVersoEdificioGlobaleDaCella,
  scegliBarEdificioIdPiuVicino
} from "../src/game/commutePathsMappa";
import { setBarArrivatiMappaSnapshot } from "../src/game/mappaBarArrivatiStore";
import { computeStatoCielo } from "../src/game/cicloCielo";
import { formatOrologioGioco } from "../src/game/orologioGiocoSession";
import { useOrologioGioco } from "../src/hooks/useOrologioGioco";
import {
  buildStradaAssetLookup,
  erbaExtraDecorCasuale,
  getGrass2x2Index,
  getGrassSandBorderSubtileIfAny,
  getSandBeachSubtile
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
/** Dimensione fissa di ogni cella in pixel (nessuna percentuale, solo px). */
const CELL_SIZE_PX = 40;
/** Gap tra le celle (0 = griglia compatta 2000x2000). */
const GAP = 0;

/**
 * Celle senza griglia: bordi azzerati in modo esplicito (su web anche outline/focus su Pressable).
 * Il layer emoji non deve mai ridisegnare i bordi sopra al terreno (altrimenti linee doppie / punti agli incroci).
 */
const CELLA_SENZA_GRIGLIA: ViewStyle = Platform.select<ViewStyle>({
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
  "Ospedale Coloniale": "/ospedale",
  "Centrale": "/centrale",
  "Tribunale": "/tribunale",
  "Dissalatore": "/dissalatore",
  "Laboratorio di Ricerca": "/laboratorio",
  "Bar": "/bar",
  "Caserma": "/caserma",
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

/** Case sulla mappa con posti limitati (UI). */
const NOMI_RESIDENZE_MAPPA = new Set(["Baracca", "Capanna", "Dormitorio"]);
const POSTI_PER_CASA_MAPPA = 6;

function getAnchorCellPerEdificio(cellIndex: number, edificiInMappa: Record<number, EdificioInCella>): number {
  const e = edificiInMappa[cellIndex];
  if (!e) return cellIndex;
  if (e.footprintRef != null) return e.footprintRef;
  return cellIndex;
}

function èResidenzaMappa(nome: string | undefined): boolean {
  return nome != null && NOMI_RESIDENZE_MAPPA.has(nome);
}

function residenzaGlobaleDi(abitanteId: number, edificiList: Edificio[]): Edificio | undefined {
  return edificiList.find((e) => e.tipo === "Residenza" && (e.abitantiAssegnati ?? []).includes(abitanteId));
}

/**
 * Cella anchor della residenza sulla mappa (override `residenzeMappa` o edificio globale tipo Residenza).
 * `null` se non ha casa mappata (es. solo prigione / senza edificio).
 */
function trovaCellaAnchorCasaSuMappa(
  abitanteId: number,
  edificiList: Edificio[],
  edificiInMappa: Record<number, EdificioInCella>,
  residenzeMappa: Record<number, number[]>
): number | null {
  for (const [anchorStr, ids] of Object.entries(residenzeMappa)) {
    if (ids.includes(abitanteId)) return Number(anchorStr);
  }
  const res = residenzaGlobaleDi(abitanteId, edificiList);
  if (!res || res.tipo !== "Residenza") return null;
  const targetId = res.id;
  for (const k of Object.keys(edificiInMappa)) {
    const idx = Number(k);
    const e = edificiInMappa[idx];
    if (!e || !èResidenzaMappa(e.nome)) continue;
    const anchor = getAnchorCellPerEdificio(idx, edificiInMappa);
    if (anchor !== idx) continue;
    const gid = idGlobalePerResidenzaInCella(e, e.nome);
    if (gid === targetId) return anchor;
  }
  return null;
}

/** Celle anchor delle Capanne procedurali (un edificio 2×1 per anchor). */
function elencoAnchorCelleCapanne(edificiInMappa: Record<number, EdificioInCella>): number[] {
  const anchors: number[] = [];
  for (const k of Object.keys(edificiInMappa)) {
    const idx = Number(k);
    const e = edificiInMappa[idx];
    if (!e || e.nome !== "Capanna") continue;
    const anchor = getAnchorCellPerEdificio(idx, edificiInMappa);
    if (anchor !== idx) continue;
    anchors.push(anchor);
  }
  anchors.sort((a, b) => a - b);
  return anchors;
}

/** Riparti i colonisti tra le capanne sulla mappa (max `postiPerCapanna` per anchor). */
function distribuisciAbitantiSuAnchorCapanne(
  idsOrdinati: number[],
  anchors: number[],
  postiPerCapanna: number
): Record<number, number[]> {
  if (anchors.length === 0) return {};
  const out: Record<number, number[]> = {};
  for (const a of anchors) out[a] = [];
  let round = 0;
  for (const id of idsOrdinati) {
    let pos = -1;
    for (let t = 0; t < anchors.length; t++) {
      const i = (round + t) % anchors.length;
      const a = anchors[i]!;
      if (out[a]!.length < postiPerCapanna) {
        pos = i;
        break;
      }
    }
    if (pos < 0) {
      out[anchors[0]!]!.push(id);
    } else {
      const a = anchors[pos]!;
      out[a]!.push(id);
      round = (pos + 1) % anchors.length;
    }
  }
  return out;
}

function idEdificioGlobalePerNomeResidenza(nome: string): number | undefined {
  const found = edificiData.find((e) => e.nome === nome && e.tipo === "Residenza");
  return found?.id;
}

function idGlobalePerResidenzaInCella(e: EdificioInCella | null, nome: string): number | undefined {
  if (!e) return undefined;
  if (e.edificioGlobaleId != null) return e.edificioGlobaleId;
  return idEdificioGlobalePerNomeResidenza(nome);
}

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
  Serra: { w: SERRA_FOOTPRINT_W, h: SERRA_FOOTPRINT_H },
  Capanna: { w: CAPANNA_FOOTPRINT_W, h: CAPANNA_FOOTPRINT_H },
  Dormitorio: { w: DORMITORIO_FOOTPRINT_W, h: DORMITORIO_FOOTPRINT_H },
  Bar: { w: BAR_FOOTPRINT_W, h: BAR_FOOTPRINT_H },
  Tribunale: { w: TRIBUNALE_FOOTPRINT_W, h: TRIBUNALE_FOOTPRINT_H },
  Dissalatore: { w: DISSALATORE_FOOTPRINT_W, h: DISSALATORE_FOOTPRINT_H },
  Spazioporto: { w: SPAZIOPORTO_FOOTPRINT_W, h: SPAZIOPORTO_FOOTPRINT_H }
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

/** Mare, fiume, sabbia: nessuna cella strada (le strade si agganciano solo all’erba). */
function isCellaOkPerStrada(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>
): boolean {
  if (isAcqua(index, cols, rows)) return false;
  const t = terrenoInMappa[index] ?? "erba";
  if (t !== "erba") return false;
  return true;
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
  | { tipo: "edificio"; edificio: Edificio };

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
  if (selezione.tipo === "strada") {
    const t = terrenoInMappa[hoverCell] ?? "erba";
    const occupato = !!edificiInMappa[hoverCell];
    const valido = t === "erba" && !occupato && !isAcqua(hoverCell, cols, rows);
    return { celle: [hoverCell], valido };
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
 * Stato iniziale mappa. Ordine: edifici → strade che li collegano → erba (implicita) →
 * fiumi e sabbia → continuità erba/sabbia → acqua (mare ai bordi già implicito) → decorazioni.
 */
function getInitialMappaWithRivers(cols: number, rows: number): {
  edificiInMappa: Record<number, EdificioInCella>;
  terrenoInMappa: Record<number, TerrenoType>;
  decorazioniInMappa: Record<number, string>;
  residenzeMappa: Record<number, number[]>;
} {
  const totaleCelle = cols * rows;
  const borderIndices = new Set<number>();
  for (let i = 0; i < totaleCelle; i++) if (isAcqua(i, cols, rows)) borderIndices.add(i);
  const adminAnchor = scegliAnchorComplessoAmministrativo(cols, rows);

  const edificiInMappa = getInitialEdificiInMappa(cols, rows, new Set(), adminAnchor);
  const terrenoInMappa: Record<number, TerrenoType> = {};

  piazzaStradeInizialiTraEdifici(edificiInMappa, terrenoInMappa, cols, rows);
  assicuraEdificiCollegatiDaStrada(edificiInMappa, terrenoInMappa, cols, rows, STRADA_OPZIONE);

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
  applyTerrenoGrassAndSandContinuity(terrenoInMappa, cols, rows, excludeSand);

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

  return { edificiInMappa, terrenoInMappa, decorazioniInMappa, residenzeMappa: {} as Record<number, number[]> };
}

type MappaRuntimeState = ReturnType<typeof getInitialMappaWithRivers>;

/**
 * Cache fuori dal ciclo di vita di React: quando si esce dalla mappa (es. /amministrazione) e si torna
 * con `replace("/")`, il componente si rimonta; senza questo, `useState` rigenererebbe fiumi e decorazioni.
 */
let mappaSessione: MappaRuntimeState | null = null;

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

type FootprintVariant =
  | "amministrazione"
  | "dormitorio"
  | "bar"
  | "tribunale"
  | "dissalatore"
  | "spazioporto"
  | "serra"
  | "capanna";

function EdificioFootprintGfx({
  anchor,
  footprint,
  variant,
  cols,
  cellW,
  cellH
}: {
  anchor: number;
  footprint: { w: number; h: number };
  variant: FootprintVariant;
  cols: number;
  cellW: number;
  cellH: number;
}) {
  const { left, top } = getCellTopLeft(anchor, cellW, cellH, cols);
  const { w, h } = footprint;
  const width = w * cellW + (w - 1) * GAP;
  const height = h * cellH + (h - 1) * GAP;
  const porticoH = Math.max(6, Math.floor(cellH * 0.22));

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
      if (!isCellaOkPerStrada(i, cols, rows, terrenoInMappa)) continue;
      if (edificiInMappa[i]) continue;
      edificiInMappa[i] = { ...STRADA_OPZIONE };
    }
  }
}

function getResourceEmoji(r: Risorsa): string {
  const n = r.nome.toLowerCase();
  if (n.includes("crediti")) return "💰";
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
  if (n.includes("crediti")) return "/crediti";
  if (n.includes("energia")) return "/energia";
  if (n.includes("acqua")) return "/acqua";
  if (n.includes("rifiuti")) return "/rifiuti";
  return null;
}

export function MappaScreen() {
  const router = useRouter();
  const {
    risorse,
    abitanti,
    edifici,
    mese,
    anno,
    isLoading,
    avanzaMese,
    calcolaProduzioneConsumo,
    calcolaDeltaOrdiniMercato,
    calcolaFelicitàModificata,
    etaMinimaLavoro,
    redditoCittadinanza,
    assegnaAbitanteAEdificio,
    rimuoviAbitanteDaEdificio,
    aggiungiEdificioDaTemplate
  } = useGameContext();
  const variazioni = calcolaProduzioneConsumo();
  const deltaOrdini = calcolaDeltaOrdiniMercato();

  const abitantiConFelicità = abitanti.filter((a) => a.razza !== "Robot");
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

  const [mappaState, setMappaState] = useState<MappaRuntimeState>(() => {
    if (!mappaSessione) {
      mappaSessione = getInitialMappaWithRivers(FIXED_MAP_COLS, FIXED_MAP_ROWS);
    }
    if (!mappaSessione.residenzeMappa) {
      mappaSessione = { ...mappaSessione, residenzeMappa: {} };
    }
    return mappaSessione;
  });
  const setMappaStatePersistente = useCallback((action: React.SetStateAction<MappaRuntimeState>) => {
    setMappaState((prev) => {
      const next = typeof action === "function" ? (action as (p: MappaRuntimeState) => MappaRuntimeState)(prev) : action;
      mappaSessione = next;
      return next;
    });
  }, []);
  const mappaStateRef = useRef(mappaState);
  mappaStateRef.current = mappaState;
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
  /** Edifico scelto: anteprima sulla mappa e tap per piazzare. */
  const [costruzioneSelezione, setCostruzioneSelezione] = useState<SelezioneCostruzioneAnteprima | null>(null);
  /** Cella sotto il puntatore (web hover / press mobile) per l’anteprima footprint. */
  const [previewCellHover, setPreviewCellHover] = useState<number | null>(null);
  const [selectedCellForTransformDialog, setSelectedCellForTransformDialog] = useState<number | null>(null);
  /** Cella anchor della residenza aperta dal doppio tocco (Baracca, Capanna, Dormitorio). */
  const [selectedResidenzaAnchor, setSelectedResidenzaAnchor] = useState<number | null>(null);
  /** Scheda abitante aperta dal doppio tocco su un passeggiatore sulla mappa. */
  const [schedaWandererAbitante, setSchedaWandererAbitante] = useState<Abitante | null>(null);
  /** Bordi tra le celle: di default nascosti; il toggle nella barra risorse li attiva. */
  const [mostraGrigliaMappa, setMostraGrigliaMappa] = useState(false);
  const lastTapCell = useRef<number | null>(null);
  const lastTapTime = useRef<number>(0);

  /** Frame condiviso per mare + fiumi: ciclo 0…3 sullo spritesheet (simile a GIF). */
  const [waterAnimFrame, setWaterAnimFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setWaterAnimFrame((n) => (n + 1) % 4), 180);
    return () => clearInterval(id);
  }, []);

  const orologioMinuti = useOrologioGioco();

  /** Ordine stabile per overlay: ogni abitante ha un personaggio che cammina sulla mappa. */
  const abitantiPerOverlayMappa = useMemo(
    () => [...abitanti].sort((a, b) => a.id - b.id),
    [abitanti]
  );

  const getAbitanteNome = useCallback(
    (id: number) => abitanti.find((a) => a.id === id)?.nome ?? `ID ${id}`,
    [abitanti]
  );

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
    if (typeof document === "undefined" || !costruzioneSelezione) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") uscitaCostruzione();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [costruzioneSelezione, uscitaCostruzione]);

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
    () => buildStradaAssetLookup(cols, rows, edificiInMappa),
    [cols, rows, edificiInMappa]
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

  const cellaCasaPerAbitanteId = useMemo(() => {
    const m = new Map<number, number | null>();
    for (const a of abitanti) {
      m.set(a.id, trovaCellaAnchorCasaSuMappa(a.id, edifici, edificiInMappa, residenzeMappa));
    }
    return m;
  }, [abitanti, edifici, edificiInMappa, residenzeMappa]);

  const ultimaCellaAbitanteRef = useRef<Map<number, number>>(new Map());
  const prevBuioNotteTransitRef = useRef<boolean | undefined>(undefined);
  const orologioPrevTickRef = useRef(orologioMinuti);

  const [dormonoACasaIds, setDormonoACasaIds] = useState<Set<number>>(() => new Set());
  const [lavoroArrivatiIds, setLavoroArrivatiIds] = useState<Set<number>>(() => new Set());
  /** id edificio Bar (globale) → abitanti considerati “dentro” quel locale sulla mappa. */
  const [barArrivatiByEdificio, setBarArrivatiByEdificio] = useState<Record<number, number[]>>({});
  const [commuteByAbitanteId, setCommuteByAbitanteId] = useState<
    Record<number, { path: number[]; token: number; purpose: "work" | "bar" | "home"; barEdificioId?: number }>
  >({});

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

    if (prev < LAVORO_INIZIO && cur >= LAVORO_INIZIO) {
      setCommuteByAbitanteId((prevComm) => {
        const out = { ...prevComm };
        for (const a of abitanti) {
          if (a.razza === "Robot") continue;
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
          if (a.razza === "Robot") continue;
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
      setCommuteByAbitanteId((prevComm) => {
        const out = { ...prevComm };
        for (const id of toPath) {
          if (out[id]) continue;
          const homeCell = cellaCasaPerAbitanteId.get(id) ?? null;
          const from =
            ultimaCellaAbitanteRef.current.get(id) ?? (homeCell != null ? homeCell : null);
          if (from == null) continue;
          const barId = scegliBarEdificioIdPiuVicino(from, edifici, edificiInMappa, cols, rows, isWalkableCell);
          if (barId == null) continue;
          const path = pianificaCommuteVersoBarDaCella(from, barId, edificiInMappa, cols, rows, isWalkableCell);
          if (path && path.length >= 2) {
            out[id] = { path, token: Date.now(), purpose: "bar", barEdificioId: barId };
          }
        }
        return out;
      });
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
    cellaCasaPerAbitanteId
  ]);

  const handleCommuteFinita = useCallback(
    (abitanteId: number, purpose: "work" | "bar" | "home", barEdificioId?: number) => {
      setCommuteByAbitanteId((prev) => {
        const cur = prev[abitanteId];
        if (cur?.path?.length) {
          ultimaCellaAbitanteRef.current.set(abitanteId, cur.path[cur.path.length - 1]!);
        }
        const { [abitanteId]: _removed, ...rest } = prev;
        return rest;
      });
      if (purpose === "home") {
        setDormonoACasaIds((s) => new Set(s).add(abitanteId));
      } else if (purpose === "work") {
        setLavoroArrivatiIds((s) => new Set(s).add(abitanteId));
        setBarArrivatiByEdificio((p) => rimuoviAbitanteDaTuttiBar(p, abitanteId));
      } else if (purpose === "bar" && barEdificioId != null) {
        setBarArrivatiByEdificio((p) => aggiungiAbitanteAlBarEdificio(p, barEdificioId, abitanteId));
      }
    },
    []
  );

  const handleCellAbitante = useCallback((abitanteId: number, cell: number) => {
    ultimaCellaAbitanteRef.current.set(abitanteId, cell);
  }, []);

  const passTouchesToMapOnCellPerWanderer = useCallback(
    (cell: number) => cellaÈNelFootprintResidenzaMappa(cell, edificiInMappa, cols),
    [edificiInMappa, cols]
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
      const next: Record<
        number,
        { path: number[]; token: number; purpose: "work" | "bar"; barEdificioId?: number }
      > = {};
      for (const a of abitanti) {
        if (a.razza === "Robot") continue;
        const home = cellaCasaPerAbitanteId.get(a.id) ?? null;
        const ult = ultimaCellaAbitanteRef.current.get(a.id) ?? null;
        const mattina = pianificaCommuteMattina(
          a,
          home,
          ult,
          edifici,
          edificiInMappa,
          cols,
          rows,
          isWalkableCell,
          orologioMinuti
        );
        const path = mattina.path;
        if (!path || path.length < 2) continue;
        const lav = primoEdificioLavoroOrarioPerAbitante(a.id, edifici);
        const fascia = lav ? fasciaPerEdificio(lav) : null;
        const purpose: "work" | "bar" =
          lav && fascia && minutiInFascia(orologioMinuti, fascia) ? "work" : "bar";
        next[a.id] = {
          path,
          token: Date.now(),
          purpose,
          barEdificioId: purpose === "bar" ? mattina.barEdificioId : undefined
        };
      }
      setCommuteByAbitanteId(next);
      setLavoroArrivatiIds((prev) => {
        const s = new Set(prev);
        for (const a of abitanti) {
          if (a.razza === "Robot") continue;
          const lav = primoEdificioLavoroOrarioPerAbitante(a.id, edifici);
          if (lav && !next[a.id]) s.add(a.id);
        }
        return s;
      });
      setBarArrivatiByEdificio(() => {
        let acc: Record<number, number[]> = {};
        for (const a of abitanti) {
          if (a.razza === "Robot") continue;
          const lav = primoEdificioLavoroOrarioPerAbitante(a.id, edifici);
          const fascia = lav ? fasciaPerEdificio(lav) : null;
          if (lav && fascia && minutiInFascia(orologioMinuti, fascia)) continue;
          if (next[a.id]) continue;
          const from = ultimaCellaAbitanteRef.current.get(a.id) ?? cellaCasaPerAbitanteId.get(a.id) ?? null;
          const barId = scegliBarEdificioIdPiuVicino(from, edifici, edificiInMappa, cols, rows, isWalkableCell);
          if (barId != null) acc = aggiungiAbitanteAlBarEdificio(acc, barId, a.id);
        }
        return acc;
      });
    }

    if (!eraNotte && notte) {
      setLavoroArrivatiIds(new Set());
      setBarArrivatiByEdificio({});
      const next: Record<number, { path: number[]; token: number; purpose: "home" }> = {};
      const dormiSenzaPercorso: number[] = [];
      for (const a of abitanti) {
        const home = cellaCasaPerAbitanteId.get(a.id);
        if (home == null) continue;
        const from = ultimaCellaAbitanteRef.current.get(a.id) ?? home;
        const path = pianificaCommuteSeraACasa(home, from, cols, rows, isWalkableCell);
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
    orologioMinuti
  ]);

  const edificiFootprintOverlay = useMemo(() => {
    const list: { anchor: number; fp: { w: number; h: number }; variant: FootprintVariant }[] = [];
    for (const [i, e] of Object.entries(edificiInMappa)) {
      if (e.footprint && !e.footprintRef) {
        const variant: FootprintVariant =
          e.nome === "Dormitorio"
            ? "dormitorio"
            : e.nome === "Bar"
              ? "bar"
              : e.nome === "Tribunale"
                ? "tribunale"
                : e.nome === "Dissalatore"
                  ? "dissalatore"
                  : e.nome === "Spazioporto"
                    ? "spazioporto"
                    : e.nome === "Serra"
                      ? "serra"
                      : e.nome === "Capanna"
                        ? "capanna"
                        : "amministrazione";
        list.push({ anchor: Number(i), fp: e.footprint, variant });
      }
    }
    return list;
  }, [edificiInMappa]);

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
        if ((cur.terrenoInMappa[cellIndex] ?? "erba") !== "erba") {
          Alert.alert("Non qui", "La strada si può posizionare solo su erba.");
          return;
        }
        setMappaStatePersistente((s) => {
          const nextEdifici = {
            ...s.edificiInMappa,
            [cellIndex]: { id: STRADA_OPZIONE.id, nome: STRADA_OPZIONE.nome, emoji: STRADA_OPZIONE.emoji }
          };
          assicuraEdificiCollegatiDaStrada(
            nextEdifici,
            s.terrenoInMappa,
            FIXED_MAP_COLS,
            FIXED_MAP_ROWS,
            STRADA_OPZIONE
          );
          return { ...s, edificiInMappa: nextEdifici };
        });
        uscitaCostruzione();
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

      const newId = aggiungiEdificioDaTemplate(e.id);
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
          edificioGlobaleId: èResidenzaMappa(e.nome) ? newId : undefined
        });
        assicuraEdificiCollegatiDaStrada(
          nextEdifici,
          prev.terrenoInMappa,
          FIXED_MAP_COLS,
          FIXED_MAP_ROWS,
          STRADA_OPZIONE
        );
        let nextResidenze = prev.residenzeMappa;
        if (èResidenzaMappa(e.nome)) {
          nextResidenze = { ...prev.residenzeMappa, [anchor!]: prev.residenzeMappa[anchor!] ?? [] };
        }
        return { ...prev, edificiInMappa: nextEdifici, residenzeMappa: nextResidenze };
      });
      uscitaCostruzione();
    },
    [setMappaStatePersistente, aggiungiEdificioDaTemplate, uscitaCostruzione]
  );

  const onCellPress = useCallback(
    (cellIndex: number) => {
      if (costruzioneSelezione) {
        const edificio = edificiInMappa[cellIndex];
        const terreno = terrenoInMappa[cellIndex] ?? "erba";
        if (edificio) return;
        const èDissalatore =
          costruzioneSelezione.tipo === "edificio" && costruzioneSelezione.edificio.nome === "Dissalatore";
        if (èDissalatore) {
          if (terreno === "river") return;
        } else if (terreno === "river" || isAcqua(cellIndex, cols, rows)) {
          return;
        }
        if (costruzioneSelezione.tipo === "strada") {
          handleScegliEdificio(cellIndex, STRADA_OPZIONE as unknown as Edificio);
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
      const now = Date.now();
      const isDoubleTap = lastTapCell.current === cellIndex && now - lastTapTime.current < DOPPIO_TAP_MS;
      if (isDoubleTap) {
        lastTapCell.current = null;
        if (edificio) {
          if (edificio.nome === "Giacimento") {
            setSelectedCellForTransformDialog(cellIndex);
          } else if (èResidenzaMappa(edificio.nome)) {
            setSelectedResidenzaAnchor(getAnchorCellPerEdificio(cellIndex, edificiInMappa));
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
      costruzioneSelezione,
      edificiInMappa,
      terrenoInMappa,
      openRouteForEdificio,
      cols,
      rows,
      handleScegliEdificio
    ]
  );

  const handleTrasformaGiacimento = useCallback((cellIndex: number) => {
    setMappaStatePersistente((s) => {
      const nextEdifici = { ...s.edificiInMappa, [cellIndex]: RAFFINERIA_MINERARIA };
      assicuraEdificiCollegatiDaStrada(
        nextEdifici,
        s.terrenoInMappa,
        FIXED_MAP_COLS,
        FIXED_MAP_ROWS,
        STRADA_OPZIONE
      );
      return { ...s, edificiInMappa: nextEdifici };
    });
    setSelectedCellForTransformDialog(null);
  }, [setMappaStatePersistente]);

  return (
    <SafeAreaView style={styles.safe}>
      {(statoCielo.buio > 0.004 || statoCielo.caloreTramonto > 0.004) && (
        <>
          {statoCielo.buio > 0.004 ? (
            <View
              style={[
                styles.overlayCielo,
                {
                  zIndex: 1000,
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
                  zIndex: 1001,
                  backgroundColor: `rgba(255,88,42,${CIELO_ALPHA_CALORE_TRAMONTO_MAX * statoCielo.caloreTramonto})`
                }
              ]}
              pointerEvents="none"
            />
          ) : null}
        </>
      )}
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
              <Text style={styles.badgeClock}>🕐 {formatOrologioGioco(orologioMinuti)}</Text>
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

      {costruzioneSelezione != null ? (
        <View style={styles.costruzioneBanner}>
          <Text style={styles.costruzioneBannerText} numberOfLines={2}>
            {costruzioneSelezione.tipo === "strada"
              ? "🛤️ Strada — verde = cella valida; tocca per piazzare."
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
        <View style={styles.viewport}>
          <View style={styles.viewportCenterWrap} pointerEvents="box-none">
            <TransformWrapper
              limitToBounds={false}
              centerOnInit
              initialScale={1}
              minScale={0.5}
              maxScale={3}
              doubleClick={{ disabled: true }}
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
                  <View style={[styles.gridTerrain, gridContainerStyle]}>
                    {Array.from({ length: rows * cols }, (_, i) => {
                      const acqua = isAcqua(i, cols, rows);
                      const terreno = terrenoInMappa[i] ?? "erba";
                      const edificio = edificiInMappa[i];
                      const hasEdificio = !!edificio;
                      const èStrada = edificio?.nome === "Strada";
                      const acquaAnimata = acqua || terreno === "river";
                      const cellStyle = [
                        styles.cella,
                        Platform.OS === "web"
                          ? CELLA_SENZA_GRIGLIA
                          : mostraGrigliaMappa
                            ? styles.cellaGrigliaOn
                            : CELLA_SENZA_GRIGLIA,
                        styles.cellaFixed,
                        styles.cellaTextureTerreno,
                        { width: CELL_SIZE_PX, height: CELL_SIZE_PX },
                        hasEdificio && !èStrada && styles.cellaEdificio,
                        Platform.OS === "web" && webCellAbsolutePosition(i, cols, CELL_SIZE_PX)
                      ];
                      const grassSandBorderSubtile = getGrassSandBorderSubtileIfAny(
                        i,
                        cols,
                        rows,
                        terrenoInMappa,
                        edificiInMappa
                      );
                      const edificioBloccaErbaDecor =
                        !!edificio && edificio.nome !== "Strada";
                      /**
                       * Non usiamo `getGrassRoadBorderSubtileIfAny` sullo spritesheet: le strade sono PNG 1×1
                       * (`StradaTile1x1`); il bordo menta 3×3 sul foglio crea piastrelle incoerenti accanto alla strada.
                       */
                      const erbaDecor =
                        terreno === "erba" &&
                        !èStrada &&
                        !edificioBloccaErbaDecor &&
                        grassSandBorderSubtile == null
                          ? erbaExtraDecorCasuale(i, cols)
                          : null;

                      const spriteTerreno = acquaAnimata ? (
                        <TerrainSheetSprite cellSize={CELL_SIZE_PX} terrain="water" frame={waterAnimFrame} />
                      ) : terreno === "sabbia" ? (
                        <TerrainSheetSprite
                          cellSize={CELL_SIZE_PX}
                          terrain="sand"
                          beachSubtile={getSandBeachSubtile(i, cols, rows, terrenoInMappa)}
                        />
                      ) : èStrada ? (
                        <StradaTile1x1
                          cellSize={CELL_SIZE_PX}
                          asset={stradaAssetAt(i)}
                        />
                      ) : (
                        <>
                          <TerrainSheetSprite
                            cellSize={CELL_SIZE_PX}
                            terrain="grass"
                            grass2x2Index={getGrass2x2Index(i, cols)}
                            grassSandBorderSubtile={grassSandBorderSubtile}
                          />
                          {erbaDecor ? (
                            <GrassDecorOverlay cellSize={CELL_SIZE_PX} kind={erbaDecor} />
                          ) : null}
                        </>
                      );
                      const costruzioneDissalatore =
                        costruzioneSelezione?.tipo === "edificio" &&
                        costruzioneSelezione.edificio.nome === "Dissalatore";
                      if (acqua && !costruzioneDissalatore) {
                        return (
                          <View key={i} style={cellStyle}>
                            {spriteTerreno}
                          </View>
                        );
                      }
                      const hoverPreviewProps =
                        costruzioneSelezione != null
                          ? Platform.OS === "web"
                            ? {
                                onPressIn: () => setPreviewCellHover(i),
                                onPointerEnter: () => setPreviewCellHover(i)
                              }
                            : { onPressIn: () => setPreviewCellHover(i) }
                          : {};
                      return (
                        <Pressable
                          key={i}
                          style={cellStyle}
                          onPress={() => onCellPress(i)}
                          {...hoverPreviewProps}
                        >
                          {spriteTerreno}
                        </Pressable>
                      );
                    })}
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
                  {Platform.OS === "web" && mostraGrigliaMappa && (
                    <View style={grigliaOverlayWebStyle} pointerEvents="none" />
                  )}
                  <View
                    style={[styles.footprintsLayer, { width: contentWidth, height: contentHeight }]}
                    pointerEvents="none"
                  >
                    {edificiFootprintOverlay.map(({ anchor, fp, variant }) => (
                      <EdificioFootprintGfx
                        key={`footprint-${anchor}`}
                        anchor={anchor}
                        footprint={fp}
                        variant={variant}
                        cols={cols}
                        cellW={cellW}
                        cellH={cellH}
                      />
                    ))}
                  </View>
                  <View
                    style={[
                      styles.grigliaEmoji,
                      { ...gridContainerStyle, position: "absolute" as const, left: 0, top: 0, zIndex: 2 },
                      { width: contentWidth, height: contentHeight }
                    ]}
                    pointerEvents="none"
                  >
                    {Array.from({ length: rows * cols }, (_, i) => {
                      const edificio = edificiInMappa[i];
                      const èStrada = edificio?.nome === "Strada";
                      const edificioMulticella =
                        !!edificio && !èStrada && (edificio.footprintRef != null || edificio.footprint != null);
                      const emoji =
                        edificio && !èStrada && !edificioMulticella
                          ? edificio.emoji
                          : (decorazioniInMappa[i] ?? null);
                      const mostraEmoji = !!emoji;
                      return (
                        <View
                          key={i}
                          style={[
                            styles.cella,
                            CELLA_SENZA_GRIGLIA,
                            styles.cellaFixed,
                            { width: CELL_SIZE_PX, height: CELL_SIZE_PX },
                            Platform.OS === "web" && webCellAbsolutePosition(i, cols, CELL_SIZE_PX)
                          ]}
                        >
                          {mostraEmoji ? (
                            <Text style={[styles.edificioEmoji, { fontSize: Math.max(10, Math.min(22, CELL_SIZE_PX - 4)) }]}>{emoji}</Text>
                          ) : null}
                        </View>
                      );
                    })}
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

                    if (nascostoLavoro) return null;
                    if (nascostoBar) return null;

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
                        key={`wanderer-${abitante.id}-${infoCommute?.token ?? 0}-${fixedCellNotte ?? "x"}`}
                        cols={cols}
                        rows={rows}
                        cellSizePx={CELL_SIZE_PX}
                        isWalkable={isWalkableCell}
                        instanceId={abitante.id}
                        fixedCell={fixedCellNotte}
                        commutePath={infoCommute?.path ?? null}
                        commuteToken={infoCommute?.token ?? 0}
                        commutePurpose={infoCommute?.purpose ?? null}
                        onCommuteComplete={(purpose) => {
                          const meta = commuteByAbitanteId[abitante.id];
                          handleCommuteFinita(abitante.id, purpose, meta?.barEdificioId);
                        }}
                        onCellSettled={(cell) => handleCellAbitante(abitante.id, cell)}
                        onDoublePress={() => {
                          const a = abitanti.find((x) => x.id === abitante.id);
                          if (a) setSchedaWandererAbitante(a);
                        }}
                        passTouchesToMapOnCell={passTouchesToMapOnCellPerWanderer}
                        disableIdleRoam={!èNottePersonaggiInCasa && abitante.razza !== "Robot"}
                        doubleTapAccessibilityLabel={`Apri scheda ${getAbitanteNome(abitante.id)}`}
                      />
                    );
                  })}
                </View>
              </TransformComponent>
            </TransformWrapper>
          </View>
        </View>
      </View>

      {/* Menu fisso in basso: Risorse (ancorato al fondo schermo) */}
      <View style={styles.bottomBar} pointerEvents="box-none">
        <View style={styles.bottomBarInner}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.risorseRow}
          >
            {risorse.map((r: Risorsa) => {
              const delta = (variazioni[r.nome] || 0) + (deltaOrdini[r.nome] ?? 0);
              const route = getResourceRoute(r);
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
                      <Text style={styles.risorseValue}>{r.quantità}</Text>
                      <Text style={styles.risorseUnit}> {r.unità}</Text>
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
                        onPress={() => setMostraModalCostruisci(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Apri costruzione edifici"
                      >
                        <Text style={styles.grigliaMapToggleEmoji}>🔨</Text>
                        <Text style={styles.grigliaMapToggleLabel} numberOfLines={1}>
                          Costruisci
                        </Text>
                      </Pressable>
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <Modal
        visible={mostraModalCostruisci}
        transparent
        animationType="fade"
        onRequestClose={() => setMostraModalCostruisci(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setMostraModalCostruisci(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Cosa vuoi costruire?</Text>
            <Text style={styles.modalSubtitle}>
              Scegli un tipo, poi sposta il puntatore sulla mappa: l’anteprima colorata mostra dove andrà l’edificio. Tocca per
              confermare.
            </Text>
            <ScrollView style={styles.modalList} nestedScrollEnabled>
              <Pressable
                style={styles.modalOption}
                onPress={() => {
                  setCostruzioneSelezione({ tipo: "strada" });
                  setMostraModalCostruisci(false);
                  setMostraGrigliaMappa(true);
                }}
              >
                <Text style={styles.modalOptionEmoji}>{STRADA_OPZIONE.emoji}</Text>
                <Text style={styles.modalOptionNome}>{STRADA_OPZIONE.nome}</Text>
              </Pressable>
              {edificiCatalogoModal.map((e) => (
                <Pressable
                  key={e.id}
                  style={styles.modalOption}
                  onPress={() => {
                    setCostruzioneSelezione({ tipo: "edificio", edificio: e });
                    setMostraModalCostruisci(false);
                    setMostraGrigliaMappa(true);
                  }}
                >
                  <Text style={styles.modalOptionEmoji}>{e.emoji}</Text>
                  <Text style={styles.modalOptionNome}>{e.nome}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.modalCancel} onPress={() => setMostraModalCostruisci(false)}>
              <Text style={styles.modalCancelText}>Chiudi</Text>
            </Pressable>
          </Pressable>
        </Pressable>
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

      <AbitanteInfoModal
        visible={schedaWandererAbitante !== null}
        abitante={schedaWandererAbitante}
        onClose={() => setSchedaWandererAbitante(null)}
        getAbitanteNome={getAbitanteNome}
        calcolaFelicitàModificata={calcolaFelicitàModificata}
        etaMinimaLavoro={etaMinimaLavoro}
        redditoCittadinanza={redditoCittadinanza ?? 0}
      />

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
  badgeClock: {
    fontSize: 10,
    color: "rgba(248,250,252,0.72)",
    fontWeight: "500"
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
    backgroundColor: "#000000"
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
    minHeight: 56,
    backgroundColor: "rgba(5,8,22,0.92)",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(148,163,184,0.25)",
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  risorseRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 0
  },
  risorseCard: {
    minWidth: 72,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderRadius: 10,
    paddingVertical: 8,
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
    boxSizing: "border-box"
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
  /** Erba / sabbia / acqua: texture da spritesheet (TerrainSheetSprite). */
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
