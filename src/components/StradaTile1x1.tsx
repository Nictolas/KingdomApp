import React, { memo } from "react";
import { Image, StyleSheet, View } from "react-native";
import type { StradaTileAsset1x1 } from "../game/terrainSpriteHelpers";

const ASSETS: Record<StradaTileAsset1x1, number> = {
  orizzontale: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada_orizzontale1x1.png"),
  verticale: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada_verticale1x1.png"),
  nord: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada_nord1x1.png"),
  sud: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada_sud1x1.png"),
  /**
   * Allineamento nomi file ↔ topologia:
   * - `est` = unico vicino strada a **Est** (sei il cappio a Ovest del tratto: a **destra** continua la strada) → file `strada_ovest1x1`.
   * - `ovest` = unico vicino strada a **Ovest** (cappio a Est: a destra erba) → file `strada_est1x1`.
   */
  est: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada_ovest1x1.png"),
  ovest: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada_est1x1.png"),
  curva_nord_est: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/curva_nord_est_1x1.png"),
  curva_nord_ovest: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/curva_nord_ovest_1x1.png"),
  curva_sud_est: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/curva_sud_est_1x1.png"),
  curva_sud_ovest: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/curva_sud_ovest_1x1.png"),
  incrocio_nord_est_ovest: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/incrocio_nord_est_ovest_1x1.png"),
  incrocio_nord_est_sud: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/incrocio_nord_est_sud_1x1.png"),
  incrocio_est_sud_ovest: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/incrocio_est_sud_ovest_1x1.png"),
  incrocio_est_sud_nord: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/incrocio_est_sud_nord_1x1.png"),
  incrocio_centro: require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/incrocio_centro_1x1.png")
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
