import React, { memo } from "react";
import { Image, Platform, StyleSheet, View } from "react-native";
import type { ErbaTileAsset1x1 } from "../game/terrainSpriteHelpers";

const ASSETS: Record<ErbaTileAsset1x1, number> = {
  centro: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/erba_centro_1x1.png"),
  campo_nord_est: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/campo_nord_est_1x1.png")
};

type Props = {
  cellSize: number;
  asset: ErbaTileAsset1x1;
};

/**
 * Una cella mappa = un tile erba 1×1 (al posto del motivo 2×2 sul foglio).
 */
export const ErbaTile1x1 = memo(function ErbaTile1x1({ cellSize, asset }: Props) {
  const source = ASSETS[asset];
  const bleed = Platform.OS === "web" ? 1 : 0;
  return (
    <View style={[styles.clip, { width: cellSize, height: cellSize }]} pointerEvents="none">
      <Image
        source={source}
        style={{
          position: "absolute",
          left: -bleed,
          top: -bleed,
          width: cellSize + bleed * 2,
          height: cellSize + bleed * 2
        }}
        resizeMode="cover"
      />
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
