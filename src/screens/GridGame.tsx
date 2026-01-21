import React, { useMemo, useState } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { useCamera } from "../camera/useCamera";
import { GridRenderer } from "../components/GridRenderer";
import { CharacterRenderer } from "../components/CharacterRenderer";
import { BuildingRenderer } from "../components/BuildingRenderer";
import { BuildingInfoModal } from "../ui/BuildingInfoModal";
import { CharacterInfoModal } from "../ui/CharacterInfoModal";
import { GRID_SIZE, CELL_SIZE, castleData, farmData, houseData } from "../constants";
import type { Character, Building, Placed } from "../types";
import { generateRiver, isRiver, isSea } from "../game/terrain";
import { generateTrees } from "../game/generation";
import { useCharacterMovement } from "../game/useCharacterMovement";

export default function GridGame() {
  // Genera seed casuale all'avvio
  const [seed] = useState(() => Math.floor(Math.random() * 1000000));
  
  // Genera il fiume basato sul seed
  const riverCells = useMemo(() => generateRiver(seed), [seed]);
  
  // Genera gli alberi basati sul seed (dopo aver generato il fiume)
  const trees = useMemo(() => generateTrees(seed, riverCells), [seed, riverCells]);

  const gridPixelSize = useMemo(() => {
    const size = GRID_SIZE * CELL_SIZE;
    return { w: size, h: size };
  }, []);

  const camera = useCamera({
    gridWidth: gridPixelSize.w,
    gridHeight: gridPixelSize.h
  });

  // Personaggi iniziali
  const [characters, setCharacters] = useState<Character[]>([
    { id: 1, x: 32, y: 22, targetX: 32, targetY: 22, emoji: "🤴", profession: "Re", name: "Re Artù", age: 35, lastMove: 0 },
    { id: 2, x: 15, y: 33, targetX: 15, targetY: 33, emoji: "👨‍🌾", profession: "Contadino", name: "Marco", age: 28, lastMove: 0 },
    { id: 3, x: 18, y: 17, targetX: 18, targetY: 17, emoji: "👨‍🍳", profession: "Cuoco", name: "Luca", age: 32, lastMove: 0 },
    { id: 4, x: 25, y: 17, targetX: 25, targetY: 17, emoji: "👨‍🔬", profession: "Scienziato", name: "Giovanni", age: 40, lastMove: 0 },
    { id: 5, x: 14, y: 23, targetX: 14, targetY: 23, emoji: "👨‍🎨", profession: "Artista", name: "Paolo", age: 26, lastMove: 0 },
    { id: 6, x: 33, y: 29, targetX: 33, targetY: 29, emoji: "🪓", profession: "Boscaiolo", name: "Andrea", age: 30, lastMove: 0 }
  ]);
  
  // Hook per il movimento dei personaggi
  const { moveCharacter } = useCharacterMovement({
    characters,
    setCharacters,
    buildings,
    trees,
    riverCells
  });

  // Edifici - filtra quelli che non sono su fiume o mare
  const buildings: Building[] = useMemo(() => {
    const allBuildings = [castleData, farmData, ...houseData];
    
    // Filtra gli edifici che non sono su fiume o mare
    return allBuildings.filter(building => {
      // Controlla tutte le celle dell'edificio
      for (let bx = building.x; bx < building.x + building.width; bx++) {
        for (let by = building.y; by < building.y + building.height; by++) {
          // Se una cella è su fiume o mare, escludi l'edificio
          if (isRiver(bx, by, riverCells) || isSea(bx, by)) {
            return false;
          }
        }
      }
      return true;
    });
  }, [riverCells]);

  // Stato per i dialog
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  const handleBuildingPress = (building: Building) => {
    setSelectedBuilding(building);
  };

  const handleCharacterPress = (character: Character) => {
    setSelectedCharacter(character);
  };

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
        <GridRenderer offset={{ x: 0, y: 0 }} seed={seed} riverCells={riverCells} trees={trees} />
        <CharacterRenderer characters={characters} onPress={handleCharacterPress} />
        <BuildingRenderer buildings={buildings} onPress={handleBuildingPress} />
      </View>
      
      <BuildingInfoModal
        visible={selectedBuilding !== null}
        building={selectedBuilding}
        onClose={() => setSelectedBuilding(null)}
      />
      
      <CharacterInfoModal
        visible={selectedCharacter !== null}
        character={selectedCharacter}
        onClose={() => setSelectedCharacter(null)}
      />
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
