import React, { memo } from "react";
import type { ErbaTileAsset1x1 } from "../game/terrainSpriteHelpers";
import { getErbaSheetCoord } from "../game/overworldSpritesheetLayout";
import { TerrainSheetSprite } from "./TerrainSheetSprite";

type Props = {
  cellSize: number;
  asset: ErbaTileAsset1x1;
};

export const ErbaTile1x1 = memo(function ErbaTile1x1({ cellSize, asset }: Props) {
  return <TerrainSheetSprite cellSize={cellSize} coord={getErbaSheetCoord(asset)} />;
});
