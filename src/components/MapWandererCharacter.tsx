import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

const DOPPIO_TAP_MS = 400;

const CHARACTER_SHEET = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/character.png");

/** Nel foglio ogni frame è 64×64 px; 12 frame in fila (Sud, NE, Nord, SE). */
const FRAME_PX = 64;
const FRAMES = 12;

/** Spostamento tra celle: durata e pausa prima del prossimo passo. */
const MOVE_DURATION_MS = 620;
const IDLE_BEFORE_NEXT_MS = 2200;

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

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

type MapWandererCharacterProps = {
  cols: number;
  rows: number;
  cellSizePx: number;
  isWalkable: (cellIndex: number) => boolean;
  /** Per più personaggi sulla stessa mappa: spawn e z-index distinti. */
  instanceId?: number;
  /**
   * Se impostato, il personaggio resta fermo su quella cella (idle), senza camminare.
   * Usato di notte sulla cella della residenza; z-index sotto gli edifici per effetto “dentro casa”.
   */
  fixedCell?: number | null;
  /** Doppio tocco: apre la scheda abitante (mappa). */
  onDoublePress?: () => void;
  /** Etichetta accessibilità per il target tocco (es. nome abitante). */
  doubleTapAccessibilityLabel?: string;
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
  instanceId = 0,
  fixedCell = null,
  onDoublePress,
  doubleTapAccessibilityLabel
}: MapWandererCharacterProps) {
  const [logicalCell, setLogicalCell] = useState<number | null>(null);
  const cellRef = useRef<number | null>(null);
  const [pixelPos, setPixelPos] = useState({ x: 0, y: 0 });
  const [direction, setDirection] = useState<WanderDirection>("s");
  const [walkFrame, setWalkFrame] = useState(0);
  const [isMoving, setIsMoving] = useState(false);

  const inited = useRef(false);
  const prevFixedCellRef = useRef<number | null | undefined>(undefined);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef(0);

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

  const clearIdle = useCallback(() => {
    if (idleTimerRef.current != null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const pickNextMove = useCallback(() => {
    if (fixedCell != null) return;
    const prev = cellRef.current;
    if (prev === null) return;

    const cand = orthogonalNeighbors(prev, cols, rows).filter((j) => isWalkable(j));
    if (cand.length === 0) {
      idleTimerRef.current = setTimeout(pickNextMove, IDLE_BEFORE_NEXT_MS);
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

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / MOVE_DURATION_MS);
      const e = easeInOutCubic(t);
      setPixelPos({
        x: fromX + (toX - fromX) * e,
        y: fromY + (toY - fromY) * e
      });
      if (t < 1) {
        setWalkFrame(Math.min(2, Math.floor(e * 2.99)));
        rafRef.current = requestAnimationFrame(step);
      } else {
        setPixelPos({ x: toX, y: toY });
        setWalkFrame(0);
        setIsMoving(false);
        setLogicalCell(next);
        cellRef.current = next;
        idleTimerRef.current = setTimeout(pickNextMove, IDLE_BEFORE_NEXT_MS);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [cols, rows, cellSizePx, isWalkable, fixedCell]);

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
    idleTimerRef.current = setTimeout(pickNextMove, IDLE_BEFORE_NEXT_MS);
  }, [cols, rows, isWalkable, instanceId, pickNextMove, fixedCell]);

  useEffect(
    () => () => {
      clearIdle();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [clearIdle]
  );

  if (logicalCell === null) return null;

  const group = frameGroupStart(direction);
  const frameInGroup = walkIndexInGroup(direction, walkFrame, isMoving);
  const frameIndex = Math.min(group + frameInGroup, FRAMES - 1);

  const flipW = direction === "w";

  /** Larghezza = una cella; altezza maggiore (nessun allargamento orizzontale). */
  const frameW = cellSizePx;
  const frameH = cellSizePx * 1.22;
  const sheetW = FRAMES * frameW;
  const sheetH = frameH;
  const offsetX = -frameIndex * frameW;

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

  const sprite = (
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

  if (onDoublePress) {
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
  }
});
