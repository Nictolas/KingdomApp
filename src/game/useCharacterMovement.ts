import { useState, useEffect, useRef } from "react";
import type { Character, Point, Building, Placed } from "../types";
import { GRID_SIZE } from "../constants";
import { isRiver, isSea } from "./terrain";
import type { GameTime } from "./gameClock";

type UseCharacterMovementOptions = {
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  buildings: Building[];
  trees: Placed[];
  riverCells: number[];
  gameTime: GameTime;
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
      if (isRiver(next.x, next.y, riverCells)) continue; // Non può passare attraverso il fiume

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
  riverCells,
  gameTime
}: UseCharacterMovementOptions) {
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());
  const lastRandomMoveRef = useRef<Map<number, number>>(new Map());

  // Trova il Bar tra gli edifici
  const barBuilding = buildings.find(b => b.type === "bar");
  
  // Controlla se è ora di andare al Bar (8:00 - 18:00)
  const isBarTime = () => {
    const currentHour = gameTime.hours;
    return currentHour >= 8 && currentHour < 18;
  };

  // Controlla se due personaggi sono nel raggio 5x5
  const isInRange = (char1: Character, char2: Character): boolean => {
    const dx = Math.abs(char1.x - char2.x);
    const dy = Math.abs(char1.y - char2.y);
    return dx <= 2.5 && dy <= 2.5; // Raggio 5x5 = 2.5 celle in ogni direzione
  };

  // Trova il personaggio più vicino nel raggio
  const findNearestInRange = (char: Character, allChars: Character[], isTarget: (c: Character) => boolean): Character | null => {
    let nearest: Character | null = null;
    let minDistance = Infinity;

    for (const other of allChars) {
      if (other.id === char.id) continue;
      if (!isTarget(other)) continue;
      if (!isInRange(char, other)) continue;

      const dx = char.x - other.x;
      const dy = char.y - other.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < minDistance) {
        minDistance = distance;
        nearest = other;
      }
    }

    return nearest;
  };

  // Genera una posizione casuale valida (non sul fiume)
  const getRandomValidPosition = (): Point | null => {
    const maxAttempts = 50;
    for (let i = 0; i < maxAttempts; i++) {
      const x = Math.floor(Math.random() * GRID_SIZE);
      const y = Math.floor(Math.random() * GRID_SIZE);
      
      if (!isBlocked(x, y, buildings, trees, riverCells) && !isRiver(x, y, riverCells)) {
        return { x, y };
      }
    }
    return null;
  };

  // Ottiene una destinazione per il personaggio (Bar se è l'ora giusta, altrimenti casuale)
  const getDestination = (char: Character, allChars: Character[]): Point | null => {
    const isOrc = char.profession === "Orco";
    const isInhabitant = char.profession !== "Orco";

    // Logica per l'Orco: insegue gli Abitanti
    if (isOrc) {
      const target = findNearestInRange(char, allChars, (c) => c.profession !== "Orco");
      if (target) {
        // Insegue il target
        const targetX = Math.round(target.x);
        const targetY = Math.round(target.y);
        
        // Prova posizioni vicine al target per catturarlo
        const nearbyPositions = [
          { x: targetX - 1, y: targetY },
          { x: targetX + 1, y: targetY },
          { x: targetX, y: targetY - 1 },
          { x: targetX, y: targetY + 1 },
          { x: targetX - 1, y: targetY - 1 },
          { x: targetX + 1, y: targetY + 1 },
          { x: targetX - 1, y: targetY + 1 },
          { x: targetX + 1, y: targetY - 1 }
        ];

        for (const pos of nearbyPositions) {
          if (!isBlocked(pos.x, pos.y, buildings, trees, riverCells) && !isRiver(pos.x, pos.y, riverCells)) {
            return pos;
          }
        }

        // Se non trova posizioni vicine, prova il target stesso (se non è bloccato)
        if (!isBlocked(targetX, targetY, buildings, trees, riverCells) && !isRiver(targetX, targetY, riverCells)) {
          return { x: targetX, y: targetY };
        }
      }
    }

    // Logica per gli Abitanti: scappano dall'Orco
    if (isInhabitant) {
      const orc = findNearestInRange(char, allChars, (c) => c.profession === "Orco");
      if (orc) {
        // Scappa nella direzione opposta all'Orco
        const dx = char.x - orc.x;
        const dy = char.y - orc.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0.1) {
          // Calcola direzione di fuga (opposta all'Orco)
          const escapeX = Math.round(char.x + (dx / distance) * 3);
          const escapeY = Math.round(char.y + (dy / distance) * 3);
          
          // Prova posizioni nella direzione di fuga
          const escapePositions = [
            { x: escapeX, y: escapeY },
            { x: escapeX - 1, y: escapeY },
            { x: escapeX + 1, y: escapeY },
            { x: escapeX, y: escapeY - 1 },
            { x: escapeX, y: escapeY + 1 },
            { x: Math.round(char.x + dx / distance), y: Math.round(char.y + dy / distance) }
          ];

          for (const pos of escapePositions) {
            if (!isBlocked(pos.x, pos.y, buildings, trees, riverCells) && !isRiver(pos.x, pos.y, riverCells)) {
              return pos;
            }
          }
        }
      }
    }

    // Se è l'ora del Bar e il Bar esiste, vai al Bar (solo per Abitanti)
    if (isInhabitant && isBarTime() && barBuilding) {
      // Restituisci una posizione vicina al Bar (centro dell'edificio)
      const barCenterX = barBuilding.x + Math.floor(barBuilding.width / 2);
      const barCenterY = barBuilding.y + Math.floor(barBuilding.height / 2);
      
      // Prova posizioni vicine al Bar
      const nearbyPositions = [
        { x: barCenterX - 1, y: barCenterY },
        { x: barCenterX + 1, y: barCenterY },
        { x: barCenterX, y: barCenterY - 1 },
        { x: barCenterX, y: barCenterY + 1 },
        { x: barCenterX - 1, y: barCenterY - 1 },
        { x: barCenterX + 1, y: barCenterY + 1 },
        { x: barCenterX - 1, y: barCenterY + 1 },
        { x: barCenterX + 1, y: barCenterY - 1 }
      ];
      
      for (const pos of nearbyPositions) {
        if (!isBlocked(pos.x, pos.y, buildings, trees, riverCells) && !isRiver(pos.x, pos.y, riverCells)) {
          return pos;
        }
      }
      
      // Se non trova posizioni vicine, prova il centro
      if (!isBlocked(barCenterX, barCenterY, buildings, trees, riverCells) && !isRiver(barCenterX, barCenterY, riverCells)) {
        return { x: barCenterX, y: barCenterY };
      }
    }
    
    // Altrimenti posizione casuale (ma non sul fiume)
    const randomPos = getRandomValidPosition();
    if (randomPos && !isRiver(randomPos.x, randomPos.y, riverCells)) {
      return randomPos;
    }
    return null;
  };

  // Movimento casuale automatico
  useEffect(() => {
    // Inizializza i personaggi con destinazioni casuali all'avvio
    setCharacters((prevChars) => {
      return prevChars.map((char) => {
        // Se il personaggio è già alla destinazione iniziale, dargli una nuova destinazione
        if (char.x === char.targetX && char.y === char.targetY) {
          const destination = getDestination(char, prevChars);
          if (destination) {
            lastRandomMoveRef.current.set(char.id, Date.now());
            return {
              ...char,
              targetX: destination.x,
              targetY: destination.y
            };
          }
        }
        return char;
      });
    });

    const randomMoveInterval = setInterval(() => {
      const now = Date.now();
      
      setCharacters((prevChars) => {
        // Prima controlla se l'Orco ha catturato qualcuno
        const updatedChars = prevChars.filter((char) => {
          if (char.profession === "Orco") {
            // Controlla se l'Orco è vicino a un Abitante (cattura)
            for (const other of prevChars) {
              if (other.profession !== "Orco" && other.id !== char.id) {
                const dx = Math.abs(char.x - other.x);
                const dy = Math.abs(char.y - other.y);
                // Se l'Orco è molto vicino (meno di 0.5 celle), cattura l'Abitante
                if (dx < 0.5 && dy < 0.5) {
                  return false; // Rimuovi l'Abitante catturato
                }
              }
            }
          }
          return true; // Mantieni il personaggio
        });

        // Poi aggiorna le destinazioni
        return updatedChars.map((char) => {
          const lastMove = lastRandomMoveRef.current.get(char.id) || 0;
          const timeSinceLastMove = now - lastMove;
          
          // Se il personaggio è arrivato alla destinazione e sono passati almeno 1-3 secondi
          // (più veloce per inseguimento/fuga)
          const isAtDestination = Math.abs(char.x - char.targetX) < 0.5 && Math.abs(char.y - char.targetY) < 0.5;
          const isOrc = char.profession === "Orco";
          const isInhabitant = char.profession !== "Orco";
          
          // Controlla se c'è un target nel raggio (per inseguimento/fuga immediato)
          const hasTarget = isOrc 
            ? findNearestInRange(char, updatedChars, (c) => c.profession !== "Orco") !== null
            : findNearestInRange(char, updatedChars, (c) => c.profession === "Orco") !== null;
          
          const shouldMove = hasTarget || (isAtDestination && timeSinceLastMove > (1000 + Math.random() * 2000));
          
          if (shouldMove) {
            const destination = getDestination(char, updatedChars);
            if (destination) {
              lastRandomMoveRef.current.set(char.id, now);
              return {
                ...char,
                targetX: destination.x,
                targetY: destination.y
              };
            }
          }
          
          return char;
        });
      });
    }, 500); // Controlla ogni 500ms per reattività migliore

    return () => clearInterval(randomMoveInterval);
  }, [buildings, trees, riverCells, gameTime, setCharacters]);

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

        // Controlla se la destinazione è valida (non può essere sul fiume)
        if (isBlocked(targetX, targetY, buildings, trees, riverCells) || isRiver(targetX, targetY, riverCells)) {
          return char; // Non muovere se bloccato o sul fiume
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
