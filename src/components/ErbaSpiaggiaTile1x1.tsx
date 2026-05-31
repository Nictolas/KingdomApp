import React, { memo } from "react";
import type { ErbaSpiaggiaTileAsset1x1 } from "../game/terrainSpriteHelpers";
import { optionalTileAsset, tileAssetFromMap } from "../game/tileAssetSource";
import { Tile1x1Image } from "./Tile1x1Image";

const ASSETS: Partial<Record<ErbaSpiaggiaTileAsset1x1, number | null>> = {
  nord: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/erba_spiaggia_nord.png")
  ),
  sud: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/erba_spiaggia_sud.png")
  ),
  est: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/erba_spiaggia_est.png")
  ),
  ovest: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/erba_spiaggia_ovest.png")
  ),
  nord_ovest: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/erba_spiaggia_nord_ovest.png")
  ),
  nord_est: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/erba_spiaggia_nord_est.png")
  ),
  sud_est: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/erba_spiaggia_sud_est.png")
  ),
  sud_ovest: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/erba_spiaggia_sud_ovest.png")
  )
};

type Props = {
  cellSize: number;
  asset: ErbaSpiaggiaTileAsset1x1;
};

/**
 * Transizione erba ↔ spiaggia 1×1 (PNG dedicati).
 */
export const ErbaSpiaggiaTile1x1 = memo(function ErbaSpiaggiaTile1x1({ cellSize, asset }: Props) {
  return <Tile1x1Image cellSize={cellSize} source={tileAssetFromMap(ASSETS, asset)} />;
});
