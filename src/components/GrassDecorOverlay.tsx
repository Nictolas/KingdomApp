import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import type { ErbaExtraDecorKind } from "../game/terrainSpriteHelpers";
import { getErbaDecorSheetCoord } from "../game/overworldSpritesheetLayout";
import { TerrainSheetSprite } from "./TerrainSheetSprite";

type Props = {
  cellSize: number;
  kind: ErbaExtraDecorKind;
};

export const GrassDecorOverlay = memo(function GrassDecorOverlay({ cellSize, kind }: Props) {
  const h = cellSize * 0.88;
  return (
    <View style={[styles.wrap, { width: cellSize, height: cellSize }]} pointerEvents="none">
      <TerrainSheetSprite cellSize={h} coord={getErbaDecorSheetCoord(kind)} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    top: 0,
    justifyContent: "flex-end",
    alignItems: "center",
    zIndex: 1
  }
});
