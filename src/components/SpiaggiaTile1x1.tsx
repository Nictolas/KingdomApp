import React, { memo } from "react";
import type { SpiaggiaTileAsset1x1 } from "../game/terrainSpriteHelpers";
import { optionalTileAsset, tileAssetFromMap } from "../game/tileAssetSource";
import { Tile1x1Image } from "./Tile1x1Image";

const ASSETS: Partial<Record<SpiaggiaTileAsset1x1, number | null>> = {
  nord: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/spiaggia_nord.png")
  ),
  sud: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/spiaggia_sud.png")
  ),
  est: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/spiaggia_est.png")
  ),
  ovest: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/spiaggia_ovest.png")
  ),
  nord_est: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/spiaggia_nord_est.png")
  ),
  nord_ovest: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/spiaggia_nord_ovest.png")
  ),
  sud_est: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/spiaggia_sud_est.png")
  ),
  sud_ovest: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/spiaggia_sud_ovest.png")
  ),
  centro: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/spiaggia_centro.png")
  )
};

type Props = {
  cellSize: number;
  asset: SpiaggiaTileAsset1x1;
};

/**
 * Una cella mappa = un tile spiaggia/sabbia 1×1 (PNG dedicati).
 */
export const SpiaggiaTile1x1 = memo(function SpiaggiaTile1x1({ cellSize, asset }: Props) {
  return <Tile1x1Image cellSize={cellSize} source={tileAssetFromMap(ASSETS, asset)} />;
});
