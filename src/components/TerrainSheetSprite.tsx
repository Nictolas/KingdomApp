import React, { memo } from "react";
import { View, Image, StyleSheet } from "react-native";
import { OVERWORLD_SHEET_PX, beachSubtileOriginPx } from "../game/overworldSpritesheetLayout";
import type { BeachSubtileIndex } from "../game/terrainSpriteHelpers";

const SPRITESHEET = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/spritesheet-full.png");

type Props =
  | { cellSize: number; terrain: "water"; frame: number }
  | { cellSize: number; terrain: "grass" }
  | { cellSize: number; terrain: "sand"; beachSubtile: BeachSubtileIndex };

/**
 * Ritaglia una tile 64×64 dallo spritesheet e la scala alla cella (overflow hidden).
 */
function TerrainSheetSpriteInner(props: Props) {
  const { w: sw, h: sh, tile: t } = OVERWORLD_SHEET_PX;
  const scale = props.cellSize / t;
  const imgW = sw * scale;
  const imgH = sh * scale;

  let ox: number;
  let oy: number;

  if (props.terrain === "water") {
    const f = ((props.frame % OVERWORLD_SHEET_PX.waterFrames) + OVERWORLD_SHEET_PX.waterFrames) % OVERWORLD_SHEET_PX.waterFrames;
    ox = OVERWORLD_SHEET_PX.waterAnimX + f * t;
    oy = OVERWORLD_SHEET_PX.waterAnimY;
  } else if (props.terrain === "grass") {
    ox = OVERWORLD_SHEET_PX.grassFill.x;
    oy = OVERWORLD_SHEET_PX.grassFill.y;
  } else {
    const o = beachSubtileOriginPx(props.beachSubtile);
    ox = o.x;
    oy = o.y;
  }

  const left = -ox * scale;
  const top = -oy * scale;

  return (
    <View style={[styles.clip, { width: props.cellSize, height: props.cellSize }]} pointerEvents="none">
      <Image source={SPRITESHEET} style={[styles.sheet, { width: imgW, height: imgH, left, top }]} resizeMode="stretch" />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
    position: "absolute",
    left: 0,
    top: 0
  },
  sheet: {
    position: "absolute"
  }
});

export const TerrainSheetSprite = memo(TerrainSheetSpriteInner);
