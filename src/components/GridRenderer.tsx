import React from "react";
import { View, StyleSheet, Text, Pressable } from "react-native";
import { GRID_SIZE, CELL_SIZE } from "../constants";
import type { Point, Placed } from "../types";
import { isRiver, isSea, isBeach } from "../game/terrain";

type GridRendererProps = {
  offset: Point;
  seed: number;
  riverCells: number[];
  trees: Placed[];
  onCellPress?: (x: number, y: number) => void;
};

export function GridRenderer({ offset, seed, riverCells, trees, onCellPress }: GridRendererProps) {
  const cells: React.ReactNode[] = [];
  const treeSet = new Set(trees.map(t => `${t.x},${t.y}`));

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const left = x * CELL_SIZE + offset.x;
      const top = y * CELL_SIZE + offset.y;
      const hasTree = treeSet.has(`${x},${y}`);
      
      let bgColor: string;
      
      // Determina il tipo di terreno
      if (isSea(x, y)) {
        bgColor = "#1976d2"; // Blu mare
      } else if (isBeach(x, y)) {
        bgColor = "#ffd54f"; // Giallo spiaggia
      } else if (isRiver(x, y, riverCells)) {
        bgColor = "#42a5f5"; // Blu fiume
      } else {
        // Colore erba uniforme
        bgColor = "#7cb342"; // verde erba medio
      }

      cells.push(
        <View
          key={`${x}-${y}`}
          style={[
            styles.cell,
            {
              left,
              top,
              backgroundColor: bgColor
            }
          ]}
          onStartShouldSetResponder={() => false}
        >
          {hasTree && <Text style={styles.treeEmoji} selectable={false}>🌲</Text>}
        </View>
      );
    }
  }

  return <>{cells}</>;
}

const styles = StyleSheet.create({
  cell: {
    position: "absolute",
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    userSelect: "none",
    WebkitUserSelect: "none",
    MozUserSelect: "none",
    msUserSelect: "none"
  },
  treeEmoji: {
    fontSize: 24,
    userSelect: "none",
    WebkitUserSelect: "none"
  }
});
