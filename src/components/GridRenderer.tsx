import React from "react";
import { View, StyleSheet } from "react-native";
import { GRID_SIZE, CELL_SIZE } from "../constants";
import type { Point } from "../types";
import { isRiver, isSea, isBeach } from "../game/terrain";

type GridRendererProps = {
  offset: Point;
  seed: number;
  riverCells: number[];
};

export function GridRenderer({ offset, seed, riverCells }: GridRendererProps) {
  const cells: React.ReactNode[] = [];

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const left = x * CELL_SIZE + offset.x;
      const top = y * CELL_SIZE + offset.y;
      
      let bgColor: string;
      
      // Determina il tipo di terreno
      if (isSea(x, y)) {
        bgColor = "#1976d2"; // Blu mare
      } else if (isBeach(x, y)) {
        bgColor = "#ffd54f"; // Giallo spiaggia
      } else if (isRiver(x, y, riverCells)) {
        bgColor = "#42a5f5"; // Blu fiume
      } else {
        // Colore erba con variazioni naturali
        const grassVariation = (x * 7 + y * 11 + seed) % 5;
        const grassColors = [
          "#7cb342", // verde erba medio
          "#8bc34a", // verde erba chiaro
          "#9ccc65", // verde erba più chiaro
          "#689f38", // verde erba scuro
          "#558b2f"  // verde erba molto scuro
        ];
        bgColor = grassColors[grassVariation];
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
        />
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
    borderWidth: 0
  }
});
