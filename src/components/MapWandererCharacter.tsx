import React, { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

const CHARACTER_SHEET = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/character.png");

/** Nel foglio ogni frame è 64×64 px; 12 frame in fila (Sud, NE, Nord, SE). */
const FRAME_PX = 64;
const FRAMES = 12;

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

/** Indice base (0,3,6,9) del gruppo direzione nello sheet. */
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

export function useMapRandomWanderer(options: {
  cols: number;
  rows: number;
  isWalkable: (cellIndex: number) => boolean;
  moveIntervalMs?: number;
  animIntervalMs?: number;
}): {
  cellIndex: number | null;
  direction: WanderDirection;
  walkPhase: number;
} {
  const { cols, rows, isWalkable, moveIntervalMs = 900, animIntervalMs = 200 } = options;
  const [cellIndex, setCellIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState<WanderDirection>("s");
  const [walkPhase, setWalkPhase] = useState(0);
  const inited = useRef(false);

  useEffect(() => {
    if (inited.current) return;
    const ok: number[] = [];
    const tot = cols * rows;
    for (let i = 0; i < tot; i++) {
      if (isWalkable(i)) ok.push(i);
    }
    if (ok.length === 0) return;
    inited.current = true;
    setCellIndex(ok[Math.floor(Math.random() * ok.length)]!);
  }, [cols, rows, isWalkable]);

  useEffect(() => {
    if (cellIndex === null) return;
    const t = setInterval(() => setWalkPhase((p) => (p + 1) % 3), animIntervalMs);
    return () => clearInterval(t);
  }, [cellIndex, animIntervalMs]);

  useEffect(() => {
    if (cellIndex === null) return;
    const t = setInterval(() => {
      setCellIndex((prev) => {
        if (prev === null) return prev;
        const cand = orthogonalNeighbors(prev, cols, rows).filter((j) => isWalkable(j));
        if (cand.length === 0) return prev;
        const next = cand[Math.floor(Math.random() * cand.length)]!;
        setDirection(directionBetween(prev, next, cols));
        return next;
      });
    }, moveIntervalMs);
    return () => clearInterval(t);
  }, [cellIndex, cols, rows, isWalkable, moveIntervalMs]);

  return { cellIndex, direction, walkPhase };
}

type MapWandererCharacterProps = {
  cellIndex: number;
  cols: number;
  cellSizePx: number;
  direction: WanderDirection;
  walkPhase: number;
};

/**
 * Personaggio dallo sheet `character.png`, centrato sulla cella, animazione camminata 3 frame.
 */
export function MapWandererCharacter({
  cellIndex,
  cols,
  cellSizePx,
  direction,
  walkPhase
}: MapWandererCharacterProps) {
  const col = cellIndex % cols;
  const row = Math.floor(cellIndex / cols);
  const left = col * cellSizePx;
  const top = row * cellSizePx;

  const group = frameGroupStart(direction);
  const frameIndex = Math.min(group + (walkPhase % 3), FRAMES - 1);
  const scale = cellSizePx / FRAME_PX;
  const sheetW = FRAMES * FRAME_PX * scale;
  const sheetH = FRAME_PX * scale;
  const offsetX = -frameIndex * FRAME_PX * scale;

  const flipW = direction === "w";

  return (
    <View
      style={[
        styles.anchor,
        {
          left,
          top,
          width: cellSizePx,
          height: cellSizePx
        }
      ]}
      pointerEvents="none"
    >
      <View
        style={[
          styles.clip,
          { width: cellSizePx, height: cellSizePx },
          flipW && { transform: [{ scaleX: -1 }] }
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
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  clip: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center"
  }
});
