import React, { memo } from "react";
import { Image, StyleSheet, View } from "react-native";
import type { StradaTileAsset1x1 } from "../game/terrainSpriteHelpers";

const ASSETS: Record<StradaTileAsset1x1, number> = {
  orizzontale: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada_orizzontale1x1.png"),
  verticale: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada_verticale1x1.png"),
  nord: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada_nord1x1.png"),
  sud: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada_sud1x1.png"),
  est: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada_est1x1.png"),
  ovest: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada_ovest1x1.png")
};

type Props = {
  cellSize: number;
  asset: StradaTileAsset1x1;
};

/**
 * Una cella mappa = un tile strada 1×1 (nessun autotile 3×3 dallo sheet RPG).
 */
export const StradaTile1x1 = memo(function StradaTile1x1({ cellSize, asset }: Props) {
  const source = ASSETS[asset];
  return (
    <View style={[styles.clip, { width: cellSize, height: cellSize }]} pointerEvents="none">
      <Image source={source} style={{ width: cellSize, height: cellSize }} resizeMode="cover" />
    </View>
  );
});

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
    position: "absolute",
    left: 0,
    top: 0
  }
});
