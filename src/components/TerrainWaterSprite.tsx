import React, { memo } from "react";
import { View, Image, StyleSheet } from "react-native";
import { OVERWORLD_SHEET_PX } from "../game/overworldSpritesheetLayout";

const SPRITESHEET = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/spritesheet-full.png");

type Props = {
  cellSize: number;
  /** 0 … waterFrames-1, aggiornato da un unico timer sulla mappa */
  frame: number;
};

/**
 * Ritaglia un frame 64×64 dalla striscia acqua e lo scala alla cella (come sprite sheet + overflow hidden).
 */
function TerrainWaterSpriteInner({ cellSize, frame }: Props) {
  const { w: sw, h: sh, waterTile: t, waterAnimX: ox, waterAnimY: oy, waterFrames: n } = OVERWORLD_SHEET_PX;
  const f = ((frame % n) + n) % n;
  const scale = cellSize / t;
  const imgW = sw * scale;
  const imgH = sh * scale;
  const left = -(ox + f * t) * scale;
  const top = -oy * scale;

  return (
    <View style={[styles.clip, { width: cellSize, height: cellSize }]} pointerEvents="none">
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

export const TerrainWaterSprite = memo(TerrainWaterSpriteInner);
