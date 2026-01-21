import { useState, useEffect, useRef } from "react";
import type { Character, Point, Building, Placed } from "../types";
import { GRID_SIZE } from "../constants";
import { isRiver, isSea } from "./terrain";

type UseCharacterMovementOptions = {
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  buildings: Building[];
  trees: Placed[];
  riverCells: number[];
};

// Controlla se una posizione è bloccata
function isBlocked(
  x: number,
  y: number,
  buildings: Building[],
  trees: Placed[],
  riverCells: number[]
): boolean {
  // Non può essere fuori dalla griglia
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return true;

  // Non può essere nel mare
  if (isSea(x, y)) return true;

  // Non può essere nel fiume
  if (isRiver(x, y, riverCells)) return true;

  // Non può essere su un albero
  if (trees.some(t => t.x === x && t.y === y)) return true;

  // Non può essere dentro un edificio
  for (const building of buildings) {
    if (
      x >= building.x &&
      x < building.x + building.width &&
      y >= building.y &&
      y < building.y + building.height
    ) {
      return true;
    }
  }

  // Può essere su erba o spiaggia
  return false;
}

// Trova un percorso semplice usando A* semplificato
function findPath(
  start: Point,
  target: Point,
  buildings: Building[],
  trees: Placed[],
  riverCells: number[]
): Point[] | null {
  if (isBlocked(target.x, target.y, buildings, trees, riverCells)) {
    return null;
  }

  const queue: Array<{ p: Point; path: Point[] }> = [{ p: start, path: [] }];
  const visited = new Set<string>();
  const dirs = [
    { x: 0, y: -1 }, // su
    { x: 0, y: 1 },  // giù
    { x: -1, y: 0 }, // sinistra
    { x: 1, y: 0 }   // destra
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = `${current.p.x},${current.p.y}`;

    if (visited.has(key)) continue;
    visited.add(key);

    // Se siamo arrivati alla destinazione
    if (current.p.x === target.x && current.p.y === target.y) {
      return [...current.path, current.p];
    }

    // Esplora le direzioni vicine
    for (const dir of dirs) {
      const next: Point = { x: current.p.x + dir.x, y: current.p.y + dir.y };
      const nextKey = `${next.x},${next.y}`;

      if (visited.has(nextKey)) continue;
      if (isBlocked(next.x, next.y, buildings, trees, riverCells)) continue;

      queue.push({ p: next, path: [...current.path, current.p] });
    }
  }

  return null; // Nessun percorso trovato
}

export function useCharacterMovement({
  characters,
  setCharacters,
  buildings,
  trees,
  riverCells
}: UseCharacterMovementOptions) {
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      const deltaTime = Math.min((now - lastUpdateRef.current) / 1000, 0.1); // Max 100ms
      lastUpdateRef.current = now;

      setCharacters((prevChars) => {
        return prevChars.map((char) => {
          // Se è già alla destinazione, non fare nulla
          if (char.x === char.targetX && char.y === char.targetY) {
            return char;
          }

          // Calcola la direzione verso la destinazione
          const dx = char.targetX - char.x;
          const dy = char.targetY - char.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 0.1) {
            // Siamo arrivati
            return { ...char, x: char.targetX, y: char.targetY };
          }

          // Movimento verso la destinazione
          const speed = 2.0; // celle al secondo
          const moveX = (dx / distance) * speed * deltaTime;
          const moveY = (dy / distance) * speed * deltaTime;

          let newX = char.x + moveX;
          let newY = char.y + moveY;

          // Clamp alle coordinate finali
          if (Math.abs(dx) < Math.abs(moveX)) {
            newX = char.targetX;
          }
          if (Math.abs(dy) < Math.abs(moveY)) {
            newY = char.targetY;
          }

          // Clamp dentro la griglia
          newX = Math.max(0, Math.min(GRID_SIZE - 1, newX));
          newY = Math.max(0, Math.min(GRID_SIZE - 1, newY));

          return { ...char, x: newX, y: newY };
        });
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [setCharacters]);

  const moveCharacter = (characterId: number, targetX: number, targetY: number) => {
    setCharacters((prevChars) => {
      return prevChars.map((char) => {
        if (char.id !== characterId) return char;

        // Controlla se la destinazione è valida
        if (isBlocked(targetX, targetY, buildings, trees, riverCells)) {
          return char; // Non muovere se bloccato
        }

        // Trova un percorso
        const path = findPath(
          { x: Math.round(char.x), y: Math.round(char.y) },
          { x: targetX, y: targetY },
          buildings,
          trees,
          riverCells
        );

        if (!path || path.length === 0) {
          return char; // Nessun percorso trovato
        }

        // Imposta la destinazione
        return {
          ...char,
          targetX,
          targetY
        };
      });
    });
  };

  return { moveCharacter };
}
