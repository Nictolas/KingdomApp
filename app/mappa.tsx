import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { edificiData } from "../src/data/edificiData";
import { useGameContext } from "../src/context/GameContext";
import { generateRivers, buildTerrenoFromRivers, type TerrenoType } from "../src/game/riverGeneration";
import type { Edificio, Risorsa } from "../src/types";

const GAP = 2;
/** Dimensione fissa della mappa: non dipende dal viewport. Stabilita una sola volta all'avvio. */
const FIXED_MAP_COLS = 50;
const FIXED_MAP_ROWS = 50;
/** Dimensione fissa di ogni cella in pixel. */
const CELL_SIZE_PX = 32;
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

type EdificioInCella = { id: number; nome: string; emoji: string };

/** Cella è acqua (blu) se true, altrimenti erba (verde). Bordi della mappa = mare. */
function isAcqua(index: number, cols: number, rows: number): boolean {
  const row = Math.floor(index / cols);
  const col = index % cols;
  return row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
}

const GIACIMENTO: EdificioInCella = { id: 0, nome: "Giacimento", emoji: "⛰️" };
const RAFFINERIA_MINERARIA: EdificioInCella = { id: 3, nome: "Raffineria Mineraria", emoji: "⚙️" };
/** Opzione "Strada" per il dialog costruzione (cella diventa lastricato strada). */
const STRADA_OPZIONE: EdificioInCella = { id: -1, nome: "Strada", emoji: "🛤️" };

const DORMITORIO: EdificioInCella = { id: 14, nome: "Dormitorio", emoji: "🛏️" };
const CAPANNA: EdificioInCella = { id: 20, nome: "Capanna", emoji: "⛺" };

/** Trova la prima cella terra (non acqua, non fiume, non in exclude) partendo da index. */
function findNearestLandNotRiver(
  start: number,
  cols: number,
  rows: number,
  riverSet: Set<number>,
  exclude: Set<number> = new Set()
): number | null {
  if (!isAcqua(start, cols, rows) && !riverSet.has(start) && !exclude.has(start)) return start;
  const visitati = new Set<number>([start]);
  let frontiera: number[] = [start];
  for (let dist = 0; dist < cols * rows && frontiera.length > 0; dist++) {
    const next: number[] = [];
    for (const i of frontiera) {
      for (const n of getViciniOrtogonali(i, cols, rows)) {
        if (visitati.has(n)) continue;
        visitati.add(n);
        if (!isAcqua(n, cols, rows) && !riverSet.has(n) && !exclude.has(n)) return n;
        next.push(n);
      }
    }
    frontiera = next;
  }
  return null;
}

/** Restituisce edifici iniziali fissi, spostati su terra (no fiume, no mare); nessuna cella condivisa. */
function getEdificiIniziali(
  cols: number,
  rows: number,
  riverSet: Set<number>
): Record<number, EdificioInCella> {
  const idx = getIndiciEdificiIniziali(cols, rows);
  const edifici: [number, EdificioInCella][] = [
    [idx.CENTRO_COMANDO_INDEX, { id: 1, nome: "Centro di Comando", emoji: "🏛️" }],
    [idx.SPAZIOPORTO_INDEX, { id: 19, nome: "Spazioporto", emoji: "🚀" }],
    [idx.TRIBUNALE_INDEX, { id: 12, nome: "Tribunale", emoji: "⚖️" }],
    [idx.SERRA_INDEX, { id: 2, nome: "Serra", emoji: "🌱" }],
    [idx.DORMITORIO_1_INDEX, DORMITORIO],
    [idx.DORMITORIO_2_INDEX, DORMITORIO],
    [idx.DORMITORIO_3_INDEX, DORMITORIO]
  ];
  const out: Record<number, EdificioInCella> = {};
  const used = new Set<number>();
  for (const [preferred, e] of edifici) {
    const cell = findNearestLandNotRiver(preferred, cols, rows, riverSet, used);
    if (cell != null) {
      out[cell] = e;
      used.add(cell);
    }
  }
  return out;
}

/** Restituisce lo stato iniziale della mappa; esclude sempre acqua e fiumi dalle celle edificabili. */
function getInitialEdificiInMappa(
  cols: number,
  rows: number,
  riverSet: Set<number>
): Record<number, EdificioInCella> {
  const edificiIniziali = getEdificiIniziali(cols, rows, riverSet);
  const totaleCelle = cols * rows;
  const occupate = new Set<number>(Object.keys(edificiIniziali).map(Number));
  const erbaLibera: number[] = [];
  for (let i = 0; i < totaleCelle; i++) {
    if (!isAcqua(i, cols, rows) && !riverSet.has(i) && !occupate.has(i)) erbaLibera.push(i);
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

/** Stato iniziale mappa: prima si generano i fiumi (solo bordi vietati), poi gli edifici su terra (no fiumi, no mare). */
function getInitialMappaWithRivers(cols: number, rows: number): {
  edificiInMappa: Record<number, EdificioInCella>;
  terrenoInMappa: Record<number, TerrenoType>;
} {
  const totaleCelle = cols * rows;
  const borderIndices = new Set<number>();
  for (let i = 0; i < totaleCelle; i++) if (isAcqua(i, cols, rows)) borderIndices.add(i);
  const { riverIndices, sandIndices } = generateRivers({
    cols,
    rows,
    numSources: 2 + Math.floor(Math.random() * 2),
    maxLength: 60,
    bifurcationProbability: 0.1,
    forbiddenIndices: borderIndices
  });
  const riverSet = new Set(riverIndices);
  const edificiInMappa = getInitialEdificiInMappa(cols, rows, riverSet);
  const giacimentoIndices = new Set(
    Object.keys(edificiInMappa)
      .map(Number)
      .filter((i) => edificiInMappa[i]?.nome === "Giacimento")
  );
  const terrenoInMappa = buildTerrenoFromRivers(riverIndices, sandIndices, giacimentoIndices);
  return { edificiInMappa, terrenoInMappa };
}

/** Coppie [indiceA, indiceB] per strade iniziali (centro → spazioporto, tribunale, serra); usa le posizioni effettive degli edifici. */
function getStradeIniziali(edificiInMappa: Record<number, EdificioInCella>): [number, number][] {
  let centro: number | null = null;
  let spazioporto: number | null = null;
  let tribunale: number | null = null;
  let serra: number | null = null;
  for (const [i, e] of Object.entries(edificiInMappa)) {
    const idx = Number(i);
    if (e.nome === "Centro di Comando") centro = idx;
    if (e.nome === "Spazioporto") spazioporto = idx;
    if (e.nome === "Tribunale") tribunale = idx;
    if (e.nome === "Serra") serra = idx;
  }
  const out: [number, number][] = [];
  if (centro != null && spazioporto != null) out.push([centro, spazioporto]);
  if (centro != null && tribunale != null) out.push([centro, tribunale]);
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
  const { risorse, abitanti, mese, anno, isLoading, avanzaMese, calcolaProduzioneConsumo, calcolaDeltaOrdiniMercato, calcolaFelicitàModificata } = useGameContext();
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

  const [mappaState, setMappaState] = useState<{
    edificiInMappa: Record<number, EdificioInCella>;
    terrenoInMappa: Record<number, TerrenoType>;
  }>(() => getInitialMappaWithRivers(FIXED_MAP_COLS, FIXED_MAP_ROWS));
  const edificiInMappa = mappaState.edificiInMappa;
  const terrenoInMappa = mappaState.terrenoInMappa;
  const setEdificiInMappa = useCallback(
    (updater: (prev: Record<number, EdificioInCella>) => Record<number, EdificioInCella>) => {
      setMappaState((s) => ({ ...s, edificiInMappa: updater(s.edificiInMappa) }));
    },
    []
  );
  const [selectedCellForDialog, setSelectedCellForDialog] = useState<number | null>(null);
  const [selectedCellForTransformDialog, setSelectedCellForTransformDialog] = useState<number | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [mapScale, setMapScale] = useState(1);
  const lastTapCell = useRef<number | null>(null);
  const lastTapTime = useRef<number>(0);

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
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
    }
  }, []);

  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const viewportW = useRef(0);
  const viewportH = useRef(0);
  const activePointers = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const dragStart = useRef<{ pointerX: number; pointerY: number; panX: number; panY: number } | null>(null);
  const pinchStart = useRef<{
    dist: number;
    scale: number;
    centerX: number;
    centerY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const pointerDownTarget = useRef<HTMLElement | null>(null);
  const didDragThisGesture = useRef(false);
  const pendingWheelPan = useRef<{ x: number; y: number } | null>(null);
  const mapScaleRef = useRef(1);
  const panXRef = useRef(0);
  const panYRef = useRef(0);
  const rafId = useRef<number | null>(null);
  const setIsDraggingRef = useRef(setIsDragging);
  setIsDraggingRef.current = setIsDragging;
  mapScaleRef.current = mapScale;
  panXRef.current = panX;
  panYRef.current = panY;

  const cols = FIXED_MAP_COLS;
  const rows = FIXED_MAP_ROWS;
  const totaleCelle = cols * rows;
  const cellW = CELL_SIZE_PX;
  const cellH = CELL_SIZE_PX;
  const contentWidth = cols * CELL_SIZE_PX + (cols - 1) * GAP;
  const contentHeight = rows * CELL_SIZE_PX + (rows - 1) * GAP;
  const stradeIniziali = getStradeIniziali(edificiInMappa);
  const windowDim = Dimensions.get("window");
  const vwForCenter = viewportSize.w > 0 ? viewportSize.w : windowDim.width;
  const vhForCenter = viewportSize.h > 0 ? viewportSize.h : windowDim.height;

  const onViewportLayout = useCallback((e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const w = e.nativeEvent.layout.width;
    const h = e.nativeEvent.layout.height;
    viewportW.current = w;
    viewportH.current = h;
    setViewportSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, []);

  useEffect(() => {
    if (pendingWheelPan.current === null) return;
    const { x, y } = pendingWheelPan.current;
    pendingWheelPan.current = null;
    setPanX(x);
    setPanY(y);
  }, [mapScale]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const el = document.getElementById("mappa-viewport") as HTMLElement | null;
    if (!el) return;

    el.style.touchAction = "none";
    el.style.userSelect = "none";
    el.style.pointerEvents = "auto";

    const getContainerCoords = (clientX: number, clientY: number, rect: DOMRect) => ({
      x: clientX - rect.left,
      y: clientY - rect.top
    });

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
      activePointers.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      const rect = el.getBoundingClientRect();

      if (activePointers.current.size === 1) {
        const { x, y } = getContainerCoords(e.clientX, e.clientY, rect);
        dragStart.current = { pointerX: x, pointerY: y, panX: panXRef.current, panY: panYRef.current };
        pinchStart.current = null;
        pointerDownTarget.current = e.target as HTMLElement;
        didDragThisGesture.current = false;
      } else if (activePointers.current.size === 2) {
        dragStart.current = null;
        const arr = Array.from(activePointers.current.entries());
        const c1 = getContainerCoords(arr[0][1].clientX, arr[0][1].clientY, rect);
        const c2 = getContainerCoords(arr[1][1].clientX, arr[1][1].clientY, rect);
        const dist = Math.hypot(c2.x - c1.x, c2.y - c1.y);
        const centerX = (c1.x + c2.x) / 2;
        const centerY = (c1.y + c2.y) / 2;
        pinchStart.current = {
          dist,
          scale: mapScaleRef.current,
          centerX,
          centerY,
          panX: panXRef.current,
          panY: panYRef.current
        };
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      activePointers.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      const rect = el.getBoundingClientRect();
      const n = activePointers.current.size;

      if (n === 1 && dragStart.current) {
        const p = Array.from(activePointers.current.values())[0];
        const cur = getContainerCoords(p.clientX, p.clientY, rect);
        const dx = cur.x - dragStart.current.pointerX;
        const dy = cur.y - dragStart.current.pointerY;
        didDragThisGesture.current = true;
        setIsDraggingRef.current(true);
        const scale = mapScaleRef.current;
        const vw = viewportW.current;
        const vh = viewportH.current;
        const minPanX = (contentWidth * scale) / 2 - vw / 2;
        const maxPanX = vw / 2 - (contentWidth * scale) / 2;
        const minPanY = (contentHeight * scale) / 2 - vh / 2;
        const maxPanY = vh / 2 - (contentHeight * scale) / 2;
        const newPanX = Math.max(minPanX, Math.min(maxPanX, dragStart.current.panX - dx));
        const newPanY = Math.max(minPanY, Math.min(maxPanY, dragStart.current.panY - dy));
        if (rafId.current !== null) cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(() => {
          rafId.current = null;
          setPanX(newPanX);
          setPanY(newPanY);
        });
      } else if (n === 2 && pinchStart.current) {
        const arr = Array.from(activePointers.current.entries());
        const c1 = getContainerCoords(arr[0][1].clientX, arr[0][1].clientY, rect);
        const c2 = getContainerCoords(arr[1][1].clientX, arr[1][1].clientY, rect);
        const dist = Math.hypot(c2.x - c1.x, c2.y - c1.y);
        const centerX = (c1.x + c2.x) / 2;
        const centerY = (c1.y + c2.y) / 2;
        const ps = pinchStart.current;
        const scaleNew = Math.min(3, Math.max(0.4, ps.scale * (dist / ps.dist)));
        const vw = viewportW.current;
        const vh = viewportH.current;
        const contentX = (centerX - vw / 2 + (contentWidth * ps.scale) / 2 + ps.panX) / ps.scale;
        const contentY = (centerY - vh / 2 + (contentHeight * ps.scale) / 2 + ps.panY) / ps.scale;
        let newPanX = vw / 2 - (contentWidth * scaleNew) / 2 + contentX * scaleNew - centerX;
        let newPanY = vh / 2 - (contentHeight * scaleNew) / 2 + contentY * scaleNew - centerY;
        const minPanX = (contentWidth * scaleNew) / 2 - vw / 2;
        const maxPanX = vw / 2 - (contentWidth * scaleNew) / 2;
        const minPanY = (contentHeight * scaleNew) / 2 - vh / 2;
        const maxPanY = vh / 2 - (contentHeight * scaleNew) / 2;
        newPanX = Math.max(minPanX, Math.min(maxPanX, newPanX));
        newPanY = Math.max(minPanY, Math.min(maxPanY, newPanY));
        if (rafId.current !== null) cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(() => {
          rafId.current = null;
          setMapScale(scaleNew);
          setPanX(newPanX);
          setPanY(newPanY);
        });
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (el.releasePointerCapture) el.releasePointerCapture(e.pointerId);
      activePointers.current.delete(e.pointerId);
      const n = activePointers.current.size;

      if (n === 0) {
        if (!didDragThisGesture.current && pointerDownTarget.current) {
          pointerDownTarget.current.click();
        }
        pointerDownTarget.current = null;
        dragStart.current = null;
        pinchStart.current = null;
        didDragThisGesture.current = false;
        setIsDraggingRef.current(false);
      } else if (n === 1) {
        pinchStart.current = null;
        const [id, p] = Array.from(activePointers.current.entries())[0];
        const rect = el.getBoundingClientRect();
        const { x, y } = getContainerCoords(p.clientX, p.clientY, rect);
        dragStart.current = { pointerX: x, pointerY: y, panX: panXRef.current, panY: panYRef.current };
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      activePointers.current.delete(e.pointerId);
      if (activePointers.current.size === 0) {
        dragStart.current = null;
        pinchStart.current = null;
        pointerDownTarget.current = null;
        didDragThisGesture.current = false;
        setIsDraggingRef.current(false);
      } else if (activePointers.current.size === 1) {
        pinchStart.current = null;
        const [_, p] = Array.from(activePointers.current.entries())[0];
        const rect = el.getBoundingClientRect();
        const { x, y } = getContainerCoords(p.clientX, p.clientY, rect);
        dragStart.current = { pointerX: x, pointerY: y, panX: panXRef.current, panY: panYRef.current };
      }
    };

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const scale = mapScaleRef.current;
      const scaleDelta = 1 - e.deltaY * 0.0018;
      const scaleNew = Math.min(3, Math.max(0.4, scale * scaleDelta));
      if (scaleNew === scale) return;
      const vw = viewportW.current;
      const vh = viewportH.current;
      const contentX = (mouseX - vw / 2 + (contentWidth * scale) / 2 + panXRef.current) / scale;
      const contentY = (mouseY - vh / 2 + (contentHeight * scale) / 2 + panYRef.current) / scale;
      let panXNew = vw / 2 - (contentWidth * scaleNew) / 2 + contentX * scaleNew - mouseX;
      let panYNew = vh / 2 - (contentHeight * scaleNew) / 2 + contentY * scaleNew - mouseY;
      const minPanX = (contentWidth * scaleNew) / 2 - vw / 2;
      const maxPanX = vw / 2 - (contentWidth * scaleNew) / 2;
      const minPanY = (contentHeight * scaleNew) / 2 - vh / 2;
      const maxPanY = vh / 2 - (contentHeight * scaleNew) / 2;
      panXNew = Math.max(minPanX, Math.min(maxPanX, panXNew));
      panYNew = Math.max(minPanY, Math.min(maxPanY, panYNew));
      pendingWheelPan.current = { x: panXNew, y: panYNew };
      setMapScale(scaleNew);
    };

    const opts = { passive: false };
    el.addEventListener("pointerdown", onPointerDown, opts);
    el.addEventListener("pointermove", onPointerMove, opts);
    el.addEventListener("pointerup", onPointerUp, opts);
    el.addEventListener("pointercancel", onPointerCancel, opts);
    el.addEventListener("pointerleave", onPointerUp, opts);
    el.addEventListener("wheel", onWheelNative, opts);

    return () => {
      el.style.touchAction = "";
      el.style.userSelect = "";
      el.style.pointerEvents = "";
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerCancel);
      el.removeEventListener("pointerleave", onPointerUp);
      el.removeEventListener("wheel", onWheelNative);
    };
  }, [contentWidth, contentHeight]);

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
          <Pressable style={styles.menuBtn} onPress={() => router.push("/menu")}>
            <Text style={styles.menuBtnText}>Menu</Text>
          </Pressable>
        </View>
      </View>

      {/* Contenitore mappa: viewport centrato, sfondo nero; zoom dal centro/mouse */}
      <View style={styles.mapContainer}>
        <View
          nativeID="mappa-viewport"
          style={[
            styles.viewport,
            styles.viewportTouchAction,
            styles.viewportPointerEvents,
            Platform.OS === "web" && (isDragging ? styles.viewportWebGrabbing : styles.viewportWeb)
          ]}
          onLayout={onViewportLayout}
        >
          <View style={styles.viewportCenterWrap} pointerEvents="box-none">
            <View
              style={[
                styles.mapTransform,
                {
                  width: contentWidth,
                  height: contentHeight,
                  minWidth: contentWidth,
                  minHeight: contentHeight,
                  zIndex: 1,
                  transform: [
                    { translateX: vwForCenter / 2 - (contentWidth * mapScale) / 2 - panX },
                    { translateY: vhForCenter / 2 - (contentHeight * mapScale) / 2 - panY },
                    { scale: mapScale }
                  ]
                },
                Platform.OS === "web" && styles.mapTransformWeb
              ]}
              pointerEvents="box-none"
            >
          <View style={[styles.gridFill, styles.gridFillFixed, { width: contentWidth, height: contentHeight, minWidth: contentWidth, minHeight: contentHeight }]}>
            {Array.from({ length: rows }, (_, rowIndex) => (
              <View key={rowIndex} style={[styles.gridRowFixed, { gap: GAP, height: cellH }]}>
                {Array.from({ length: cols }, (_, colIndex) => {
                  const i = rowIndex * cols + colIndex;
                  const acqua = isAcqua(i, cols, rows);
                  const terreno = terrenoInMappa[i] ?? "erba";
                  const edificio = edificiInMappa[i];
                  const hasEdificio = !!edificio;
                  const èStrada = edificio?.nome === "Strada";
                  const styleTerreno =
                    acqua
                      ? styles.cellaAcqua
                      : terreno === "river"
                        ? styles.cellaFiume
                        : terreno === "sabbia"
                          ? styles.cellaSabbia
                          : styles.cellaErba;
                  const cellStyle = [
                    styles.cella,
                    styleTerreno,
                    { width: cellW, height: cellH },
                    hasEdificio && !èStrada && styles.cellaEdificio
                  ];
                  if (acqua) {
                    return <View key={i} style={cellStyle} />;
                  }
                  return (
                    <Pressable key={i} style={cellStyle} onPress={() => onCellPress(i)} />
                  );
                })}
              </View>
            ))}
          </View>
          <View
            style={[
              styles.roadsLayer,
              styles.roadsLayerSopra,
              { width: contentWidth, height: contentHeight }
            ]}
            pointerEvents="none"
          >
            {stradeIniziali.filter(
              ([a, b]) => edificiInMappa[a] && edificiInMappa[b]
            ).map(([from, to]) => {
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
                    key={`strada-${from}-${to}`}
                    style={[
                      styles.stradaLinea,
                      {
                        width: length,
                        height: STRADA_SPESSORE,
                        left: midX - length / 2,
                        top: midY - STRADA_SPESSORE / 2,
                        transform: [{ rotate: `${angle}rad` }]
                      }
                    ]}
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
                    const vicini = getViciniOrtogonali(i, cols, rows).filter(
                      (n) => edificiInMappa[n]
                    );
                    if (vicini.length === 0) {
                      celleIsolate.push(i);
                    } else {
                      vicini.forEach((n) => {
                        const key = `${Math.min(i, n)}-${Math.max(i, n)}`;
                        if (!drawnEdges.has(key)) {
                          drawnEdges.add(key);
                          segmenti.push([i, n]);
                        }
                      });
                    }
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
                          style={[
                            styles.stradaLinea,
                            {
                              width: length,
                              height: STRADA_SPESSORE,
                              left: midX - length / 2,
                              top: midY - STRADA_SPESSORE / 2,
                              transform: [{ rotate: `${angle}rad` }]
                            }
                          ]}
                        />
                      );
                    })}
                    {celleIsolate.map((i) => {
                      const c = getCellCenter(i, cellW, cellH, cols);
                      const r = STRADA_CERCHIO_RAGGIO;
                      return (
                        <View
                          key={`strada-cerchio-${i}`}
                          style={[
                            styles.stradaCerchio,
                            {
                              width: r * 2,
                              height: r * 2,
                              left: c.x - r,
                              top: c.y - r,
                              borderRadius: r
                            }
                          ]}
                        />
                      );
                    })}
                  </>
                );
              })()}
            </View>
            <View
              style={[styles.gridFill, styles.gridFillFixed, styles.grigliaEmoji, { width: contentWidth, height: contentHeight }]}
              pointerEvents="none"
            >
              {Array.from({ length: rows }, (_, rowIndex) => (
                <View key={rowIndex} style={[styles.gridRowFixed, { gap: GAP, height: cellH }]}>
                  {Array.from({ length: cols }, (_, colIndex) => {
                    const i = rowIndex * cols + colIndex;
                    const edificio = edificiInMappa[i];
                    const emoji = edificio?.emoji ?? null;
                    const èStrada = edificio?.nome === "Strada";
                    const mostraEmoji = !!edificio && !èStrada && emoji;
                    return (
                      <View key={i} style={[styles.cella, { width: cellW, height: cellH }]}>
                        {mostraEmoji ? (
                          <Text
                            style={[
                              styles.edificioEmoji,
                              { fontSize: Math.max(10, Math.min(22, CELL_SIZE_PX - 4)) }
                            ]}
                          >
                            {emoji}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
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
    minHeight: 0,
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
    minHeight: 0,
    width: "100%",
    backgroundColor: "#000000",
    overflow: "hidden",
    position: "relative",
    ...(Platform.OS === "web" ? { display: "flex" as const } : {})
  },
  viewportCenterWrap: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    ...(Platform.OS === "web" ? { display: "flex" as const } : {})
  },
  gridFill: {
    flex: 1,
    width: "100%",
    height: "100%"
  },
  gridFillFixed: {
    flexDirection: "column",
    flex: 0,
    gap: GAP
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
  cellaStretch: {
    flex: 1,
    minWidth: 0,
    minHeight: 0
  },
  viewportTouchAction: {
    ...(Platform.OS === "web" ? { touchAction: "none" as const } : {})
  },
  viewportPointerEvents: {
    pointerEvents: "auto"
  },
  viewportWeb: {
    cursor: "grab"
  },
  viewportWebGrabbing: {
    cursor: "grabbing"
  },
  mapTransform: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 1
  },
  mapTransformWeb: {
    transformOrigin: "top left",
    willChange: "transform",
    ...(Platform.OS === "web" ? { display: "block" as const } : {})
  },
  viewportInner: {
    flex: 1
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
  cellaErba: {
    backgroundColor: "#3d7c47"
  },
  cellaAcqua: {
    backgroundColor: "#2c5282"
  },
  cellaFiume: {
    backgroundColor: "#0ea5e9"
  },
  cellaSabbia: {
    backgroundColor: "#ca8a04"
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
  }
});

/** Route /mappa reindirizza alla root: la Mappa è la schermata principale. */
export default function MappaRoute() {
  return <Redirect href="/" />;
}
