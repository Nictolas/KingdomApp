import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, Dimensions } from "react-native";
import type { Point, Placed, Bridge, Light, Building, Character } from "../types";
import { CELL_SIZE, CELL_GAP, GRID_SIZE, castleData, farmData, houseData } from "../constants";
import { isInsideBuilding } from "../utils";
import { isRiver, isSea, isBeach, makeTerrainColor } from "../game/terrain";
import { computeNightOpacity } from "../game/night";
import { blendHex } from "../game/color";

type GridRendererProps = {
  bridges: Bridge[];
  trees: Placed[];
  mines: Placed[];
  lights: Light[];
  selectedRiver: Point | null;
  buildMode: "light" | "bridge" | null;
  gameTime: { hours: number; minutes: number };
  isDragging: boolean;
  onCellPress: (x: number, y: number) => void;
  offset: Point;
  zoom: number;
};

export function GridRenderer({
  bridges,
  trees,
  mines,
  lights,
  selectedRiver,
  buildMode,
  gameTime,
  isDragging,
  onCellPress,
  offset,
  zoom,
  onCharacterPress,
  onBuildingPress
}: GridRendererProps) {
  const nightOpacity = useMemo(() => computeNightOpacity(gameTime.hours, gameTime.minutes), [gameTime]);

  // Memoizza i set per lookup veloce O(1) invece di O(n)
  const bridgeSet = useMemo(() => new Set(bridges.map(b => `${b.x},${b.y}`)), [bridges]);
  const treeSet = useMemo(() => new Set(trees.map(t => `${t.x},${t.y}`)), [trees]);
  const mineSet = useMemo(() => new Set(mines.map(m => `${m.x},${m.y}`)), [mines]);
  const lightSet = useMemo(() => new Set(lights.map(l => `${l.x},${l.y}`)), [lights]);
  
  // Memoizza anche il set delle luci illuminate per lookup veloce
  const illuminatedSet = useMemo(() => {
    const set = new Set<string>();
    for (const light of lights) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          set.add(`${light.x + dx},${light.y + dy}`);
        }
      }
    }
    return set;
  }, [lights]);
  
  const isBridge = (x: number, y: number) => bridgeSet.has(`${x},${y}`);

  const gridCells = useMemo(() => {
    const cells: React.ReactNode[] = [];
    // VIEWPORT CULLING: renderizza solo le celle visibili nello schermo
    const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
    
    // Calcola quali celle sono visibili basandosi su offset e zoom
    // offset è la posizione dell'angolo in alto a sinistra della griglia nello schermo (dopo lo scaling)
    // La griglia è scalata con zoom, quindi le celle hanno dimensioni CELL_SIZE * zoom
    const scaledCellSize = CELL_SIZE * zoom;
    const margin = 3; // Margine per evitare flickering durante il movimento
    
    // Calcola il range di celle visibili nello spazio della griglia (non scalato)
    // offset.x è la posizione della griglia scalata nello schermo
    // Per trovare quale cella è visibile: (screenX - offset.x) / zoom / CELL_SIZE
    const startX = Math.max(0, Math.floor((-offset.x / zoom - margin * CELL_SIZE) / CELL_SIZE));
    const endX = Math.min(GRID_SIZE - 1, Math.ceil((-offset.x / zoom + screenWidth / zoom + margin * CELL_SIZE) / CELL_SIZE));
    const startY = Math.max(0, Math.floor((-offset.y / zoom - margin * CELL_SIZE) / CELL_SIZE));
    const endY = Math.min(GRID_SIZE - 1, Math.ceil((-offset.y / zoom + screenHeight / zoom + margin * CELL_SIZE) / CELL_SIZE));
    
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const river = isRiver(x, y);
        const bridge = isBridge(x, y);
        const castle = isInsideBuilding(castleData, x, y);
        const farm = isInsideBuilding(farmData, x, y);
        const house = houseData.some((h) => isInsideBuilding(h, x, y));
        const sea = isSea(x, y);
        const beach = isBeach(x, y);
        const tree = treeSet.has(`${x},${y}`);
        const mine = mineSet.has(`${x},${y}`);
        const light = lightSet.has(`${x},${y}`);
        const illuminated = illuminatedSet.has(`${x},${y}`);

        const bg = makeTerrainColor({
          x,
          y,
          isRiver: river,
          isSea: sea,
          isBeach: beach,
          isBridge: bridge,
          isCastle: castle,
          isFarm: farm,
          isHouse: house,
          isIlluminated: illuminated,
          isLight: light,
          nightOpacity,
          blendHex
        });

        const emoji = bridge ? "🌉" : tree ? "🌲" : mine ? "⛰️" : light ? "💡" : null;
        const emojiSize = tree || mine ? 20 : light ? 22 : 18;

        const left = x * CELL_SIZE;
        const top = y * CELL_SIZE;
        
        cells.push(
          <Pressable
            key={`${x}-${y}`}
            onPress={() => onCellPress(x, y)}
            style={[
              styles.cell,
              {
                position: "absolute",
                left,
                top,
                backgroundColor: bg,
                width: CELL_SIZE,
                height: CELL_SIZE,
                borderWidth: 0
              }
            ]}
          >
            {emoji && <Text style={{ fontSize: emojiSize }}>{emoji}</Text>}
          </Pressable>
        );
      }
    }
    return cells;
  }, [bridges, trees, mines, lights, selectedRiver, buildMode, nightOpacity, onCellPress, offset.x, offset.y, zoom]);

  return <>{gridCells}</>;
}

type CharacterRendererProps = {
  characters: Character[];
  isDragging: boolean;
  onPress: (char: Character) => void;
};

export function CharacterRenderer({ characters, isDragging, onPress }: CharacterRendererProps) {
  const characterNodes = useMemo(() => {
    return characters
      .filter((c) => {
        // Filtra i personaggi per assicurarsi che siano dentro la griglia
        const gridX = Math.round(c.x);
        const gridY = Math.round(c.y);
        return gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE;
      })
      .map((c) => {
        // Clamp le coordinate per assicurarsi che siano dentro la griglia
        const clampedX = Math.max(0, Math.min(GRID_SIZE - 1, c.x));
        const clampedY = Math.max(0, Math.min(GRID_SIZE - 1, c.y));
        const left = clampedX * CELL_SIZE + CELL_SIZE * 0.1;
        const top = clampedY * CELL_SIZE + CELL_SIZE * 0.05;
        
        // Controllo finale: assicurati che left e top siano dentro i limiti della griglia
        const maxLeft = (GRID_SIZE - 1) * CELL_SIZE + CELL_SIZE;
        const maxTop = (GRID_SIZE - 1) * CELL_SIZE + CELL_SIZE;
        
        if (left < 0 || left > maxLeft || top < 0 || top > maxTop) {
          return null;
        }
        
        return (
          <Pressable
            key={`char-${c.id}`}
            onPress={() => onPress(c)}
            style={[styles.char, { left, top, width: CELL_SIZE, height: CELL_SIZE }]}
          >
            <Text style={{ fontSize: 22 }}>{c.emoji}</Text>
          </Pressable>
        );
      })
      .filter((node) => node !== null);
  }, [characters, isDragging, onPress]);

  return <>{characterNodes}</>;
}

type BuildingRendererProps = {
  isDragging: boolean;
  onPress: (building: Building) => void;
};

export function BuildingRenderer({ isDragging, onPress }: BuildingRendererProps) {
  const buildingNodes = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    const add = (b: Building) => {
      // Filtra gli edifici per assicurarsi che siano completamente dentro la griglia
      if (
        b.x >= 0 &&
        b.x + b.width <= GRID_SIZE &&
        b.y >= 0 &&
        b.y + b.height <= GRID_SIZE
      ) {
        const centerX = (b.x + b.width / 2) * CELL_SIZE - CELL_SIZE / 2;
        const centerY = (b.y + b.height / 2) * CELL_SIZE - CELL_SIZE / 2;
        
        // Controllo finale: assicurati che centerX e centerY siano dentro i limiti della griglia
        const maxX = GRID_SIZE * CELL_SIZE;
        const maxY = GRID_SIZE * CELL_SIZE;
        
        if (centerX < -50 || centerX > maxX + 50 || centerY < -50 || centerY > maxY + 50) {
          return; // Non renderizzare se fuori dai limiti
        }
        
        nodes.push(
          <Pressable key={`building-${b.id}`} onPress={() => onPress(b)} style={[styles.building, { left: centerX, top: centerY }]}>
            <Text style={{ fontSize: b.type === "house" ? 30 : 36 }}>{b.emoji}</Text>
          </Pressable>
        );
      }
    };
    add(castleData);
    add(farmData);
    houseData.forEach(add);
    return nodes;
  }, [isDragging, onPress]);

  return <>{buildingNodes}</>;
}

const styles = StyleSheet.create({
  cell: { borderRadius: 0, alignItems: "center", justifyContent: "center" },
  char: { position: "absolute", alignItems: "center", justifyContent: "center" },
  building: { position: "absolute", alignItems: "center", justifyContent: "center" }
});
