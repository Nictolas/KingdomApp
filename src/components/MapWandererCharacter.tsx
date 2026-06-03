import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { getOrologioGiocoInPausaSnapshot } from "../game/orologioGiocoSession";
import { useGiocoInPausa } from "../hooks/useGiocoInPausa";

const DOPPIO_TAP_MS = 400;

const CHARACTER_SHEET = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/character.png");

/** Nel foglio ogni frame è 64×64 px; 12 frame in fila (Sud, NE, Nord, SE). */
const FRAME_PX = 64;
const FRAMES = 12;

/** Spostamento tra celle: durata e pausa prima del prossimo passo. */
const MOVE_DURATION_MS = 560;
const MOVE_DURATION_ROAD_MS = 340;
const IDLE_BEFORE_NEXT_MS = 2200;

function segmentMoveDurationMs(
  from: number,
  to: number,
  isRoadCell?: (cellIndex: number) => boolean
): number {
  if (isRoadCell?.(from) || isRoadCell?.(to)) return MOVE_DURATION_ROAD_MS;
  return MOVE_DURATION_MS;
}

export type WanderDirection = "n" | "s" | "e" | "w";

function orthogonalNeighbors(index: number, cols: number, rows: number): number[] {
  const c = index % cols;
  const r = Math.floor(index / cols);
  const out: number[] = [];
  if (c > 0) out.push(index - 1);
  if (c < cols - 1) out.push(index + 1);
  if (r > 0) out.push(index - cols);
  if (r < rows - 1) out.push(index + cols);
  return out;
}

function directionBetween(from: number, to: number, cols: number): WanderDirection {
  if (to === from + 1) return "e";
  if (to === from - 1) return "w";
  if (to === from - cols) return "n";
  if (to === from + cols) return "s";
  return "s";
}

function frameGroupStart(dir: WanderDirection): number {
  switch (dir) {
    case "s":
      return 0;
    case "n":
      return 6;
    case "e":
    case "w":
      /**
       * Gruppo NE (3–5): movimento E/O su griglia; il gruppo SE (9–11) è pensato per diagonale
       * e spesso dà sensazione di moonwalk su spostamento solo orizzontale.
       */
      return 3;
    default:
      return 0;
  }
}

/**
 * Ordine dei 3 frame nel gruppo SE (9–11): camminata “in avanti” sullo sheet = 0→1→2.
 * - Est: ordine normale (coerente con lo spostamento a destra).
 * - Ovest: stesso gruppo + flip orizzontale → per non avere moonwalk serve ciclo invertito 2→1→0.
 */
function walkIndexInGroup(direction: WanderDirection, walkFrame: number, isMoving: boolean): number {
  if (!isMoving) return 0;
  const k = Math.min(2, walkFrame % 3);
  if (direction === "w") return 2 - k;
  return k;
}

/** Frame camminata (0–2) sincronizzati sul tempo lineare: ritmo costante, non sull’easing della posizione. */
function walkFrameFromLinearMoveT(t: number): number {
  if (t >= 1) return 0;
  return Math.min(2, Math.floor(t * 3));
}

type MapWandererCharacterProps = {
  cols: number;
  rows: number;
  cellSizePx: number;
  isWalkable: (cellIndex: number) => boolean;
  /** Se la cella è strada, il passo tra celle adiacenti è più rapido. */
  isRoadCell?: (cellIndex: number) => boolean;
  /** Per più personaggi sulla stessa mappa: spawn e z-index distinti. */
  instanceId?: number;
  /**
   * Se impostato, il personaggio resta fermo su quella cella (idle), senza camminare.
   * Usato di notte sulla cella della residenza; z-index sotto gli edifici per effetto “dentro casa”.
   */
  fixedCell?: number | null;
  /**
   * Percorso determinato (celle inclusive). Se length ≥ 2, ha priorità su girovago e fixedCell.
   * Il genitore incrementa `commuteToken` per forzare un nuovo run con lo stesso path se serve.
   */
  commutePath?: number[] | null;
  commuteToken?: number;
  commutePurpose?: "work" | "bar" | "home" | "mensa" | null;
  onCommuteComplete?: (purpose: "work" | "bar" | "home" | "mensa") => void;
  /** Chiamato quando il personaggio “arriva” su una cella (fine passo o snap). */
  onCellSettled?: (cellIndex: number) => void;
  /** Doppio tocco: apre la scheda abitante (mappa). */
  onDoublePress?: () => void;
  /**
   * Se true per la cella corrente, il personaggio non intercetta i tocchi: passano alla griglia sotto
   * (es. doppio tap sulla residenza → elenco in casa invece della scheda abitante).
   */
  passTouchesToMapOnCell?: (cellIndex: number) => boolean;
  /** Se true, niente passeggio casuale tra le celle (solo percorsi commute / notte in casa). */
  disableIdleRoam?: boolean;
  /** Etichetta accessibilità per il target tocco (es. nome abitante). */
  doubleTapAccessibilityLabel?: string;
  /** Se impostata, mostra questa emoji al posto dello sprite RPG (es. Robot 🤖). */
  markerEmoji?: string | null;
};

/**
 * Personaggio da `character.png`: spostamento fluido tra celle, camminata solo durante il movimento,
 * idle sul primo frame a riposo; sprite più alto della cella, piedi sulla casella.
 */
export function MapWandererCharacter({
  cols,
  rows,
  cellSizePx,
  isWalkable,
  isRoadCell,
  instanceId = 0,
  fixedCell = null,
  commutePath = null,
  commuteToken = 0,
  commutePurpose = null,
  onCommuteComplete,
  onCellSettled,
  onDoublePress,
  passTouchesToMapOnCell,
  disableIdleRoam = false,
  doubleTapAccessibilityLabel,
  markerEmoji = null
}: MapWandererCharacterProps) {
  const [logicalCell, setLogicalCell] = useState<number | null>(null);
  const cellRef = useRef<number | null>(null);
  const [pixelPos, setPixelPos] = useState({ x: 0, y: 0 });
  const [direction, setDirection] = useState<WanderDirection>("s");
  const [walkFrame, setWalkFrame] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const giocoInPausa = useGiocoInPausa();

  const inited = useRef(false);
  const isMovingRef = useRef(false);
  const prevGiocoInPausaRef = useRef(giocoInPausa);
  const prevFixedCellRef = useRef<number | null | undefined>(undefined);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef(0);
  /** Evita di rieseguire effetti a ogni render (es. tick orologio sul genitore → callback nuove). */
  const onCommuteCompleteRef = useRef(onCommuteComplete);
  const onCellSettledRef = useRef(onCellSettled);
  const pickNextMoveRef = useRef<() => void>(() => {});
  onCommuteCompleteRef.current = onCommuteComplete;
  onCellSettledRef.current = onCellSettled;

  const handlePress = useCallback(() => {
    if (!onDoublePress) return;
    const now = Date.now();
    if (lastTapTimeRef.current > 0 && now - lastTapTimeRef.current < DOPPIO_TAP_MS) {
      lastTapTimeRef.current = 0;
      onDoublePress();
    } else {
      lastTapTimeRef.current = now;
    }
  }, [onDoublePress]);

  useEffect(() => {
    cellRef.current = logicalCell;
  }, [logicalCell]);

  useEffect(() => {
    isMovingRef.current = isMoving;
  }, [isMoving]);

  const clearIdle = useCallback(() => {
    if (idleTimerRef.current != null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const pickNextMove = useCallback(() => {
    if (getOrologioGiocoInPausaSnapshot()) return;
    if (disableIdleRoam) return;
    if (fixedCell != null) return;
    if (commutePath != null && commutePath.length >= 2) return;
    const prev = cellRef.current;
    if (prev === null) return;

    const cand = orthogonalNeighbors(prev, cols, rows).filter((j) => isWalkable(j));
    if (cand.length === 0) {
      idleTimerRef.current = setTimeout(() => pickNextMoveRef.current(), IDLE_BEFORE_NEXT_MS);
      return;
    }

    const next = cand[Math.floor(Math.random() * cand.length)]!;
    setDirection(directionBetween(prev, next, cols));

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const fromX = (prev % cols) * cellSizePx;
    const fromY = Math.floor(prev / cols) * cellSizePx;
    const toX = (next % cols) * cellSizePx;
    const toY = Math.floor(next / cols) * cellSizePx;

    setIsMoving(true);
    const start = performance.now();
    const durationMs = segmentMoveDurationMs(prev, next, isRoadCell);

    const step = (now: number) => {
      if (getOrologioGiocoInPausaSnapshot()) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      const t = Math.min(1, (now - start) / durationMs);
      setPixelPos({
        x: fromX + (toX - fromX) * t,
        y: fromY + (toY - fromY) * t
      });
      if (t < 1) {
        setWalkFrame(walkFrameFromLinearMoveT(t));
        rafRef.current = requestAnimationFrame(step);
      } else {
        setPixelPos({ x: toX, y: toY });
        setWalkFrame(0);
        setIsMoving(false);
        setLogicalCell(next);
        cellRef.current = next;
        idleTimerRef.current = setTimeout(() => pickNextMoveRef.current(), IDLE_BEFORE_NEXT_MS);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [cols, rows, cellSizePx, isWalkable, isRoadCell, fixedCell, commutePath, disableIdleRoam]);

  pickNextMoveRef.current = pickNextMove;

  const runOneSegment = useCallback(
    (from: number, to: number, onDone: () => void, isLastSegment: boolean) => {
      setDirection(directionBetween(from, to, cols));
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const fromX = (from % cols) * cellSizePx;
      const fromY = Math.floor(from / cols) * cellSizePx;
      const toX = (to % cols) * cellSizePx;
      const toY = Math.floor(to / cols) * cellSizePx;
      setIsMoving(true);
      const start = performance.now();
      const durationMs = segmentMoveDurationMs(from, to, isRoadCell);
      const step = (now: number) => {
        if (getOrologioGiocoInPausaSnapshot()) {
          rafRef.current = requestAnimationFrame(step);
          return;
        }
        const t = Math.min(1, (now - start) / durationMs);
        setPixelPos({
          x: fromX + (toX - fromX) * t,
          y: fromY + (toY - fromY) * t
        });
        if (t < 1) {
          setWalkFrame(walkFrameFromLinearMoveT(t));
          rafRef.current = requestAnimationFrame(step);
        } else {
          setPixelPos({ x: toX, y: toY });
          setWalkFrame(0);
          if (isLastSegment) {
            setIsMoving(false);
          }
          setLogicalCell(to);
          cellRef.current = to;
          onCellSettledRef.current?.(to);
          onDone();
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [cols, cellSizePx, isRoadCell]
  );

  /** Percorso casa → lavoro / lavoro → casa / … */
  useEffect(() => {
    if (!commutePath || commutePath.length < 2) return;
    let alive = true;
    clearIdle();
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    inited.current = true;
    const path = commutePath;
    const start = path[0]!;
    const cx = (start % cols) * cellSizePx;
    const cy = Math.floor(start / cols) * cellSizePx;
    setLogicalCell(start);
    cellRef.current = start;
    setPixelPos({ x: cx, y: cy });
    setIsMoving(false);
    setWalkFrame(0);
    onCellSettledRef.current?.(start);

    let seg = 0;
    const stepChain = () => {
      if (!alive) return;
      if (seg >= path.length - 1) {
        if (commutePurpose != null) onCommuteCompleteRef.current?.(commutePurpose);
        idleTimerRef.current = setTimeout(() => pickNextMoveRef.current(), IDLE_BEFORE_NEXT_MS);
        return;
      }
      const from = path[seg]!;
      const to = path[seg + 1]!;
      const isLastSegment = seg + 1 >= path.length - 1;
      seg++;
      runOneSegment(from, to, stepChain, isLastSegment);
    };
    stepChain();
    return () => {
      alive = false;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      clearIdle();
    };
  }, [
    commutePath,
    commuteToken,
    commutePurpose,
    cols,
    cellSizePx,
    clearIdle,
    runOneSegment
  ]);

  /** Di notte sulla residenza: fermo, sotto il layer edifici. */
  useEffect(() => {
    if (fixedCell == null) return;
    clearIdle();
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    inited.current = true;
    const cx = (fixedCell % cols) * cellSizePx;
    const cy = Math.floor(fixedCell / cols) * cellSizePx;
    setLogicalCell(fixedCell);
    cellRef.current = fixedCell;
    setPixelPos({ x: cx, y: cy });
    setIsMoving(false);
    setWalkFrame(0);
    setDirection("s");
    onCellSettledRef.current?.(fixedCell);
  }, [fixedCell, cols, cellSizePx, clearIdle]);

  /** Fine notte in casa → ripristina il girovago (re-inizializza spawn su strade). */
  useEffect(() => {
    if (fixedCell != null) {
      prevFixedCellRef.current = fixedCell;
      return;
    }
    if (prevFixedCellRef.current != null) {
      clearIdle();
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      inited.current = false;
    }
    prevFixedCellRef.current = fixedCell;
  }, [fixedCell, clearIdle]);

  useEffect(() => {
    if (commutePath != null && commutePath.length >= 2) return;
    if (fixedCell != null) return;
    if (inited.current) return;
    const ok: number[] = [];
    const tot = cols * rows;
    for (let i = 0; i < tot; i++) {
      if (isWalkable(i)) ok.push(i);
    }
    if (ok.length === 0) return;
    inited.current = true;
    const idx = ok[(instanceId * 9973) % ok.length]!;
    const cx = (idx % cols) * cellSizePx;
    const cy = Math.floor(idx / cols) * cellSizePx;
    setLogicalCell(idx);
    cellRef.current = idx;
    setPixelPos({ x: cx, y: cy });
    onCellSettledRef.current?.(idx);
    if (!disableIdleRoam) {
      idleTimerRef.current = setTimeout(() => pickNextMoveRef.current(), IDLE_BEFORE_NEXT_MS);
    }
  }, [cols, rows, isWalkable, instanceId, fixedCell, commutePath, disableIdleRoam]);

  /** Pausa globale: ferma timer idle; al ripristino riprende girovago se fermo. */
  useEffect(() => {
    if (prevGiocoInPausaRef.current === giocoInPausa) return;
    prevGiocoInPausaRef.current = giocoInPausa;
    if (giocoInPausa) {
      clearIdle();
      return;
    }
    if (fixedCell != null) return;
    if (commutePath != null && commutePath.length >= 2) return;
    if (disableIdleRoam) return;
    if (cellRef.current == null || !inited.current) return;
    if (isMovingRef.current) return;
    clearIdle();
    idleTimerRef.current = setTimeout(() => pickNextMoveRef.current(), IDLE_BEFORE_NEXT_MS);
  }, [giocoInPausa, fixedCell, commutePath, disableIdleRoam, clearIdle]);

  useEffect(
    () => () => {
      clearIdle();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [clearIdle]
  );

  if (logicalCell === null) return null;

  const passTouchesToGrid =
    passTouchesToMapOnCell != null && passTouchesToMapOnCell(logicalCell) === true;
  const apriSchedaConDoppioTap = !!onDoublePress && !passTouchesToGrid;

  const shellStyle = [
    styles.anchor,
    {
      left: pixelPos.x,
      top: pixelPos.y,
      width: cellSizePx,
      height: cellSizePx,
      overflow: "visible" as const,
      zIndex: fixedCell != null ? 1 : 10 + instanceId
    }
  ];

  const usaEmojiMarker = markerEmoji != null && markerEmoji !== "";

  const group = frameGroupStart(direction);
  const frameInGroup = walkIndexInGroup(direction, walkFrame, isMoving);
  const frameIndex = Math.min(group + frameInGroup, FRAMES - 1);
  const flipW = direction === "w";
  const frameW = cellSizePx;
  const frameH = cellSizePx * 1.22;
  const sheetW = FRAMES * frameW;
  const sheetH = frameH;
  const offsetX = -frameIndex * frameW;

  const sprite = usaEmojiMarker ? (
    <View style={[styles.spriteColumn, { height: cellSizePx, width: cellSizePx }]}>
      <Text style={[styles.markerEmoji, { fontSize: cellSizePx * 0.72 }]}>{markerEmoji}</Text>
    </View>
  ) : (
    <View style={[styles.spriteColumn, { height: cellSizePx, width: cellSizePx }]}>
      <View
        style={[
          styles.clip,
          {
            width: frameW,
            height: frameH,
            transform: flipW ? [{ scaleX: -1 }] : undefined
          }
        ]}
      >
        <Image
          source={CHARACTER_SHEET}
          resizeMode="stretch"
          style={{
            position: "absolute",
            width: sheetW,
            height: sheetH,
            left: offsetX,
            top: 0
          }}
        />
      </View>
    </View>
  );

  if (apriSchedaConDoppioTap) {
    return (
      <Pressable
        style={shellStyle}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={doubleTapAccessibilityLabel ?? "Apri scheda abitante"}
      >
        {sprite}
      </Pressable>
    );
  }

  return (
    <View style={shellStyle} pointerEvents="none">
      {sprite}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    zIndex: 10
  },
  spriteColumn: {
    alignItems: "center",
    justifyContent: "flex-end"
  },
  clip: {
    overflow: "hidden"
  },
  markerEmoji: {
    textAlign: "center",
    lineHeight: undefined
  }
});
