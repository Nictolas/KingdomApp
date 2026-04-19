import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

const CHARACTER_SHEET = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/character.png");

/** Nel foglio ogni frame è 64×64 px; 12 frame in fila (Sud, NE, Nord, SE). */
const FRAME_PX = 64;
const FRAMES = 12;

const MOVE_DURATION_MS = 380;
const IDLE_BEFORE_NEXT_MS = 520;

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
      return 9;
    default:
      return 0;
  }
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

type MapWandererCharacterProps = {
  cols: number;
  rows: number;
  cellSizePx: number;
  isWalkable: (cellIndex: number) => boolean;
};

/**
 * Personaggio da `character.png`: spostamento fluido tra celle, camminata solo durante il movimento,
 * idle sul primo frame a riposo; sprite più alto della cella, piedi sulla casella.
 */
export function MapWandererCharacter({ cols, rows, cellSizePx, isWalkable }: MapWandererCharacterProps) {
  const [logicalCell, setLogicalCell] = useState<number | null>(null);
  const cellRef = useRef<number | null>(null);
  const [pixelPos, setPixelPos] = useState({ x: 0, y: 0 });
  const [direction, setDirection] = useState<WanderDirection>("s");
  const [walkFrame, setWalkFrame] = useState(0);
  const [isMoving, setIsMoving] = useState(false);

  const inited = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

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
      const e = easeInOutQuad(t);
      setPixelPos({
        x: fromX + (toX - fromX) * e,
        y: fromY + (toY - fromY) * e
      });
      if (t < 1) {
        setWalkFrame(Math.min(2, Math.floor(t * 3)));
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
  }, [cols, rows, cellSizePx, isWalkable]);

  useEffect(() => {
    if (inited.current) return;
    const ok: number[] = [];
    const tot = cols * rows;
    for (let i = 0; i < tot; i++) {
      if (isWalkable(i)) ok.push(i);
    }
    if (ok.length === 0) return;
    inited.current = true;
    const idx = ok[Math.floor(Math.random() * ok.length)]!;
    const cx = (idx % cols) * cellSizePx;
    const cy = Math.floor(idx / cols) * cellSizePx;
    setLogicalCell(idx);
    cellRef.current = idx;
    setPixelPos({ x: cx, y: cy });
    idleTimerRef.current = setTimeout(pickNextMove, IDLE_BEFORE_NEXT_MS);
  }, [cols, rows, isWalkable, pickNextMove]);

  useEffect(
    () => () => {
      clearIdle();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [clearIdle]
  );

  if (logicalCell === null) return null;

  const group = frameGroupStart(direction);
  const frameInGroup = isMoving ? walkFrame % 3 : 0;
  const frameIndex = Math.min(group + frameInGroup, FRAMES - 1);

  const flipW = direction === "w";

  const spriteH = cellSizePx * 1.22;
  const spriteW = spriteH;
  const scale = spriteH / FRAME_PX;
  const sheetW = FRAMES * FRAME_PX * scale;
  const sheetH = FRAME_PX * scale;
  const offsetX = -frameIndex * FRAME_PX * scale;

  return (
    <View
      style={[
        styles.anchor,
        {
          left: pixelPos.x,
          top: pixelPos.y,
          width: cellSizePx,
          height: cellSizePx,
          overflow: "visible"
        }
      ]}
      pointerEvents="none"
    >
      <View style={[styles.spriteColumn, { height: cellSizePx, width: cellSizePx }]}>
        <View
          style={[
            styles.clip,
            {
              width: spriteW,
              height: spriteH,
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
