import React, { memo } from "react";
import type { StradaTileAsset1x1 } from "../game/terrainSpriteHelpers";
import { optionalTileAsset, tileAssetFromMap } from "../game/tileAssetSource";
import { Tile1x1Image } from "./Tile1x1Image";

const ASSETS: Partial<Record<StradaTileAsset1x1, number | null>> = {
  orizzontale: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada_orizzontale1x1.png")
  ),
  verticale: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada_verticale1x1.png")
  ),
  nord: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada_nord1x1.png")
  ),
  sud: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada_sud1x1.png")
  ),
  /**
   * Allineamento nomi file ↔ topologia:
   * - `est` = unico vicino strada a **Est** → file `strada_ovest1x1`.
   * - `ovest` = unico vicino strada a **Ovest** → file `strada_est1x1`.
   */
  est: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada_ovest1x1.png")
  ),
  ovest: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada_est1x1.png")
  ),
  curva_nord_est: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/curva_nord_est_1x1.png")
  ),
  curva_nord_ovest: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/curva_nord_ovest_1x1.png")
  ),
  curva_sud_est: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/curva_sud_est_1x1.png")
  ),
  curva_sud_ovest: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/curva_sud_ovest_1x1.png")
  ),
  incrocio_nord_est_ovest: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/incrocio_nord_est_ovest_1x1.png")
  ),
  incrocio_nord_est_sud: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/incrocio_nord_est_sud_1x1.png")
  ),
  incrocio_est_sud_ovest: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/incrocio_est_sud_ovest_1x1.png")
  ),
  incrocio_est_sud_nord: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/incrocio_est_sud_nord_1x1.png")
  ),
  incrocio_centro: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/incrocio_centro_1x1.png")
  ),
  centro: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada_centro_1x1.png")
  ),
  generica: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/strada1x1.png")
  )
};

type Props = {
  cellSize: number;
  asset: StradaTileAsset1x1;
};

/**
 * Una cella mappa = un tile strada 1×1 (PNG dedicati).
 */
export const StradaTile1x1 = memo(function StradaTile1x1({ cellSize, asset }: Props) {
  return <Tile1x1Image cellSize={cellSize} source={tileAssetFromMap(ASSETS, asset)} />;
});
