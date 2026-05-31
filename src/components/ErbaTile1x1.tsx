import React, { memo } from "react";
import type { ErbaTileAsset1x1 } from "../game/terrainSpriteHelpers";
import { optionalTileAsset, tileAssetFromMap } from "../game/tileAssetSource";
import { Tile1x1Image } from "./Tile1x1Image";

const ASSETS: Partial<Record<ErbaTileAsset1x1, number | null>> = {
  centro: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/erba_centro_1x1.png")
  ),
  campo_nord_est: optionalTileAsset(
    () => require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/campo_nord_est_1x1.png")
  )
};

type Props = {
  cellSize: number;
  asset: ErbaTileAsset1x1;
};

/**
 * Una cella mappa = un tile erba 1×1 (PNG dedicati).
 */
export const ErbaTile1x1 = memo(function ErbaTile1x1({ cellSize, asset }: Props) {
  return <Tile1x1Image cellSize={cellSize} source={tileAssetFromMap(ASSETS, asset)} />;
});
