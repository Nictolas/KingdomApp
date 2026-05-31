import React, { memo } from "react";
import type { StradaTileAsset1x1 } from "../game/terrainSpriteHelpers";
import { getStradaSheetCoord } from "../game/overworldSpritesheetLayout";
import { TerrainSheetSprite } from "./TerrainSheetSprite";

type Props = {
  cellSize: number;
  asset: StradaTileAsset1x1;
};

export const StradaTile1x1 = memo(function StradaTile1x1({ cellSize, asset }: Props) {
  return <TerrainSheetSprite cellSize={cellSize} coord={getStradaSheetCoord(asset)} />;
});
