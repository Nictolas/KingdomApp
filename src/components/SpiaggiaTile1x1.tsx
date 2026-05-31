import React, { memo } from "react";
import type { SpiaggiaTileAsset1x1 } from "../game/terrainSpriteHelpers";
import { getSpiaggiaSheetCoord } from "../game/overworldSpritesheetLayout";
import { TerrainSheetSprite } from "./TerrainSheetSprite";

type Props = {
  cellSize: number;
  asset: SpiaggiaTileAsset1x1;
};

export const SpiaggiaTile1x1 = memo(function SpiaggiaTile1x1({ cellSize, asset }: Props) {
  return <TerrainSheetSprite cellSize={cellSize} coord={getSpiaggiaSheetCoord(asset)} />;
});
