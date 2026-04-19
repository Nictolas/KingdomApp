import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import {
  RpgFootprintAdmin3x2,
  RpgFootprintCapanna2x1,
  RpgFootprintDorm2x2,
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
    DORMITORIO_3_INDEX: centro + cols + 1
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

function idEdificioGlobalePerNomeResidenza(nome: string): number | undefined {
  const found = edificiData.find((e) => e.nome === nome && e.tipo === "Residenza");
  return found?.id;
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

/**
 * Orologio di gioco: 1 secondo reale = 1 minuto in-game (24 h di gioco = 24 minuti reali).
 * Stesso modello della mappa: persiste nella sessione se si esce e si torna alla schermata.
 */
let orologioGiocoMinutiDaMezzanotte = 6 * 60;
let orologioGiocoLastRealMs: number | null = null;

function formatOrologioGioco(minutiDaMezzanotte: number): string {
  const m = ((minutiDaMezzanotte % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Quattro abitanti casuali per i passeggiatori sulla mappa (stabile per sessione, come la generazione terreno). */
let wandererAbitanteIdsSession: number[] | null = null;

function pickFourAbitanteIds(abitantiList: Abitante[]): number[] {
  if (abitantiList.length === 0) return [];
  const shuffled = [...abitantiList].sort(() => Math.random() - 0.5);
  if (abitantiList.length >= 4) {
    return shuffled.slice(0, 4).map((a) => a.id);
  }
  const out: number[] = [];
  for (let i = 0; i < 4; i++) {
    out.push(shuffled[i % shuffled.length]!.id);
  }
  return out;
}

/** Coppie [indiceA, indiceB] per strade iniziali (anchor centro → spazioporto, serra); usa le posizioni effettive degli edifici. */
function getStradeIniziali(edificiInMappa: Record<number, EdificioInCella>): [number, number][] {
  let centro: number | null = null;
  let spazioporto: number | null = null;
  const serre: number[] = [];
  for (const [i, e] of Object.entries(edificiInMappa)) {
    const idx = Number(i);
    if (e.nome === "Centro di Comando" && e.footprint && !e.footprintRef) centro = idx;
    if (e.nome === "Spazioporto" && e.footprint && !e.footprintRef) spazioporto = idx;
    if (e.nome === "Serra" && e.footprint && !e.footprintRef) serre.push(idx);
  }
  const out: [number, number][] = [];
  if (centro != null && spazioporto != null) out.push([centro, spazioporto]);
  if (centro != null) {
    for (const sa of serre) out.push([centro, sa]);
  }
  return out;
}

/** Angolo in alto a sinistra della cella in px (per overlay edifici multi-cella). */
function getCellTopLeft(cellIndex: number, cellW: number, cellH: number, cols: number): { left: number; top: number } {
  const col = cellIndex % cols;
  const row = Math.floor(cellIndex / cols);
  return { left: col * (cellW + GAP), top: row * (cellH + GAP) };
}

type FootprintVariant = "amministrazione" | "dormitorio" | "spazioporto" | "serra" | "capanna";

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
    rimuoviAbitanteDaEdificio
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
  const edificiInMappa = mappaState.edificiInMappa;
  const terrenoInMappa = mappaState.terrenoInMappa;
  const decorazioniInMappa = mappaState.decorazioniInMappa;
  const residenzeMappa = mappaState.residenzeMappa;
  const [selectedCellForDialog, setSelectedCellForDialog] = useState<number | null>(null);
  const [selectedCellForTransformDialog, setSelectedCellForTransformDialog] = useState<number | null>(null);
  /** Cella anchor della residenza aperta dal doppio tocco (Baracca, Capanna, Dormitorio). */
  const [selectedResidenzaAnchor, setSelectedResidenzaAnchor] = useState<number | null>(null);
  /** Scheda abitante aperta dal doppio tocco su un passeggiatore sulla mappa. */
  const [schedaWandererAbitante, setSchedaWandererAbitante] = useState<Abitante | null>(null);
  /** Bordi neri tra le celle della mappa (toggle dalla barra risorse). */
  const [mostraGrigliaMappa, setMostraGrigliaMappa] = useState(true);
  const lastTapCell = useRef<number | null>(null);
  const lastTapTime = useRef<number>(0);

  /** Frame condiviso per mare + fiumi: ciclo 0…3 sullo spritesheet (simile a GIF). */
  const [waterAnimFrame, setWaterAnimFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setWaterAnimFrame((n) => (n + 1) % 4), 180);
    return () => clearInterval(id);
  }, []);

  const [orologioMinuti, setOrologioMinuti] = useState(() => {
    if (orologioGiocoLastRealMs == null) {
      orologioGiocoLastRealMs = Date.now();
      return orologioGiocoMinutiDaMezzanotte;
    }
    const catchUp = Math.floor((Date.now() - orologioGiocoLastRealMs) / 1000);
    orologioGiocoMinutiDaMezzanotte = (orologioGiocoMinutiDaMezzanotte + catchUp) % 1440;
    orologioGiocoLastRealMs = Date.now();
    return orologioGiocoMinutiDaMezzanotte;
  });
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const deltaSec = Math.floor((now - (orologioGiocoLastRealMs ?? now)) / 1000);
      if (deltaSec <= 0) return;
      orologioGiocoLastRealMs = now;
      orologioGiocoMinutiDaMezzanotte = (orologioGiocoMinutiDaMezzanotte + deltaSec) % 1440;
      setOrologioMinuti(orologioGiocoMinutiDaMezzanotte);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const wandererAbitanteIds = useMemo(() => {
    if (abitanti.length === 0) return [];
    if (wandererAbitanteIdsSession === null) {
      wandererAbitanteIdsSession = pickFourAbitanteIds(abitanti);
    }
    return wandererAbitanteIdsSession;
  }, [abitanti]);

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

  const cols = FIXED_MAP_COLS;
  const rows = FIXED_MAP_ROWS;
  const cellW = CELL_SIZE_PX;
  const cellH = CELL_SIZE_PX;
  const contentWidth = cols * CELL_SIZE_PX + (cols - 1) * GAP;
  const contentHeight = rows * CELL_SIZE_PX + (rows - 1) * GAP;

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

  const edificiFootprintOverlay = useMemo(() => {
    const list: { anchor: number; fp: { w: number; h: number }; variant: FootprintVariant }[] = [];
    for (const [i, e] of Object.entries(edificiInMappa)) {
      if (e.footprint && !e.footprintRef) {
        const variant: FootprintVariant =
          e.nome === "Dormitorio"
            ? "dormitorio"
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
    const wandererSet = new Set(wandererAbitanteIds);
    const out: Abitante[] = [];
    for (const a of abitanti) {
      if (altreCaseMappaTengonoId(a.id, anchor)) continue;
      if ((residenzeMappa[anchor] ?? []).includes(a.id)) continue;
      const dove = residenzaGlobaleDi(a.id, edifici);
      if (nome === "Capanna") {
        if (!a.fazioni?.includes("Nativi")) continue;
        if (dove && dove.nome !== "Capanna") continue;
      } else if (nome === "Dormitorio") {
        if (a.fazioni?.includes("Senzatetto")) continue;
        if (dove && dove.nome !== "Dormitorio") continue;
      } else if (nome === "Baracca") {
        if (!a.fazioni?.includes("Senzatetto")) continue;
      } else continue;
      out.push(a);
    }
    out.sort((a, b) => Number(wandererSet.has(b.id)) - Number(wandererSet.has(a.id)));
    return out;
  }, [
    selectedResidenzaAnchor,
    edificioResidenzaAperta,
    abitanti,
    edifici,
    residenzeMappa,
    wandererAbitanteIds,
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
      const globId = idEdificioGlobalePerNomeResidenza(nome);
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

  const onCellPress = useCallback(
    (cellIndex: number) => {
      const now = Date.now();
      const edificio = edificiInMappa[cellIndex];
      const terreno = terrenoInMappa[cellIndex] ?? "erba";
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
        } else if (terreno !== "river") {
          setSelectedCellForDialog(cellIndex);
        }
        return;
      }
      lastTapCell.current = cellIndex;
      lastTapTime.current = now;
    },
    [edificiInMappa, terrenoInMappa, openRouteForEdificio]
  );

  const handleScegliEdificio = useCallback(
    (cellIndex: number, e: Edificio) => {
      setMappaStatePersistente((s) => {
        if (e.nome === "Strada" && (s.terrenoInMappa[cellIndex] ?? "erba") !== "erba") {
          return s;
        }
        const nextEdifici = {
          ...s.edificiInMappa,
          [cellIndex]: { id: e.id, nome: e.nome, emoji: e.emoji }
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
      setSelectedCellForDialog(null);
    },
    [setMappaStatePersistente]
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
                      if (acqua) {
                        return (
                          <View key={i} style={cellStyle}>
                            {spriteTerreno}
                          </View>
                        );
                      }
                      return (
                        <Pressable key={i} style={cellStyle} onPress={() => onCellPress(i)}>
                          {spriteTerreno}
                        </Pressable>
                      );
                    })}
                  </View>
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
                  {wandererAbitanteIds.map((abitanteId, idx) => (
                    <MapWandererCharacter
                      key={`wanderer-${abitanteId}-${idx}`}
                      cols={cols}
                      rows={rows}
                      cellSizePx={CELL_SIZE_PX}
                      isWalkable={isWalkableCell}
                      instanceId={idx}
                      onDoublePress={() => {
                        const a = abitanti.find((x) => x.id === abitanteId);
                        if (a) setSchedaWandererAbitante(a);
                      }}
                      doubleTapAccessibilityLabel={`Apri scheda ${getAbitanteNome(abitanteId)}`}
                    />
                  ))}
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
                  )}
                </React.Fragment>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <Modal
        visible={selectedCellForDialog !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCellForDialog(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedCellForDialog(null)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Quale edificio vuoi inserire qui?</Text>
            <ScrollView style={styles.modalList} nestedScrollEnabled>
              <Pressable
                style={styles.modalOption}
                onPress={() =>
                  selectedCellForDialog !== null &&
                  handleScegliEdificio(selectedCellForDialog, STRADA_OPZIONE as unknown as Edificio)
                }
              >
                <Text style={styles.modalOptionEmoji}>{STRADA_OPZIONE.emoji}</Text>
                <Text style={styles.modalOptionNome}>{STRADA_OPZIONE.nome}</Text>
              </Pressable>
              {edificiData
                .filter((e) => e.nome !== "Centro di Comando")
                .map((e) => (
                <Pressable
                  key={e.id}
                  style={styles.modalOption}
                  onPress={() => selectedCellForDialog !== null && handleScegliEdificio(selectedCellForDialog, e)}
                >
                  <Text style={styles.modalOptionEmoji}>{e.emoji}</Text>
                  <Text style={styles.modalOptionNome}>{e.nome}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.modalCancel} onPress={() => setSelectedCellForDialog(null)}>
              <Text style={styles.modalCancelText}>Annulla</Text>
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
              {edificioResidenzaAperta?.nome === "Capanna"
                ? "\nSolo Nativi; l'assegnazione aggiorna la Capanna in colonia."
                : edificioResidenzaAperta?.nome === "Dormitorio"
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
                  Nessun abitante disponibile (passeggiatori senza casa, o regole fazione non soddisfatte).
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
                      {wandererAbitanteIds.includes(a.id) ? " · passeggiatore" : ""}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#000000",
    userSelect: "none",
    overflow: "hidden"
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
