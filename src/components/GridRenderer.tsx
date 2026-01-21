import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Point, Placed, Bridge, Light, Building, Character } from "../types";
import { CELL_SIZE, CELL_GAP, GRID_SIZE, castleData, farmData, houseData } from "../constants";
import { isInsideBuilding } from "../utils";
import { isRiver, isSea, isBeach, makeTerrainColor } from "../game/terrain";
import { isLightAt, isIlluminatedByAnyLight } from "../game/lights";
import { computeNightOpacity } from "../game/night";
import { blendHex } from "../game/color";
import { isTree, isMine } from "../utils";

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
  onCharacterPress,
  onBuildingPress
}: GridRendererProps) {
  const nightOpacity = useMemo(() => computeNightOpacity(gameTime.hours, gameTime.minutes), [gameTime]);

  const isBridge = (x: number, y: number) => bridges.some((b) => b.x === x && b.y === y);

  const gridCells = useMemo(() => {
    const cells: React.ReactNode[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const river = isRiver(x, y);
        const bridge = isBridge(x, y);
        const castle = isInsideBuilding(castleData, x, y);
        const farm = isInsideBuilding(farmData, x, y);
        const house = houseData.some((h) => isInsideBuilding(h, x, y));
        const sea = isSea(x, y);
        const beach = isBeach(x, y);
        const tree = isTree(x, y, trees);
        const mine = isMine(x, y, mines);
        const light = isLightAt(lights, x, y);
        const illuminated = isIlluminatedByAnyLight(lights, x, y);

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

        const left = x * (CELL_SIZE + CELL_GAP);
        const top = y * (CELL_SIZE + CELL_GAP);
        
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
  }, [bridges, trees, mines, lights, selectedRiver, isDragging, buildMode, nightOpacity, onCellPress]);

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
        const left = clampedX * (CELL_SIZE + CELL_GAP) + CELL_SIZE * 0.1;
        const top = clampedY * (CELL_SIZE + CELL_GAP) + CELL_SIZE * 0.05;
        
        // Controllo finale: assicurati che left e top siano dentro i limiti della griglia
        const maxLeft = (GRID_SIZE - 1) * (CELL_SIZE + CELL_GAP) + CELL_SIZE;
        const maxTop = (GRID_SIZE - 1) * (CELL_SIZE + CELL_GAP) + CELL_SIZE;
        
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
        const centerX = (b.x + b.width / 2) * (CELL_SIZE + CELL_GAP) - (CELL_SIZE + CELL_GAP) / 2;
        const centerY = (b.y + b.height / 2) * (CELL_SIZE + CELL_GAP) - (CELL_SIZE + CELL_GAP) / 2;
        
        // Controllo finale: assicurati che centerX e centerY siano dentro i limiti della griglia
        const maxX = GRID_SIZE * (CELL_SIZE + CELL_GAP);
        const maxY = GRID_SIZE * (CELL_SIZE + CELL_GAP);
        
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
  cell: { borderRadius: 10, alignItems: "center", justifyContent: "center" },
  char: { position: "absolute", alignItems: "center", justifyContent: "center" },
  building: { position: "absolute", alignItems: "center", justifyContent: "center" }
});
