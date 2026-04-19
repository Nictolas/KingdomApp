import React, { memo } from "react";
import { Image, StyleSheet, View } from "react-native";
import type { ErbaExtraDecorKind } from "../game/terrainSpriteHelpers";

const TALL_GRASS = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/tallGrass.png");
const SPROUT = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/sprout.png");

type Props = {
  cellSize: number;
  kind: ErbaExtraDecorKind;
};

/**
 * Sovrappone `tallGrass` o `sprout` sulla cella erba (in basso, dentro la tile).
 */
export const GrassDecorOverlay = memo(function GrassDecorOverlay({ cellSize, kind }: Props) {
  const source = kind === "tallGrass" ? TALL_GRASS : SPROUT;
  const h = cellSize * 0.88;
  const w = cellSize * 0.92;
  return (
    <View style={[styles.wrap, { width: cellSize, height: cellSize }]} pointerEvents="none">
      <Image source={source} style={{ width: w, height: h }} resizeMode="contain" />
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
