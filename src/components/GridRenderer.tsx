import React from "react";
import { View, StyleSheet } from "react-native";
import { GRID_SIZE, CELL_SIZE } from "../constants";
import type { Point } from "../types";

type GridRendererProps = {
  offset: Point;
};

export function GridRenderer({ offset }: GridRendererProps) {
  const cells: React.ReactNode[] = [];

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const left = x * CELL_SIZE + offset.x;
      const top = y * CELL_SIZE + offset.y;
      
      // Colore alternato per vedere la griglia
      const isEven = (x + y) % 2 === 0;
      const bgColor = isEven ? "#e8f5e9" : "#c8e6c9";

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
    borderWidth: 1,
    borderColor: "#81c784"
  }
});
