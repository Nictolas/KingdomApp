import React, { memo } from "react";
import { StyleSheet, View } from "react-native";

type Props = {
  cellSize: number;
};

/** Segnaposto visibile quando manca il PNG 1×1 per una cella. */
export const MissingTile1x1 = memo(function MissingTile1x1({ cellSize }: Props) {
  return (
    <View
      style={[styles.tile, { width: cellSize, height: cellSize }]}
      pointerEvents="none"
      accessibilityLabel="Tile mancante"
    />
  );
});

const styles = StyleSheet.create({
  tile: {
    position: "absolute",
    left: 0,
    top: 0,
    backgroundColor: "#e53935"
  }
});
