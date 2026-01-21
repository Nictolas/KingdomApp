import { useState, useEffect, useRef } from "react";
import type { Character, Point, Building, Placed } from "../types";
import { GRID_SIZE } from "../constants";
import { isRiver, isSea } from "./terrain";
import type { GameTime } from "./gameClock";
import {
  isInRange,
  findNearestInRange,
  isInsideBuilding,
  findNearestBuildingInRange,
  getBuildingEntryPoint,
  canOrcEnter
} from "./orcLogic";

type UseCharacterMovementOptions = {
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  buildings: Building[];
  trees: Placed[];
  riverCells: number[];
  gameTime: GameTime;
  onKingCaptured?: () => void;
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
  riverCells: number[],
  allowBuildingEntry: boolean = false
): Point[] | null {
  // Controlla che la destinazione non sia bloccata o sul fiume
  if (isRiver(target.x, target.y, riverCells)) {
    return null;
  }
  
  if (!allowBuildingEntry && isBlocked(target.x, target.y, buildings, trees, riverCells)) {
    return null;
  }
  
  // Se allowBuildingEntry è true, controlla solo fiume, mare, alberi (non edifici)
  if (allowBuildingEntry) {
    if (target.x < 0 || target.x >= GRID_SIZE || target.y < 0 || target.y >= GRID_SIZE) {
      return null;
    }
    if (isSea(target.x, target.y)) {
      return null;
    }
    if (trees.some(t => t.x === target.x && t.y === target.y)) {
      return null;
    }
    // Permette l'ingresso negli edifici
  }

  // Controlla che la partenza non sia sul fiume
  if (isRiver(start.x, start.y, riverCells)) {
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
      
      // CONTROLLO CRITICO: Non può passare attraverso il fiume
      if (isRiver(next.x, next.y, riverCells)) continue;
      
      // Se allowBuildingEntry è true, permette il passaggio attraverso gli edifici
      if (!allowBuildingEntry && isBlocked(next.x, next.y, buildings, trees, riverCells)) {
        continue;
      }
      
      // Se allowBuildingEntry è true, controlla solo fiume, mare, alberi
      if (allowBuildingEntry) {
        if (next.x < 0 || next.x >= GRID_SIZE || next.y < 0 || next.y >= GRID_SIZE) {
          continue;
        }
        if (isSea(next.x, next.y)) {
          continue;
        }
        if (trees.some(t => t.x === next.x && t.y === next.y)) {
          continue;
        }
        // Permette il passaggio attraverso gli edifici
      }

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
  gameTime,
  onKingCaptured
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

  // Helper per controllare se una posizione è bloccata (per uso nelle funzioni dell'Orco)
  const checkIsBlocked = useRef((x: number, y: number): boolean => {
    return isBlocked(x, y, buildings, trees, riverCells);
  });
  
  // Aggiorna il ref quando cambiano le dipendenze
  useEffect(() => {
    checkIsBlocked.current = (x: number, y: number): boolean => {
      return isBlocked(x, y, buildings, trees, riverCells);
    };
  }, [buildings, trees, riverCells]);

  // Genera una posizione casuale valida (non sul fiume) - percorsi più brevi
  const getRandomValidPosition = (currentX?: number, currentY?: number, maxDistance: number = 5): Point | null => {
    const maxAttempts = 50;
    for (let i = 0; i < maxAttempts; i++) {
      let x: number;
      let y: number;
      
      // Se abbiamo una posizione corrente, genera una posizione vicina (percorso breve)
      if (currentX !== undefined && currentY !== undefined) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * maxDistance + 1; // Distanza tra 1 e maxDistance+1
        x = Math.round(currentX + Math.cos(angle) * distance);
        y = Math.round(currentY + Math.sin(angle) * distance);
        
        // Clamp dentro la griglia
        x = Math.max(0, Math.min(GRID_SIZE - 1, x));
        y = Math.max(0, Math.min(GRID_SIZE - 1, y));
      } else {
        // Altrimenti posizione completamente casuale
        x = Math.floor(Math.random() * GRID_SIZE);
        y = Math.floor(Math.random() * GRID_SIZE);
      }
      
      if (!isBlocked(x, y, buildings, trees, riverCells) && !isRiver(x, y, riverCells)) {
        return { x, y };
      }
    }
    return null;
  };

  // Ottiene una destinazione per il personaggio (Bar se è l'ora giusta, altrimenti casuale)
  const getDestination = useRef((char: Character, allChars: Character[]): Point | null => {
    const isOrc = char.profession === "Orco";
    const isInhabitant = char.profession !== "Orco";

    // Logica per l'Orco: insegue gli Abitanti (ma non quelli dentro gli edifici)
    if (isOrc) {
      const target = findNearestInRange(
        char,
        allChars,
        (c) => c.profession !== "Orco" && !isInsideBuilding(c, buildings) // Non inseguire quelli dentro gli edifici
      );
      if (target) {
        // Insegue il target
        const targetX = Math.round(target.x);
        const targetY = Math.round(target.y);
        
        // Prova posizioni vicine al target per catturarlo (MA NON SUL FIUME)
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
          // CONTROLLO RIGOROSO: non può essere bloccato, non può essere sul fiume, E l'Orco non può entrare negli edifici
          if (
            !isBlocked(pos.x, pos.y, buildings, trees, riverCells) &&
            !isRiver(pos.x, pos.y, riverCells) &&
            canOrcEnter(pos.x, pos.y, buildings)
          ) {
            return pos;
          }
        }

        // Se non trova posizioni vicine, prova il target stesso (se non è bloccato, non è sul fiume, e l'Orco può entrarci)
        if (
          !isBlocked(targetX, targetY, buildings, trees, riverCells) &&
          !isRiver(targetX, targetY, riverCells) &&
          canOrcEnter(targetX, targetY, buildings)
        ) {
          return { x: targetX, y: targetY };
        }
        
        // Se tutte le posizioni sono bloccate, sul fiume, o dentro edifici, non inseguire
        return null;
      }
    }

    // Logica per gli Abitanti: scappano dall'Orco
    if (isInhabitant) {
      const orc = findNearestInRange(char, allChars, (c) => c.profession === "Orco");
      if (orc) {
        // Se l'Abitante è già dentro un edificio, resta lì (è al sicuro)
        if (isInsideBuilding(char, buildings)) {
          return null; // Non muoversi, è già al sicuro
        }

        // Prima priorità: cerca un edificio nel raggio 5x5 per rifugiarsi
        const nearestBuilding = findNearestBuildingInRange(char, buildings, riverCells, checkIsBlocked.current);
        if (nearestBuilding) {
          const entryPoint = getBuildingEntryPoint(nearestBuilding, char, riverCells, checkIsBlocked.current);
          if (entryPoint) {
            return entryPoint; // Entra nell'edificio
          }
        }

        // Se non c'è un edificio vicino, scappa nella direzione opposta all'Orco
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
            // CONTROLLO RIGOROSO: non può essere bloccato E non può essere sul fiume
            if (!isBlocked(pos.x, pos.y, buildings, trees, riverCells) && !isRiver(pos.x, pos.y, riverCells)) {
              return pos;
            }
          }
          
            // Se tutte le posizioni di fuga sono bloccate o sul fiume, prova una posizione casuale (vicina)
            const randomEscape = getRandomValidPosition(Math.round(char.x), Math.round(char.y), 3);
            if (randomEscape) {
              return randomEscape;
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
    
      // Altrimenti posizione casuale (ma non sul fiume) - percorsi brevi
      const randomPos = getRandomValidPosition(Math.round(char.x), Math.round(char.y), 5);
      if (randomPos && !isRiver(randomPos.x, randomPos.y, riverCells)) {
        return randomPos;
      }
    return null;
  });
  
  // Aggiorna getDestination quando cambiano le dipendenze
  useEffect(() => {
    getDestination.current = (char: Character, allChars: Character[]): Point | null => {
      const isOrc = char.profession === "Orco";
      const isInhabitant = char.profession !== "Orco";

      // Logica per l'Orco: insegue gli Abitanti (ma non quelli dentro gli edifici)
      if (isOrc) {
        const target = findNearestInRange(
          char,
          allChars,
          (c) => c.profession !== "Orco" && !isInsideBuilding(c, buildings) // Non inseguire quelli dentro gli edifici
        );
        if (target) {
          // Insegue il target
          const targetX = Math.round(target.x);
          const targetY = Math.round(target.y);
          
          // Prova posizioni vicine al target per catturarlo (MA NON SUL FIUME)
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
            // CONTROLLO RIGOROSO: non può essere bloccato, non può essere sul fiume, E l'Orco non può entrare negli edifici
            if (
              !isBlocked(pos.x, pos.y, buildings, trees, riverCells) &&
              !isRiver(pos.x, pos.y, riverCells) &&
              canOrcEnter(pos.x, pos.y, buildings)
            ) {
              return pos;
            }
          }

          // Se non trova posizioni vicine, prova il target stesso (se non è bloccato, non è sul fiume, e l'Orco può entrarci)
          if (
            !isBlocked(targetX, targetY, buildings, trees, riverCells) &&
            !isRiver(targetX, targetY, riverCells) &&
            canOrcEnter(targetX, targetY, buildings)
          ) {
            return { x: targetX, y: targetY };
          }
          
          // Se tutte le posizioni sono bloccate, sul fiume, o dentro edifici, non inseguire
          return null;
        }
      }

      // Logica per gli Abitanti: scappano dall'Orco
      if (isInhabitant) {
        const orc = findNearestInRange(char, allChars, (c) => c.profession === "Orco");
        if (orc) {
          // Se l'Abitante è già dentro un edificio, resta lì (è al sicuro)
          if (isInsideBuilding(char, buildings)) {
            return null; // Non muoversi, è già al sicuro
          }

          // Prima priorità: cerca un edificio nel raggio 5x5 per rifugiarsi
          const nearestBuilding = findNearestBuildingInRange(char, buildings, riverCells, checkIsBlocked.current);
          if (nearestBuilding) {
            const entryPoint = getBuildingEntryPoint(nearestBuilding, char, riverCells, checkIsBlocked.current);
            if (entryPoint) {
              return entryPoint; // Entra nell'edificio
            }
          }

          // Se non c'è un edificio vicino, scappa nella direzione opposta all'Orco
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
              // CONTROLLO RIGOROSO: non può essere bloccato E non può essere sul fiume
              if (!isBlocked(pos.x, pos.y, buildings, trees, riverCells) && !isRiver(pos.x, pos.y, riverCells)) {
                return pos;
              }
            }
            
            // Se tutte le posizioni di fuga sono bloccate o sul fiume, prova una posizione casuale (vicina)
            const randomEscape = getRandomValidPosition(Math.round(char.x), Math.round(char.y), 3);
            if (randomEscape) {
              return randomEscape;
            }
          }
        }
      }

      // Se è l'ora del Bar e il Bar esiste, vai al Bar (solo per Abitanti)
      if (isInhabitant && isBarTime() && barBuilding) {
        // Se il personaggio è già dentro un edificio (diverso dal Bar), non muoversi
        if (isInsideBuilding(char, buildings)) {
          // Controlla se è dentro il Bar
          const charX = Math.round(char.x);
          const charY = Math.round(char.y);
          const isInBar = (
            charX >= barBuilding.x &&
            charX < barBuilding.x + barBuilding.width &&
            charY >= barBuilding.y &&
            charY < barBuilding.y + barBuilding.height
          );
          // Se è già dentro il Bar, resta lì
          if (isInBar) {
            return null;
          }
          // Se è dentro un altro edificio, non muoversi
          return null;
        }
        
        // Prova prima di entrare dentro il Bar
        const barEntryPoint = getBuildingEntryPoint(barBuilding, char, riverCells, checkIsBlocked.current);
        if (barEntryPoint) {
          return barEntryPoint; // Entra nel Bar
        }
        
        // Se non può entrare, va vicino al Bar
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
      
      // Se gli Abitanti non sanno cosa fare (nessun Orco vicino), vanno comunque al Bar
      if (isInhabitant && barBuilding) {
        // Se il personaggio è già dentro un edificio (diverso dal Bar), non muoversi
        if (isInsideBuilding(char, buildings)) {
          // Controlla se è dentro il Bar
          const charX = Math.round(char.x);
          const charY = Math.round(char.y);
          const isInBar = (
            charX >= barBuilding.x &&
            charX < barBuilding.x + barBuilding.width &&
            charY >= barBuilding.y &&
            charY < barBuilding.y + barBuilding.height
          );
          // Se è già dentro il Bar, resta lì
          if (isInBar) {
            return null;
          }
          // Se è dentro un altro edificio, non muoversi
          return null;
        }
        
        // Controlla se c'è un Orco vicino
        const orc = findNearestInRange(char, allChars, (c) => c.profession === "Orco");
        
        // Se non c'è un Orco vicino, vai al Bar
        if (!orc) {
          // Vai al Bar - prova prima di entrare dentro l'edificio
          const barEntryPoint = getBuildingEntryPoint(barBuilding, char, riverCells, checkIsBlocked.current);
          if (barEntryPoint) {
            return barEntryPoint; // Entra nel Bar
          }
          
          // Se non può entrare, va vicino al Bar
          const barCenterX = barBuilding.x + Math.floor(barBuilding.width / 2);
          const barCenterY = barBuilding.y + Math.floor(barBuilding.height / 2);
          
          // Prova posizioni vicine al Bar (più opzioni)
          const nearbyPositions = [
            { x: barCenterX - 1, y: barCenterY },
            { x: barCenterX + 1, y: barCenterY },
            { x: barCenterX, y: barCenterY - 1 },
            { x: barCenterX, y: barCenterY + 1 },
            { x: barCenterX - 1, y: barCenterY - 1 },
            { x: barCenterX + 1, y: barCenterY + 1 },
            { x: barCenterX - 1, y: barCenterY + 1 },
            { x: barCenterX + 1, y: barCenterY - 1 },
            { x: barCenterX - 2, y: barCenterY },
            { x: barCenterX + 2, y: barCenterY },
            { x: barCenterX, y: barCenterY - 2 },
            { x: barCenterX, y: barCenterY + 2 }
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
      }
      
      // Altrimenti posizione casuale (ma non sul fiume) - percorsi brevi
      const randomPos = getRandomValidPosition(Math.round(char.x), Math.round(char.y), 5);
      if (randomPos && !isRiver(randomPos.x, randomPos.y, riverCells)) {
        return randomPos;
      }
      return null;
    };
  }, [buildings, trees, riverCells, gameTime, barBuilding]);

  // Movimento casuale automatico
  useEffect(() => {
    // Inizializza i personaggi con destinazioni casuali all'avvio
    setCharacters((prevChars) => {
      return prevChars.map((char) => {
        // Se il personaggio è già alla destinazione iniziale, dargli una nuova destinazione
        if (char.x === char.targetX && char.y === char.targetY) {
          const destination = getDestination.current(char, prevChars);
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
        // Prima controlla se l'Orco ha catturato qualcuno (trasforma in lapide)
        const updatedChars = prevChars.map((char) => {
          // Se è già una lapide, mantienila
          if (char.emoji === "🪦") {
            return char;
          }

          // Se è un Abitante (non Orco), controlla se l'Orco è vicino
          if (char.profession !== "Orco") {
            // L'Abitante è al sicuro se è dentro un edificio
            if (isInsideBuilding(char, buildings)) {
              return char; // Non può essere catturato se è dentro un edificio
            }

            // Cerca l'Orco tra i personaggi
            for (const other of prevChars) {
              if (other.profession === "Orco" && other.id !== char.id) {
                const dx = Math.abs(char.x - other.x);
                const dy = Math.abs(char.y - other.y);
                // Se l'Orco è molto vicino (meno di 0.5 celle), trasforma l'Abitante in lapide
                if (dx < 0.5 && dy < 0.5) {
                  // Se è il Re, attiva il game over
                  if (char.profession === "Re" && onKingCaptured) {
                    onKingCaptured();
                  }
                  
                  // Trasforma l'Abitante in lapide
                  return {
                    ...char,
                    emoji: "🪦",
                    profession: "Lapide",
                    name: `Lapide di ${char.name}`
                  };
                }
              }
            }
          }
          return char; // Mantieni il personaggio
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
            ? findNearestInRange(char, updatedChars, (c) => c.profession !== "Orco" && !isInsideBuilding(c, buildings)) !== null
            : findNearestInRange(char, updatedChars, (c) => c.profession === "Orco") !== null;
          
          const shouldMove = hasTarget || (isAtDestination && timeSinceLastMove > (1000 + Math.random() * 2000));
          
          if (shouldMove) {
            const destination = getDestination.current(char, updatedChars);
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
  }, [buildings, trees, riverCells, gameTime, setCharacters, getDestination]);

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

          // CONTROLLO CRITICO: Non permettere movimento sul fiume
          // Controlla SOLO la posizione arrotondata finale (dove il personaggio si trova effettivamente)
          // Non controllare le celle intermedie perché il personaggio potrebbe passarci sopra senza fermarsi
          const roundedX = Math.round(newX);
          const roundedY = Math.round(newY);
          
          // Se la posizione finale è sul fiume, ferma il personaggio
          if (isRiver(roundedX, roundedY, riverCells)) {
            // Se il personaggio è già sul fiume, trova una posizione sicura vicina
            if (isRiver(Math.round(char.x), Math.round(char.y), riverCells)) {
              // Il personaggio è bloccato sul fiume, trova una posizione sicura
              const safePositions = [
                { x: roundedX - 1, y: roundedY },
                { x: roundedX + 1, y: roundedY },
                { x: roundedX, y: roundedY - 1 },
                { x: roundedX, y: roundedY + 1 }
              ];
              
              for (const pos of safePositions) {
                if (pos.x >= 0 && pos.x < GRID_SIZE && pos.y >= 0 && pos.y < GRID_SIZE) {
                  if (!isRiver(pos.x, pos.y, riverCells) && !isBlocked(pos.x, pos.y, buildings, trees, riverCells)) {
                    // Sposta il personaggio in una posizione sicura
                    return { ...char, x: pos.x, y: pos.y, targetX: pos.x, targetY: pos.y };
                  }
                }
              }
            }
            // Se non può muoversi, mantieni la posizione corrente
            return char;
          }

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

  const moveCharacter = (characterId: number, targetX: number, targetY: number, allowBuildingEntry: boolean = false) => {
    setCharacters((prevChars) => {
      return prevChars.map((char) => {
        if (char.id !== characterId) return char;

        // CONTROLLO RIGOROSO: la destinazione non può essere sul fiume
        if (isRiver(targetX, targetY, riverCells)) {
          return char; // Non muovere se sul fiume
        }

        // Controlla se la destinazione è valida
        // Se allowBuildingEntry è true, permette l'ingresso negli edifici
        if (!allowBuildingEntry && isBlocked(targetX, targetY, buildings, trees, riverCells)) {
          return char; // Non muovere se bloccato
        }
        
        // Se allowBuildingEntry è true, controlla solo fiume, mare, alberi (non edifici)
        if (allowBuildingEntry) {
          if (targetX < 0 || targetX >= GRID_SIZE || targetY < 0 || targetY >= GRID_SIZE) {
            return char; // Fuori dalla griglia
          }
          if (isSea(targetX, targetY)) {
            return char; // Nel mare
          }
          if (trees.some(t => t.x === targetX && t.y === targetY)) {
            return char; // Su un albero
          }
          // Permette l'ingresso negli edifici
        }

        // Controlla che anche la posizione corrente non sia sul fiume
        const currentX = Math.round(char.x);
        const currentY = Math.round(char.y);
        if (isRiver(currentX, currentY, riverCells)) {
          // Se il personaggio è già sul fiume, trova una posizione sicura vicina
          const safePositions = [
            { x: currentX - 1, y: currentY },
            { x: currentX + 1, y: currentY },
            { x: currentX, y: currentY - 1 },
            { x: currentX, y: currentY + 1 }
          ];
          
          for (const pos of safePositions) {
            if (!isBlocked(pos.x, pos.y, buildings, trees, riverCells) && !isRiver(pos.x, pos.y, riverCells)) {
              return {
                ...char,
                x: pos.x,
                y: pos.y,
                targetX: pos.x,
                targetY: pos.y
              };
            }
          }
          
          return char; // Non può muoversi se è bloccato sul fiume
        }

        // Trova un percorso (che già evita il fiume)
        const path = findPath(
          { x: currentX, y: currentY },
          { x: targetX, y: targetY },
          buildings,
          trees,
          riverCells,
          allowBuildingEntry
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
