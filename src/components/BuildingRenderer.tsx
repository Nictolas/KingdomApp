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

        const fontSize = building.type === "house" ? 30 : building.type === "castle" ? 144 : 36;
        
        // Per il Bar, mostra 2 emoji (Casa e Birra)
        if (building.type === "bar") {
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
              onStartShouldSetResponder={() => false}
            >
              <View style={styles.barContainer}>
                <Text style={[styles.emoji, { fontSize: 28 }]} selectable={false}>🏠</Text>
                <Text style={[styles.emoji, { fontSize: 28 }]} selectable={false}>🍺</Text>
              </View>
            </Pressable>
          );
        }
        
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
            onStartShouldSetResponder={() => false}
          >
            <Text style={[styles.emoji, { fontSize }]} selectable={false}>{building.emoji}</Text>
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
    justifyContent: "center",
    userSelect: "none",
    WebkitUserSelect: "none",
    MozUserSelect: "none",
    msUserSelect: "none"
  },
  emoji: {
    fontSize: 36,
    userSelect: "none",
    WebkitUserSelect: "none"
  },
  barContainer: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  }
});
