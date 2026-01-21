import React, { useMemo, useState } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { useCamera } from "../camera/useCamera";
import { GridRenderer } from "../components/GridRenderer";
import { CharacterRenderer } from "../components/CharacterRenderer";
import { BuildingRenderer } from "../components/BuildingRenderer";
import { GRID_SIZE, CELL_SIZE, castleData, farmData, houseData } from "../constants";
import type { Character, Building } from "../types";
import { generateRiver } from "../game/terrain";

export default function GridGame() {
  // Genera seed casuale all'avvio
  const [seed] = useState(() => Math.floor(Math.random() * 1000000));
  
  // Genera il fiume basato sul seed
  const riverCells = useMemo(() => generateRiver(seed), [seed]);

  const gridPixelSize = useMemo(() => {
    const size = GRID_SIZE * CELL_SIZE;
    return { w: size, h: size };
  }, []);

  const camera = useCamera({
    gridWidth: gridPixelSize.w,
    gridHeight: gridPixelSize.h
  });

  // Personaggi iniziali
  const [characters] = useState<Character[]>([
    { id: 1, x: 32, y: 22, targetX: 32, targetY: 22, emoji: "🤴", profession: "Re", name: "Re Artù", age: 35, lastMove: 0 },
    { id: 2, x: 15, y: 33, targetX: 15, targetY: 33, emoji: "👨‍🌾", profession: "Contadino", name: "Marco", age: 28, lastMove: 0 },
    { id: 3, x: 18, y: 17, targetX: 18, targetY: 17, emoji: "👨‍🍳", profession: "Cuoco", name: "Luca", age: 32, lastMove: 0 },
    { id: 4, x: 25, y: 17, targetX: 25, targetY: 17, emoji: "👨‍🔬", profession: "Scienziato", name: "Giovanni", age: 40, lastMove: 0 },
    { id: 5, x: 14, y: 23, targetX: 14, targetY: 23, emoji: "👨‍🎨", profession: "Artista", name: "Paolo", age: 26, lastMove: 0 },
    { id: 6, x: 33, y: 29, targetX: 33, targetY: 29, emoji: "🪓", profession: "Boscaiolo", name: "Andrea", age: 30, lastMove: 0 }
  ]);

  // Edifici
  const buildings: Building[] = useMemo(() => {
    return [castleData, farmData, ...houseData];
  }, []);

  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

  return (
    <View
      style={styles.container}
      onTouchStart={camera.onTouchStart}
      onTouchMove={camera.onTouchMove}
      onTouchEnd={camera.onTouchEnd}
      onMouseDown={camera.handleMouseDown}
      onMouseMove={camera.handleMouseMove}
      onMouseUp={camera.handleMouseUp}
    >
      <View
        style={[
          styles.gridContainer,
          {
            width: gridPixelSize.w,
            height: gridPixelSize.h,
            transform: [
              { translateX: camera.offset.x },
              { translateY: camera.offset.y }
            ]
          }
        ]}
      >
        <GridRenderer offset={{ x: 0, y: 0 }} seed={seed} riverCells={riverCells} />
        <CharacterRenderer characters={characters} />
        <BuildingRenderer buildings={buildings} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    overflow: "hidden"
  },
  gridContainer: {
    position: "absolute"
  }
});
