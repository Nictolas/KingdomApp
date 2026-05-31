import React, { memo } from "react";
import { Image, Platform, StyleSheet, View } from "react-native";
import type { ErbaSpiaggiaTileAsset1x1 } from "../game/terrainSpriteHelpers";

const ASSETS: Record<ErbaSpiaggiaTileAsset1x1, number> = {
  nord: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/erba_spiaggia_nord.png"),
  sud: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/erba_spiaggia_sud.png"),
  est: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/erba_spiaggia_est.png"),
  ovest: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/erba_spiaggia_ovest.png"),
  nord_ovest: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/erba_spiaggia_nord_ovest.png"),
  nord_est: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/erba_spiaggia_nord_est.png"),
  sud_est: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/erba_spiaggia_sud_est.png"),
  sud_ovest: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/erba_spiaggia_sud_ovest.png")
};

type Props = {
  cellSize: number;
  asset: ErbaSpiaggiaTileAsset1x1;
};

/**
 * Transizione erba ↔ spiaggia 1×1 (PNG dedicati, non spritesheet).
 */
export const ErbaSpiaggiaTile1x1 = memo(function ErbaSpiaggiaTile1x1({ cellSize, asset }: Props) {
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
