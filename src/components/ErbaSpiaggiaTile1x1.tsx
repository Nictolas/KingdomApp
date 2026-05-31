import React, { memo } from "react";
import type { ErbaSpiaggiaTileAsset1x1 } from "../game/terrainSpriteHelpers";
import { getErbaSpiaggiaSheetCoord } from "../game/overworldSpritesheetLayout";
import { TerrainSheetSprite } from "./TerrainSheetSprite";

type Props = {
  cellSize: number;
  asset: ErbaSpiaggiaTileAsset1x1;
};

export const ErbaSpiaggiaTile1x1 = memo(function ErbaSpiaggiaTile1x1({ cellSize, asset }: Props) {
  return <TerrainSheetSprite cellSize={cellSize} coord={getErbaSpiaggiaSheetCoord(asset)} />;
});
