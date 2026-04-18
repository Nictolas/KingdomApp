import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Redirect, useRouter } from "expo-router";
import { edificiData } from "../src/data/edificiData";
import { useGameContext } from "../src/context/GameContext";
import { generateRivers, buildTerrenoFromRivers, type TerrenoType } from "../src/game/riverGeneration";
import type { Edificio, Risorsa } from "../src/types";
import { getEmojiAbitante } from "../src/utils/getEmojiAbitante";
import {
  RpgFootprintAdmin3x2,
  RpgFootprintDorm2x2,
  RpgFootprintSpazioporto4x3
} from "../src/components/RpgFootprintBuilding";
import { TerrainSheetSprite } from "../src/components/TerrainSheetSprite";
import { getSandBeachSubtile } from "../src/game/terrainSpriteHelpers";

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
/** Dimensione fissa di ogni cella in pixel (nessuna percentuale, solo px). */
const CELL_SIZE_PX = 40;
/** Gap tra le celle (0 = griglia compatta 2000x2000). */
const GAP = 0;
const DOPPIO_TAP_MS = 400;
const STRADA_SPESSORE = 6;
const STRADA_COLORE = "#78716c";
const STRADA_CERCHIO_RAGGIO = 5;

/** Calcola indici edifici iniziali in funzione di cols/rows (centro griglia). */
function getIndiciEdificiIniziali(cols: number, rows: number) {
  const centro = Math.floor((cols * rows) / 2) - Math.floor(cols / 2);
  return {
    CENTRO_COMANDO_INDEX: centro,
    SPAZIOPORTO_INDEX: centro + 1,
    TRIBUNALE_INDEX: centro + cols,
    SERRA_INDEX: centro - 1,
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

/** Cella è acqua (blu) se true, altrimenti erba (verde). Bordi della mappa = mare. */
function isAcqua(index: number, cols: number, rows: number): boolean {
  const row = Math.floor(index / cols);
  const col = index % cols;
  return row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
}

/** Mare, fiume: nessun segmento strada (né visivo tra due centri celle). */
function isCellaOkPerStrada(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>
): boolean {
  if (isAcqua(index, cols, rows)) return false;
  if ((terrenoInMappa[index] ?? "erba") === "river") return false;
  return true;
}

function segmentoStradaConsentito(
  a: number,
  b: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>
): boolean {
  return isCellaOkPerStrada(a, cols, rows, terrenoInMappa) && isCellaOkPerStrada(b, cols, rows, terrenoInMappa);
}

const GIACIMENTO: EdificioInCella = { id: 0, nome: "Giacimento", emoji: "⛰️" };
const RAFFINERIA_MINERARIA: EdificioInCella = { id: 3, nome: "Raffineria Mineraria", emoji: "⚙️" };
/** Opzione "Strada" per il dialog costruzione (cella diventa lastricato strada). */
const STRADA_OPZIONE: EdificioInCella = { id: -1, nome: "Strada", emoji: "🛤️" };

const DORMITORIO: EdificioInCella = { id: 14, nome: "Dormitorio", emoji: "🛏️" };
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

  const cellaSerra = trovaCellaSingolaConCuscino(idx.SERRA_INDEX, cols, rows, riverSet, vietato);
  if (cellaSerra != null) {
    out[cellaSerra] = { id: 2, nome: "Serra", emoji: "🌱" };
    estendiVietatoConFootprintECuscino(cellaSerra, 1, 1, cols, rows, vietato);
  }

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
  const celleCapanne = shuffled.slice(0, Math.min(nCapanne, shuffled.length));
  const celleGiacimento = shuffled.slice(nCapanne, nCapanne + Math.min(nGiacimento, Math.max(0, shuffled.length - nCapanne)));
  const capanne: Record<number, EdificioInCella> = {};
  celleCapanne.forEach((i) => (capanne[i] = CAPANNA));
  const giacimenti: Record<number, EdificioInCella> = {};
  celleGiacimento.forEach((i) => (giacimenti[i] = GIACIMENTO));
  return { ...edificiIniziali, ...capanne, ...giacimenti };
}

/** Stato iniziale mappa: prima si generano i fiumi (solo bordi vietati), poi gli edifici su terra (no fiumi, no mare), infine decorazioni su celle libere. */
function getInitialMappaWithRivers(cols: number, rows: number): {
  edificiInMappa: Record<number, EdificioInCella>;
  terrenoInMappa: Record<number, TerrenoType>;
  decorazioniInMappa: Record<number, string>;
} {
  const totaleCelle = cols * rows;
  const borderIndices = new Set<number>();
  for (let i = 0; i < totaleCelle; i++) if (isAcqua(i, cols, rows)) borderIndices.add(i);
  const adminAnchor = scegliAnchorComplessoAmministrativo(cols, rows);
  const adminFootprint = getIndiciFootprint(adminAnchor, ADMIN_FOOTPRINT_W, ADMIN_FOOTPRINT_H, cols);
  const adminCuscino = getIndiciCuscinoErba(adminAnchor, ADMIN_FOOTPRINT_W, ADMIN_FOOTPRINT_H, cols, rows);
  const forbiddenForRivers = new Set<number>([...borderIndices, ...adminFootprint, ...adminCuscino]);
  const { riverIndices, sandIndices } = generateRivers({
    cols,
    rows,
    numSources: 2 + Math.floor(Math.random() * 2),
    maxLength: 60,
    bifurcationProbability: 0.1,
    forbiddenIndices: forbiddenForRivers
  });
  const riverSet = new Set(riverIndices);
  const edificiInMappa = getInitialEdificiInMappa(cols, rows, riverSet, adminAnchor);
  const giacimentoIndices = new Set(
    Object.keys(edificiInMappa)
      .map(Number)
      .filter((i) => edificiInMappa[i]?.nome === "Giacimento")
  );
  const terrenoInMappa = buildTerrenoFromRivers(riverIndices, sandIndices, giacimentoIndices);

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

  return { edificiInMappa, terrenoInMappa, decorazioniInMappa };
}

type MappaRuntimeState = ReturnType<typeof getInitialMappaWithRivers>;

/**
 * Cache fuori dal ciclo di vita di React: quando si esce dalla mappa (es. /amministrazione) e si torna
 * con `replace("/")`, il componente si rimonta; senza questo, `useState` rigenererebbe fiumi e decorazioni.
 */
let mappaSessione: MappaRuntimeState | null = null;

/** Coppie [indiceA, indiceB] per strade iniziali (anchor centro → spazioporto, serra); usa le posizioni effettive degli edifici. */
function getStradeIniziali(edificiInMappa: Record<number, EdificioInCella>): [number, number][] {
  let centro: number | null = null;
  let spazioporto: number | null = null;
  let serra: number | null = null;
  for (const [i, e] of Object.entries(edificiInMappa)) {
    const idx = Number(i);
    if (e.nome === "Centro di Comando" && e.footprint && !e.footprintRef) centro = idx;
    if (e.nome === "Spazioporto" && e.footprint && !e.footprintRef) spazioporto = idx;
    if (e.nome === "Serra") serra = idx;
  }
  const out: [number, number][] = [];
  if (centro != null && spazioporto != null) out.push([centro, spazioporto]);
  if (centro != null && serra != null) out.push([centro, serra]);
  return out;
}

/** Centro della cella in px (per layer strade/emoji). Usa dimensioni effettive griglia. */
function getCellCenter(cellIndex: number, cellW: number, cellH: number, cols: number): { x: number; y: number } {
  const col = cellIndex % cols;
  const row = Math.floor(cellIndex / cols);
  const x = col * (cellW + GAP) + cellW / 2;
  const y = row * (cellH + GAP) + cellH / 2;
  return { x, y };
}

/** Angolo in alto a sinistra della cella in px (per overlay edifici multi-cella). */
function getCellTopLeft(cellIndex: number, cellW: number, cellH: number, cols: number): { left: number; top: number } {
  const col = cellIndex % cols;
  const row = Math.floor(cellIndex / cols);
  return { left: col * (cellW + GAP), top: row * (cellH + GAP) };
}

type FootprintVariant = "amministrazione" | "dormitorio" | "spazioporto";

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

/** Vicini ortogonali (su, giù, sinistra, destra) con controlli sui bordi. */
function getViciniOrtogonali(index: number, cols: number, rows: number): number[] {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const out: number[] = [];
  if (row > 0) out.push(index - cols);
  if (row < rows - 1) out.push(index + cols);
  if (col > 0) out.push(index - 1);
  if (col < cols - 1) out.push(index + 1);
  return out;
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
  const { risorse, abitanti, edifici, mese, anno, isLoading, avanzaMese, calcolaProduzioneConsumo, calcolaDeltaOrdiniMercato, calcolaFelicitàModificata } = useGameContext();
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
  const setEdificiInMappa = useCallback(
    (updater: (prev: Record<number, EdificioInCella>) => Record<number, EdificioInCella>) => {
      setMappaStatePersistente((s) => ({ ...s, edificiInMappa: updater(s.edificiInMappa) }));
    },
    [setMappaStatePersistente]
  );
  const [selectedCellForDialog, setSelectedCellForDialog] = useState<number | null>(null);
  const [selectedCellForTransformDialog, setSelectedCellForTransformDialog] = useState<number | null>(null);
  const [showCapannaAbitantiModal, setShowCapannaAbitantiModal] = useState(false);
  const lastTapCell = useRef<number | null>(null);
  const lastTapTime = useRef<number>(0);

  /** Frame condiviso per mare + fiumi: ciclo 0…3 sullo spritesheet (simile a GIF). */
  const [waterAnimFrame, setWaterAnimFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setWaterAnimFrame((n) => (n + 1) % 4), 180);
    return () => clearInterval(id);
  }, []);

  const capannaEdificio = edifici.find((e) => e.nome === "Capanna");
  const abitantiCapanna = (capannaEdificio?.abitantiAssegnati ?? [])
    .map((id) => abitanti.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => a != null);

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
  const stradeIniziali = getStradeIniziali(edificiInMappa);

  const edificiFootprintOverlay = useMemo(() => {
    const list: { anchor: number; fp: { w: number; h: number }; variant: FootprintVariant }[] = [];
    for (const [i, e] of Object.entries(edificiInMappa)) {
      if (e.footprint && !e.footprintRef) {
        const variant: FootprintVariant =
          e.nome === "Dormitorio"
            ? "dormitorio"
            : e.nome === "Spazioporto"
              ? "spazioporto"
              : "amministrazione";
        list.push({ anchor: Number(i), fp: e.footprint, variant });
      }
    }
    return list;
  }, [edificiInMappa]);

  const gridContainerStyle = {
    display: "grid" as const,
    gridTemplateColumns: `repeat(${cols}, ${CELL_SIZE_PX}px)`,
    gridTemplateRows: `repeat(${rows}, ${CELL_SIZE_PX}px)`,
    width: contentWidth,
    height: contentHeight,
    position: "relative" as const
  };

  const openRouteForEdificio = useCallback(
    (nome: string) => {
      const route = EDIFICIO_TO_ROUTE[nome];
      if (route) router.push(route);
    },
    [router]
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
          } else if (edificio.nome === "Capanna") {
            setShowCapannaAbitantiModal(true);
          } else {
            openRouteForEdificio(edificio.nome);
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
      setEdificiInMappa((prev) => ({
        ...prev,
        [cellIndex]: { id: e.id, nome: e.nome, emoji: e.emoji }
      }));
      setSelectedCellForDialog(null);
    },
    []
  );

  const handleTrasformaGiacimento = useCallback((cellIndex: number) => {
    setEdificiInMappa((prev) => ({
      ...prev,
      [cellIndex]: RAFFINERIA_MINERARIA
    }));
    setSelectedCellForTransformDialog(null);
  }, []);

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
            <Text style={styles.badgeText}>📅 Mese {mese}</Text>
            <Text style={styles.badgeText}>· Anno {anno}</Text>
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
                        styles.cellaFixed,
                        styles.cellaTextureTerreno,
                        { width: CELL_SIZE_PX, height: CELL_SIZE_PX },
                        hasEdificio && !èStrada && styles.cellaEdificio
                      ];
                      const spriteTerreno = acquaAnimata ? (
                        <TerrainSheetSprite cellSize={CELL_SIZE_PX} terrain="water" frame={waterAnimFrame} />
                      ) : terreno === "sabbia" ? (
                        <TerrainSheetSprite
                          cellSize={CELL_SIZE_PX}
                          terrain="sand"
                          beachSubtile={getSandBeachSubtile(i, cols, rows, terrenoInMappa)}
                        />
                      ) : (
                        <TerrainSheetSprite cellSize={CELL_SIZE_PX} terrain="grass" />
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
                  <View
                    style={[styles.roadsLayer, styles.roadsLayerSopra, { width: contentWidth, height: contentHeight }]}
                    pointerEvents="none"
                  >
                  {stradeIniziali
                    .filter(([a, b]) => edificiInMappa[a] && edificiInMappa[b])
                    .flatMap(([from, to]) =>
                      getManhattanPathSegments(from, to, cols)
                        .filter(([a, b]) => segmentoStradaConsentito(a, b, cols, rows, terrenoInMappa))
                        .map(([a, b]) => ({ from: a, to: b, keyBase: `${from}-${to}` }))
                    )
                    .map(({ from: a, to: b, keyBase }, segIdx) => {
                      const c1 = getCellCenter(a, cellW, cellH, cols);
                      const c2 = getCellCenter(b, cellW, cellH, cols);
                      const dx = c2.x - c1.x;
                      const dy = c2.y - c1.y;
                      const length = Math.sqrt(dx * dx + dy * dy) || 1;
                      const midX = (c1.x + c2.x) / 2;
                      const midY = (c1.y + c2.y) / 2;
                      const angle = Math.atan2(dy, dx);
                      return (
                        <View
                          key={`strada-${keyBase}-${a}-${b}-${segIdx}`}
                          style={[styles.stradaLinea, { width: length, height: STRADA_SPESSORE, left: midX - length / 2, top: midY - STRADA_SPESSORE / 2, transform: [{ rotate: `${angle}rad` }] }]}
                        />
                      );
                    })}
                  {(() => {
                    const drawnEdges = new Set<string>();
                    const segmenti: [number, number][] = [];
                    const celleIsolate: number[] = [];
                    Object.keys(edificiInMappa)
                      .map(Number)
                      .filter((i) => edificiInMappa[i]?.nome === "Strada")
                      .forEach((i) => {
                        const vicini = getViciniOrtogonali(i, cols, rows).filter((n) => edificiInMappa[n]);
                        if (vicini.length === 0) celleIsolate.push(i);
                        else vicini.forEach((n) => {
                          if (!segmentoStradaConsentito(i, n, cols, rows, terrenoInMappa)) return;
                          const key = `${Math.min(i, n)}-${Math.max(i, n)}`;
                          if (!drawnEdges.has(key)) {
                            drawnEdges.add(key);
                            segmenti.push([i, n]);
                          }
                        });
                      });
                    return (
                      <>
                        {segmenti.map(([from, to]) => {
                          const c1 = getCellCenter(from, cellW, cellH, cols);
                          const c2 = getCellCenter(to, cellW, cellH, cols);
                          const dx = c2.x - c1.x;
                          const dy = c2.y - c1.y;
                          const length = Math.sqrt(dx * dx + dy * dy) || 1;
                          const midX = (c1.x + c2.x) / 2;
                          const midY = (c1.y + c2.y) / 2;
                          const angle = Math.atan2(dy, dx);
                          return (
                            <View
                              key={`strada-cell-${from}-${to}`}
                              style={[styles.stradaLinea, { width: length, height: STRADA_SPESSORE, left: midX - length / 2, top: midY - STRADA_SPESSORE / 2, transform: [{ rotate: `${angle}rad` }] }]}
                            />
                          );
                        })}
                        {celleIsolate.map((i) => {
                          const c = getCellCenter(i, cellW, cellH, cols);
                          const r = STRADA_CERCHIO_RAGGIO;
                          return (
                            <View key={`strada-cerchio-${i}`} style={[styles.stradaCerchio, { width: r * 2, height: r * 2, left: c.x - r, top: c.y - r, borderRadius: r }]} />
                          );
                        })}
                      </>
                    );
                  })()}
                </View>
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
                        <View key={i} style={[styles.cella, styles.cellaFixed, { width: CELL_SIZE_PX, height: CELL_SIZE_PX }]}>
                          {mostraEmoji ? (
                            <Text style={[styles.edificioEmoji, { fontSize: Math.max(10, Math.min(22, CELL_SIZE_PX - 4)) }]}>{emoji}</Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
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
                <Pressable
                  key={r.id}
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

      <Modal
        visible={showCapannaAbitantiModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCapannaAbitantiModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowCapannaAbitantiModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>⛺ Abitanti della Capanna</Text>
            <Text style={styles.modalSubtitle}>
              Chi abita in questa residenza (solo fazione Nativi):
            </Text>
            <ScrollView style={styles.modalList} nestedScrollEnabled>
              {abitantiCapanna.length === 0 ? (
                <Text style={styles.capannaEmpty}>Nessun abitante al momento.</Text>
              ) : (
                abitantiCapanna.map((a) => (
                  <View key={a.id} style={styles.capannaAbitanteRow}>
                    <Text style={styles.capannaAbitanteEmoji}>{getEmojiAbitante(a)}</Text>
                    <Text style={styles.capannaAbitanteNome}>{a.nome}</Text>
                    {a.lavoro ? (
                      <Text style={styles.capannaAbitanteLavoro}> · {a.lavoro}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </ScrollView>
            <View style={styles.modalButtonsRow}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowCapannaAbitantiModal(false)}
              >
                <Text style={styles.modalButtonText}>Chiudi</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={() => {
                  setShowCapannaAbitantiModal(false);
                  router.push("/residenze");
                }}
              >
                <Text style={styles.modalButtonText}>Vai a Residenze</Text>
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
  badgeText: {
    fontSize: 11,
    color: "rgba(248,250,252,0.85)",
    fontWeight: "600"
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
  roadsLayer: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 0
  },
  roadsLayerSopra: {
    zIndex: 1
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
  stradaLinea: {
    position: "absolute",
    backgroundColor: STRADA_COLORE,
    borderRadius: STRADA_SPESSORE / 2
  },
  griglia: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start"
  },
  cella: {
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.15)",
    justifyContent: "center",
    alignItems: "center"
  },
  /** Erba / sabbia / acqua: texture da spritesheet (TerrainSheetSprite). */
  cellaTextureTerreno: {
    backgroundColor: "transparent",
    overflow: "hidden",
    position: "relative"
  },
  cellaEdificio: {},
  stradaCerchio: {
    position: "absolute",
    backgroundColor: STRADA_COLORE
  },
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
