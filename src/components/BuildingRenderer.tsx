import React from "react";
import { View, StyleSheet, Text, Pressable } from "react-native";
import type { Building } from "../types";
import { CELL_SIZE } from "../constants";

type BuildingRendererProps = {
  buildings: Building[];
  onPress: (building: Building) => void;
};

export function BuildingRenderer({ buildings, onPress }: BuildingRendererProps) {
  return (
    <>
      {buildings.map((building) => {
        // Calcola la posizione centrale dell'edificio
        const centerX = (building.x + building.width / 2) * CELL_SIZE - CELL_SIZE / 2;
        const centerY = (building.y + building.height / 2) * CELL_SIZE - CELL_SIZE / 2;

        const fontSize = building.type === "house" ? 30 : 36;
        
        return (
          <Pressable
            key={`building-${building.id}`}
            onPress={() => onPress(building)}
            style={[
              styles.building,
              {
                left: centerX,
                top: centerY
              }
            ]}
          >
            <Text style={[styles.emoji, { fontSize }]}>{building.emoji}</Text>
          </Pressable>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  building: {
    position: "absolute",
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: "center",
    justifyContent: "center"
  },
  emoji: {
    fontSize: 36
  }
});
